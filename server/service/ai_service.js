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
                return row;
            }
        } catch (e) { }
        return { ai_work_mode: false };
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
Your task is to extract consultation ticket information from raw text (emails, chat logs).
Return ONLY a JSON object with the following fields (if missing, use null or meaningful defaults):
- customer_name: string
- contact_info: string (email or phone)
- product_model: string (e.g., MAVO Edge 8K, MAVO mark2, MC8020)
- issue_summary: string (short title)
- issue_description: string (detailed description)
- urgency: "Normal" | "High" | "Critical" (infer from tone)

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
     * Chat method for Bokeh Assistant (History Aware).
     * @param {Array} messages - Array of {role, content} objects
     * @param {Object} context - Context object (page, title, etc.)
     */
    async chat(messages, context = {}) {
        const provider = this._getActiveProvider();
        const client = this._getClient(provider);
        if (!client) throw new Error("Active AI Provider has no API Key configured.");

        const settings = this._getSystemSettings();

        // Policy Check: Work Mode Only
        if (settings.ai_work_mode) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
                // Instruction is handled by system prompt
            }
        }

        const systemPrompt = `You are Bokeh, Kinefinity's professional AI service assistant.
You have access to the Kinefinity Service Database.
Current Context:
- Page: ${context.path || 'Unknown'}
- Title: ${context.title || 'Unknown'}
- Strict Work Mode: ${settings.ai_work_mode ? 'ENABLED (Refuse casual chat, only answer work-related questions)' : 'DISABLED'}
- Web Search: ${provider.allow_search ? 'ENABLED' : 'DISABLED'}

Guidelines:
- Be helpful, concise, and professional.
- If Strict Work Mode is ON, politely refuse to answer questions about movies, jokes, or general trivia unrelated to Kinefinity/Filmmaking.
- Your persona: "Ethereal, Calm, Responsive". Use "we" when referring to Kinefinity support.
`;

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
}

module.exports = AIService;
