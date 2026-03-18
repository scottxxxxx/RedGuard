import { test, expect } from '@playwright/test';

test('homepage loads and displays RedGuard title', async ({ page }) => {
    // Navigate to the app (assuming it's running on localhost:3000)
    await page.goto('/');

    // Check that the page title contains RedGuard or a core text
    await expect(page).toHaveTitle(/RedGuard/i);
});

test('bot connection pane is visible', async ({ page }) => {
    await page.goto('/');

    // A basic locator checking for the text "Connect Bot".
    // This helps confirm that the UI initialized successfully.
    await expect(page.locator('text=Connect Bot')).toBeVisible();
});
