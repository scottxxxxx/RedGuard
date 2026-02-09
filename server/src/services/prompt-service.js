const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PromptService {
    constructor() {
        // Path to the default prompt configuration
        this.defaultPromptPath = path.join(__dirname, '../prompts/default_evaluation.json');
    }

    /**
     * Get the default evaluation prompt from JSON file
     */
    async getDefaultPrompt() {
        try {
            if (fs.existsSync(this.defaultPromptPath)) {
                const data = fs.readFileSync(this.defaultPromptPath, 'utf8');
                return JSON.parse(data);
            }
            throw new Error(`Default prompt file not found at ${this.defaultPromptPath}`);
        } catch (error) {
            console.error('Error reading default prompt:', error);
            // Fallback if file is missing (failsafe)
            return {
                prompt_text: "You are a Guardrail Judge. Evaluate the response."
            };
        }
    }

    /**
     * Save a custom prompt template
     */
    async savePrompt(name, promptText) {
        // We use 'guardrailType' as the name for custom templates in current schema
        return prisma.evaluationPrompt.create({
            data: {
                guardrailType: name || 'Custom Template',
                promptText: promptText,
                version: 1,
                isActive: true
            }
        });
    }

    /**
     * Get all saved prompt templates
     */
    async getPrompts() {
        return prisma.evaluationPrompt.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Delete a saved prompt
     */
    async deletePrompt(id) {
        return prisma.evaluationPrompt.delete({
            where: { id }
        });
    }
}

module.exports = new PromptService();
