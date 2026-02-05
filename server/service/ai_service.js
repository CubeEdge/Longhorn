const OpenAI = require('openai');
const path = require('path');

class AIService {
    constructor(db) {
        this.db = db;

        const apiKey = process.env.AI_API_KEY;
        const baseURL = process.env.AI_BASE_URL || 'https://api.deepseek.com';

        if (!apiKey) {
            console.warn('[AIService] No AI_API_KEY found in environment variables. AI features will be disabled.');
            this.client = null;
        } else {
            this.client = new OpenAI({
                baseURL: baseURL,
                apiKey: apiKey,
            });
            console.log(`[AIService] Initialized with provider: ${process.env.AI_PROVIDER || 'DeepSeek'}`);
        }

        this.models = {
        };
    }

    /**
     * Helper: Fetch current system settings or default
     */
    _getSettings() {
        try {
            const row = this.db.prepare('SELECT * FROM system_settings LIMIT 1').get();
            if (row) return row;
        } catch (e) {
            console.warn('[AIService] Failed to fetch settings, using defaults');
        }
        return {
            ai_provider: 'DeepSeek',
            ai_model_chat: process.env.AI_MODEL_CHAT || 'deepseek-chat',
            ai_model_reasoner: process.env.AI_MODEL_REASONER || 'deepseek-reasoner',
            ai_model_vision: 'gemini-1.5-flash',
            ai_temperature: 0.7,
            ai_work_mode: 0,
            ai_allow_search: 0
        };
    }

    /**
     * Determines which model to use based on task type.
     * @param {string} taskType - 'chat', 'logic', 'vision'
     * @returns {string} Model name
     */
    _getModel(taskType) {
        const settings = this._getSettings();
        if (taskType === 'logic') return settings.ai_model_reasoner;
        if (taskType === 'vision') return settings.ai_model_vision;
        return settings.ai_model_chat; // Default
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
        if (!this.client) throw new Error("AI Service not fully configured.");
        if (taskType === 'vision') throw new Error("Vision tasks not yet implemented.");

        const settings = this._getSettings();
        const model = this._getModel(taskType);

        try {
            const completion = await this.client.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: settings.ai_temperature || 0.7,
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

        // Ticket parsing is a 'logic' heavy task? Actually 'chat' model (V3) is usually good enough for extraction and cheaper/faster. 
        // But if complex reasoning is needed we could use reasoner. Let's stick to 'chat' for standard extraction to save query time.
        const model = this._getModel('chat');

        try {
            const completion = await this.client.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: rawText }
                ],
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
        const settings = this._getSettings();

        // Policy Check: Work Mode Only
        if (settings.ai_work_mode) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
                // Simple keyword check or just add instruction to system prompt
                // For robustness, we will inject a strict system instruction.
            }
        }

        const systemPrompt = `You are Bokeh, Kinefinity's professional AI service assistant.
You have access to the Kinefinity Service Database.
Current Context:
- Page: ${context.path || 'Unknown'}
- Title: ${context.title || 'Unknown'}
- Strict Work Mode: ${settings.ai_work_mode ? 'ENABLED (Refuse casual chat, only answer work-related questions)' : 'DISABLED'}
- Web Search: ${settings.ai_allow_search ? 'ENABLED' : 'DISABLED'}

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
            const completion = await this.client.chat.completions.create({
                model: model,
                messages: fullMessages,
                temperature: settings.ai_temperature || 0.7,
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
