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
            chat: process.env.AI_MODEL_CHAT || 'deepseek-chat',
            reasoner: process.env.AI_MODEL_REASONER || 'deepseek-reasoner'
        };
    }

    /**
     * Determines which model to use based on task type.
     * @param {string} taskType - 'chat', 'logic', 'vision'
     * @returns {string} Model name
     */
    _getModel(taskType) {
        if (taskType === 'logic') return this.models.reasoner;
        if (taskType === 'chat') return this.models.chat;
        return this.models.chat; // Default
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

        const model = this._getModel(taskType);

        try {
            const completion = await this.client.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
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
        const model = this.models.chat;

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
}

module.exports = AIService;
