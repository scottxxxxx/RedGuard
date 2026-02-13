const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Model-to-template mapping for model-specific default prompts
const MODEL_TEMPLATE_MAP = [
    { match: (provider, model) => provider === 'openai' && model && model.startsWith('gpt-5'), file: 'default_evaluation_gpt5.json' },
    // Future model-specific templates can be added here
];

// Additional named templates that appear in the template list but don't auto-match any model
const EXTRA_TEMPLATES = [
    'default_evaluation_gpt5_flash.json',
    'default_evaluation_opus_v2.json',
    'default_evaluation_opus_og.json',
];

class PromptService {
    constructor() {
        // Path to the default prompt configuration
        this.defaultPromptPath = path.join(__dirname, '../prompts/default_evaluation.json');
        this.promptsDir = path.join(__dirname, '../prompts/');
    }

    /**
     * Get the default evaluation prompt, optionally model-specific.
     * Returns object with key, name, description, prompt_text, system_prompt?, response_format?
     */
    async getDefaultPrompt(provider = null, model = null) {
        try {
            // Try model-specific template first
            if (provider && model) {
                for (const entry of MODEL_TEMPLATE_MAP) {
                    if (entry.match(provider, model)) {
                        const templatePath = path.join(this.promptsDir, entry.file);
                        if (fs.existsSync(templatePath)) {
                            const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
                            template.key = entry.file.replace('.json', '');
                            return template;
                        }
                    }
                }
            }

            // Fallback to universal default (existing behavior)
            if (fs.existsSync(this.defaultPromptPath)) {
                const data = fs.readFileSync(this.defaultPromptPath, 'utf8');
                const template = JSON.parse(data);
                template.key = 'default_evaluation';
                return template;
            }
            throw new Error(`Default prompt file not found at ${this.defaultPromptPath}`);
        } catch (error) {
            console.error('Error reading default prompt:', error);
            return {
                key: 'default_evaluation',
                prompt_text: "You are a Guardrail Judge. Evaluate the response."
            };
        }
    }

    /**
     * Get all available default templates (universal + model-specific)
     */
    async getAllDefaults() {
        const defaults = [];

        // Universal default first
        try {
            if (fs.existsSync(this.defaultPromptPath)) {
                const template = JSON.parse(fs.readFileSync(this.defaultPromptPath, 'utf8'));
                defaults.push({ key: 'default_evaluation', name: template.name, description: template.description });
            }
        } catch (e) {
            console.error('Error reading universal default:', e);
        }

        // Model-specific templates
        for (const entry of MODEL_TEMPLATE_MAP) {
            try {
                const templatePath = path.join(this.promptsDir, entry.file);
                if (fs.existsSync(templatePath)) {
                    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
                    const key = entry.file.replace('.json', '');
                    defaults.push({ key, name: template.name, description: template.description });
                }
            } catch (e) {
                console.error(`Error reading template ${entry.file}:`, e);
            }
        }

        // Extra named templates (listed but not auto-matched to any model)
        for (const file of EXTRA_TEMPLATES) {
            try {
                const templatePath = path.join(this.promptsDir, file);
                if (fs.existsSync(templatePath)) {
                    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
                    const key = file.replace('.json', '');
                    defaults.push({ key, name: template.name, description: template.description });
                }
            } catch (e) {
                console.error(`Error reading extra template ${file}:`, e);
            }
        }

        return defaults;
    }

    /**
     * Get a specific default template by key (filename without .json)
     */
    async getDefaultByKey(key) {
        try {
            const templatePath = path.join(this.promptsDir, `${key}.json`);
            if (fs.existsSync(templatePath)) {
                const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
                template.key = key;
                return template;
            }
            throw new Error(`Template not found: ${key}`);
        } catch (error) {
            console.error(`Error reading template by key ${key}:`, error);
            return null;
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
