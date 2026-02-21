const OpenAI = require('openai');
const path = require('path');

class AIService {
    constructor(db) {
        this.db = db;
        this.clients = new Map(); // Cache clients by provider name
    }

    /**
     * Helper: Fetch active provider settings
     */
    _getActiveProvider() {
        try {
            const provider = this.db.prepare('SELECT * FROM ai_providers WHERE is_active = 1 LIMIT 1').get();
            if (provider) {
                provider.allow_search = Boolean(provider.allow_search);
                if (!provider.api_key) provider.api_key = process.env.AI_API_KEY;
                if (!provider.base_url) provider.base_url = process.env.AI_BASE_URL || 'https://api.deepseek.com';
                return provider;
            }
        } catch (e) {
            console.warn('[AIService] Failed to fetch active provider, using env fallback');
        }

        // Fallback to env for backward compatibility
        return {
            name: process.env.AI_PROVIDER || 'DeepSeek',
            api_key: process.env.AI_API_KEY,
            base_url: process.env.AI_BASE_URL || 'https://api.deepseek.com',
            chat_model: process.env.AI_MODEL_CHAT || 'deepseek-chat',
            reasoner_model: process.env.AI_MODEL_REASONER || 'deepseek-reasoner',
            vision_model: 'gemini-1.5-flash',
            allow_search: false
        };
    }

    _getSystemSettings() {
        try {
            const row = this.db.prepare('SELECT * FROM system_settings LIMIT 1').get();
            if (row) {
                row.ai_work_mode = Boolean(row.ai_work_mode);
                // Parse ai_data_sources JSON array
                try {
                    row.ai_data_sources = row.ai_data_sources ? JSON.parse(row.ai_data_sources) : ['tickets', 'knowledge'];
                } catch (e) {
                    row.ai_data_sources = ['tickets', 'knowledge'];
                }
                return row;
            }
        } catch (e) { }
        return { ai_work_mode: false, ai_data_sources: ['tickets', 'knowledge'] };
    }

    /**
     * Get or create OpenAI client for a provider
     */
    _getClient(provider) {
        if (!provider.api_key) return null;

        // Cache by name, key AND baseURL to handle changes immediately
        const cacheKey = `${provider.name}_${provider.api_key.substring(0, 8)}_${provider.base_url}`;
        if (this.clients.has(cacheKey)) return this.clients.get(cacheKey);

        const config = {
            baseURL: provider.base_url,
            apiKey: provider.api_key,
            timeout: 60000,
            maxRetries: 2,
        };

        // Note: Generic proxy support (OpenAI SDK uses fetch internally)
        // If the environment has HTTPS_PROXY and https-proxy-agent is installed, 
        // it would handle it. For now, we rely on the standard fetch environment.

        const client = new OpenAI(config);
        this.clients.set(cacheKey, client);
        return client;
    }

    _getModel(taskType) {
        const provider = this._getActiveProvider();
        if (taskType === 'logic') return provider.reasoner_model || provider.chat_model;
        if (taskType === 'vision') return provider.vision_model || provider.chat_model;
        return provider.chat_model;
    }

    /**
     * Logs token usage to the database.
     * @param {string} model - Model used
     * @param {string} taskType - Task type
     * @param {object} usage - Usage object from API response
     */
    _logUsage(model, taskType, usage) {
        if (!this.db || !usage) return;

        try {
            const stmt = this.db.prepare(`
                INSERT INTO ai_usage_logs (model, task_type, prompt_tokens, completion_tokens, total_tokens)
                VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run(model, taskType, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens);
        } catch (err) {
            console.error('[AIService] Failed to log usage:', err.message);
        }
    }

    /**
     * General purpose generation method with Router logic.
     * @param {string} taskType - 'chat' or 'logic'
     * @param {string} systemPrompt - System instruction
     * @param {string} userPrompt - User input
     */
    async generate(taskType, systemPrompt, userPrompt) {
        const provider = this._getActiveProvider();
        const client = this._getClient(provider);
        if (!client) throw new Error("Active AI Provider has no API Key configured.");

        const settings = this._getSystemSettings();
        const model = this._getModel(taskType);

        try {
            const completion = await client.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: provider.temperature ?? 0.7,
                max_tokens: provider.max_tokens ?? 4096,
                top_p: provider.top_p ?? 1.0,
                stream: false,
            });

            const result = completion.choices[0].message.content;
            const usage = completion.usage;

            // Async log usage
            this._logUsage(model, taskType, usage);

            return result;
        } catch (error) {
            console.error(`[AIService] Error in generate (${taskType}):`, error);
            throw error;
        }
    }

    /**
     * Specialized method for parsing tickets (Bokeh persona).
     * @param {string} rawText - The unformatted text (email/chat)
     * @returns {Promise<Object>} JSON object with ticket fields
     */
    async parseTicket(rawText) {
        const provider = this._getActiveProvider();
        const client = this._getClient(provider);
        if (!client) throw new Error("Active AI Provider has no API Key configured.");

        const systemPrompt = `You are Bokeh, Kinefinity's professional AI service assistant.
Your task is to extract consultation ticket information from raw text (emails, chat logs, messages).
Return ONLY a JSON object with the following fields (if missing, use null):

**Customer Info:**
- customer_name: string (full name)
- contact_info: string (email or phone number)

**Product Info:**
- product_model: string (exact model name: MAVO Edge 8K, MAVO Edge 6K, MAVO LF, MAVO mark2, MC8020, KineMON, Eagle, Terra, etc.)
- serial_number: string (format: XXXXXXXX or letters+numbers, usually 8+ chars)

**Service Info:**
- service_type: "Consultation" | "Troubleshooting" | "RemoteAssist" | "Complaint" (infer from content)
- channel: "Phone" | "Email" | "WeChat" | "WeCom" | "Facebook" | "Online" (detect communication method)

**Issue Info:**
- issue_summary: string (concise title, max 50 chars)
- issue_description: string (detailed description with context)
- urgency: "Normal" | "High" | "Critical" (infer from tone, keywords like "urgent", "ASAP", "production stopped")

**Important Rules:**
- Recognize Kinefinity product names and variations (e.g., "Edge 8K" = "MAVO Edge 8K")
- Extract serial numbers carefully (usually 8+ alphanumeric characters)
- Infer service_type: questions → Consultation, technical issues → Troubleshooting, complaints → Complaint
- Detect channel from context: "email from", "called", "WeChat message", etc.
- Set urgency based on language: "urgent", "ASAP", "critical", "production", "deadline"

Output raw JSON only, no markdown formatting blocks.`;

        const model = this._getModel('chat');

        try {
            const completion = await client.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: rawText }
                ],
                temperature: 0.3, // Lower temp for factual extraction by default, but could follow global
                response_format: { type: "json_object" }, // Enforce JSON if model supports it
            });

            const content = completion.choices[0].message.content;
            const usage = completion.usage;

            this._logUsage(model, 'ticket_parsing', usage);

            return JSON.parse(content);
        } catch (error) {
            console.error('[AIService] Ticket parsing failed:', error);
            throw error;
        }
    }
    /**
     * Chat method for Bokeh Assistant (History Aware + Ticket Search + Knowledge Search).
     * @param {Array} messages - Array of {role, content} objects
     * @param {Object} context - Context object (page, title, etc.)
     * @param {Object} user - User object with role and dealer_id for permission filtering
     */
    async chat(messages, context = {}, user = null) {
        const provider = this._getActiveProvider();
        const client = this._getClient(provider);
        if (!client) throw new Error("Active AI Provider has no API Key configured.");

        const settings = this._getSystemSettings();
        const dataSources = settings.ai_data_sources || ['tickets', 'knowledge'];

        // Policy Check: Work Mode Only
        if (settings.ai_work_mode) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
                // Instruction is handled by system prompt
            }
        }

        // Extract last user message for searches
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

        // Detect if user query needs search (keywords-based heuristic)
        const needsSearch = this._detectTicketSearchIntent(lastUserMessage);

        let contextSections = [];

        // Search Tickets if enabled
        if (needsSearch && dataSources.includes('tickets') && this.db) {
            try {
                const tickets = await this._searchRelatedTickets(lastUserMessage, user);
                if (tickets && tickets.length > 0) {
                    let ticketContext = '\n\n## 相关历史工单参考\n';
                    tickets.forEach((t, i) => {
                        ticketContext += `${i + 1}. **[${t.ticket_number}]** (${t.ticket_type})\n`;
                        ticketContext += `   标题: ${t.title}\n`;
                        if (t.customer_name) ticketContext += `   客户: ${t.customer_name}\n`;
                        if (t.product_model) ticketContext += `   产品: ${t.product_model}\n`;
                        if (t.resolution) {
                            ticketContext += `   解决方案: ${t.resolution.substring(0, 150)}${t.resolution.length > 150 ? '...' : ''}\n`;
                        }
                        ticketContext += `\n`;
                    });
                    ticketContext += '请在回答中引用工单编号,格式为[工单编号|工单ID|类型],例如[K2602-0001|123|inquiry]。\n';
                    contextSections.push(ticketContext);
                }
            } catch (err) {
                console.warn('[AIService] Ticket search failed:', err.message);
            }
        }

        // Search Knowledge Base if enabled
        if (needsSearch && dataSources.includes('knowledge') && this.db) {
            try {
                const articles = await this._searchRelatedKnowledge(lastUserMessage, user);
                if (articles && articles.length > 0) {
                    let knowledgeContext = '\n\n## 相关知识库文章参考\n';
                    articles.forEach((a, i) => {
                        knowledgeContext += `${i + 1}. **${a.title}** (${a.category})\n`;
                        if (a.product_line) knowledgeContext += `   产品线: ${a.product_line}\n`;
                        if (a.summary) knowledgeContext += `   摘要: ${a.summary}\n`;
                        if (a.content) {
                            knowledgeContext += `   内容摘录: ${a.content}${a.content.length >= 300 ? '...' : ''}\n`;
                        }
                        if (a.source_reference) knowledgeContext += `   来源: ${a.source_reference}\n`;
                        knowledgeContext += `   链接: /tech-hub/wiki/${a.slug}\n`;
                        knowledgeContext += `\n`;
                    });
                    knowledgeContext += '请在回答中引用知识库文章标题和链接。\n';
                    contextSections.push(knowledgeContext);
                }
            } catch (err) {
                console.warn('[AIService] Knowledge search failed:', err.message);
            }
        }

        const enhancedContext = contextSections.join('');

        const systemPrompt = `You are Bokeh, Kinefinity's professional AI service assistant.
You have access to the Kinefinity Service Database.
Current Context:
- Page: ${context.path || 'Unknown'}
- Title: ${context.title || 'Unknown'}
- Strict Work Mode: ${settings.ai_work_mode ? 'ENABLED (Refuse casual chat, only answer work-related questions)' : 'DISABLED'}
- Web Search: ${provider.allow_search ? 'ENABLED' : 'DISABLED'}
- Active Data Sources: ${dataSources.join(', ')}

Guidelines:
- Be helpful, concise, and professional.
- If Strict Work Mode is ON, politely refuse to answer questions about movies, jokes, or general trivia unrelated to Kinefinity/Filmmaking.
- Your persona: "Ethereal, Calm, Responsive". Use "we" when referring to Kinefinity support.
- When historical tickets are provided, cite them using their ticket numbers (e.g., [K2602-0001]).
- When knowledge articles are provided, cite them with titles and provide links (e.g., "根据[MAVO Edge 6K: 1.1 端口说明](/tech-hub/wiki/mavo-edge-6k-1-1-端口说明)...").
${enhancedContext}`;

        const model = this._getModel('chat');

        // Prepend system prompt
        const fullMessages = [
            { role: "system", content: systemPrompt },
            ...messages
        ];

        try {
            const completion = await client.chat.completions.create({
                model: model,
                messages: fullMessages,
                temperature: provider.temperature ?? 0.7,
                max_tokens: provider.max_tokens ?? 4096,
                top_p: provider.top_p ?? 1.0,
            });

            const result = completion.choices[0].message.content;
            const usage = completion.usage;

            this._logUsage(model, 'bokeh_chat', usage);

            return result;
        } catch (error) {
            console.error('[AIService] Chat failed:', error);
            throw error;
        }
    }

    /**
     * Detect if user query needs ticket search (keyword-based heuristic)
     * @param {string} query - User query
     * @returns {boolean}
     */
    _detectTicketSearchIntent(query) {
        const keywords = [
            '问题', '故障', '死机', '无法', '不能', '错误', '异常',
            'issue', 'problem', 'error', 'crash', 'fail', 'not working',
            '如何解决', '怎么办', '解决方案', 'how to fix', 'solution',
            '历史', '以前', '案例', 'history', 'previous', 'case'
        ];
        const lowerQuery = query.toLowerCase();
        return keywords.some(kw => lowerQuery.includes(kw));
    }

    /**
     * Search related tickets based on user query
     * @param {string} query - User query
     * @param {Object} user - User object with role and dealer_id
     * @returns {Promise<Array>} Array of ticket results
     */
    async _searchRelatedTickets(query, user) {
        if (!this.db) return [];

        // Build WHERE clause based on user role
        let whereConditions = ['tsi.closed_at IS NOT NULL'];
        let params = { query, limit: 3 }; // Top 3 tickets

        // Permission Filter
        if (user && user.department === 'Dealer' && user.dealer_id) {
            whereConditions.push('tsi.dealer_id = @dealer_id');
            params.dealer_id = user.dealer_id;
        }

        const whereClause = whereConditions.join(' AND ');

        // FTS5 Search Query
        const searchQuery = `
            SELECT 
                tsi.ticket_number,
                tsi.ticket_type,
                tsi.ticket_id,
                tsi.title,
                tsi.resolution,
                tsi.product_model,
                tsi.account_id,
                fts.rank
            FROM ticket_search_index tsi
            INNER JOIN ticket_search_fts fts ON tsi.id = fts.rowid
            WHERE fts MATCH @query
              AND ${whereClause}
            ORDER BY fts.rank
            LIMIT @limit
        `;

        try {
            const results = this.db.prepare(searchQuery).all(params);

            // Enrich with account names
            return results.map(r => {
                let customer_name = null;
                if (r.account_id) {
                    const account = this.db.prepare('SELECT name FROM accounts WHERE id = ?').get(r.account_id);
                    customer_name = account?.name;
                }
                return {
                    ...r,
                    customer_name
                };
            });
        } catch (err) {
            console.error('[AIService] Ticket search query failed:', err);
            return [];
        }
    }

    /**
     * Search related knowledge articles based on user query
     * @param {string} query - User query
     * @param {Object} user - User object with role and department
     * @returns {Promise<Array>} Array of knowledge article results
     */
    async _searchRelatedKnowledge(query, user) {
        if (!this.db) return [];

        // Build WHERE clause based on user visibility
        let whereConditions = ["ka.status = 'published'"];
        let params = { query, limit: 3 }; // Top 3 articles

        // Visibility Filter based on user role
        if (user) {
            if (user.department === 'Dealer') {
                // Dealers can see Public and Dealer visibility
                whereConditions.push("(ka.visibility = 'Public' OR ka.visibility = 'Dealer')");
            } else if (['Admin', 'Lead', 'Editor', 'Support'].includes(user.role)) {
                // Internal staff can see all including Internal
                // No additional filter needed
            } else {
                // Others only see Public
                whereConditions.push("ka.visibility = 'Public'");
            }
        } else {
            // Unauthenticated users only see Public
            whereConditions.push("ka.visibility = 'Public'");
        }

        const whereClause = whereConditions.join(' AND ');

        // FTS5 Search Query for knowledge base
        const searchQuery = `
            SELECT 
                ka.id,
                ka.title,
                ka.slug,
                ka.summary,
                ka.content,
                ka.category,
                ka.product_line,
                ka.visibility,
                ka.source_reference,
                fts.rank
            FROM knowledge_articles ka
            INNER JOIN knowledge_fts fts ON ka.id = fts.rowid
            WHERE fts MATCH @query
              AND ${whereClause}
            ORDER BY fts.rank
            LIMIT @limit
        `;

        try {
            const results = this.db.prepare(searchQuery).all(params);
            return results.map(r => ({
                id: r.id,
                title: r.title,
                slug: r.slug,
                summary: r.summary,
                content: r.content?.substring(0, 300), // Truncate content
                category: r.category,
                product_line: r.product_line,
                source_reference: r.source_reference,
                relevance_score: r.rank
            }));
        } catch (err) {
            console.error('[AIService] Knowledge search query failed:', err);
            return [];
        }
    }
}

module.exports = AIService;

