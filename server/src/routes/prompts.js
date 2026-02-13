const express = require('express');
const router = express.Router();
const promptService = require('../services/prompt-service');

// Get all available default templates (universal + model-specific)
router.get('/defaults', async (req, res) => {
    try {
        const defaults = await promptService.getAllDefaults();
        res.json(defaults);
    } catch (err) {
        console.error('Error fetching default templates:', err);
        res.status(500).json({ error: 'Failed to fetch default templates' });
    }
});

// Get a specific default template by key
router.get('/defaults/:key', async (req, res) => {
    try {
        const template = await promptService.getDefaultByKey(req.params.key);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json(template);
    } catch (err) {
        console.error('Error fetching template by key:', err);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

// Get default prompt template (model-aware)
router.get('/default', async (req, res) => {
    try {
        const { provider, model } = req.query;
        const prompt = await promptService.getDefaultPrompt(provider || null, model || null);
        res.json(prompt);
    } catch (err) {
        console.error('Error fetching default prompt:', err);
        res.status(500).json({ error: 'Failed to fetch default prompt' });
    }
});

// Get all saved prompt templates
router.get('/', async (req, res) => {
    try {
        const prompts = await promptService.getPrompts();
        res.json(prompts || []);
    } catch (err) {
        console.error('Error fetching prompts:', err);
        res.status(500).json({ error: 'Failed to fetch prompts' });
    }
});

// Save a custom prompt template
router.post('/', async (req, res) => {
    try {
        const { name, promptText } = req.body;
        if (!promptText) {
            return res.status(400).json({ error: 'Prompt text is required' });
        }

        const prompt = await promptService.savePrompt(name || 'Custom Template', promptText);
        res.status(201).json(prompt);
    } catch (err) {
        console.error('Error saving prompt:', err);
        res.status(500).json({ error: 'Failed to save prompt' });
    }
});

// Delete a saved prompt
router.delete('/:id', async (req, res) => {
    try {
        await promptService.deletePrompt(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting prompt:', err);
        res.status(500).json({ error: 'Failed to delete prompt' });
    }
});

module.exports = router;
