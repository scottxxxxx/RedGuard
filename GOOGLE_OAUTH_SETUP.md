# Google OAuth Setup Guide

## Quick Setup (5 minutes)

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 2. Create or Select a Project
- Click the project dropdown at the top
- Either select an existing project or create a new one called "RedGuard"

### 3. Enable Google+ API
1. Go to: https://console.cloud.google.com/apis/library
2. Search for "Google+ API"
3. Click on it and click "ENABLE"

### 4. Configure OAuth Consent Screen
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Select "External" user type → Click "CREATE"
3. Fill in required fields:
   - **App name:** RedGuard
   - **User support email:** (your email)
   - **Developer contact email:** (your email)
4. Click "SAVE AND CONTINUE" through the remaining steps
5. On "Test users" page, click "ADD USERS" and add your Gmail address
6. Click "SAVE AND CONTINUE" → "BACK TO DASHBOARD"

### 5. Create OAuth 2.0 Credentials
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Select Application type: **Web application**
4. Name: **RedGuard Web Client**
5. Under "Authorized redirect URIs", click "+ ADD URI" and add:
   - `http://localhost:3000/api/auth/callback/google`
   - `http://***REMOVED_IP***/api/auth/callback/google`
6. Click "CREATE"
7. Copy the **Client ID** and **Client Secret**

### 6. Update Your .env.local File
Open `/client/.env.local` and replace the placeholders:

```env
GOOGLE_CLIENT_ID=your-actual-client-id-from-step-5
GOOGLE_CLIENT_SECRET=your-actual-client-secret-from-step-5
```

### 7. Restart Your Dev Server
```bash
# Stop your dev server (Ctrl+C)
# Start it again
cd client
npm run dev
```

### 8. Test It!
1. Go to http://localhost:3000
2. You should see a "Sign in with Google" button
3. Click it and sign in with your Gmail
4. Your email will be your user ID, and evaluation history will persist!

## Production Deployment

When deploying to GCP, you'll need to set the same environment variables on your server:

```bash
# On your GCP VM or in deployment config
GOOGLE_CLIENT_ID=same-as-above
GOOGLE_CLIENT_SECRET=same-as-above
NEXTAUTH_SECRET=***REMOVED_SECRET***
NEXTAUTH_URL=http://***REMOVED_IP***
```

## Troubleshooting

**"Access blocked: This app's request is invalid"**
- Make sure you added yourself as a test user in OAuth consent screen

**"Redirect URI mismatch"**
- Double-check the redirect URI exactly matches: `http://localhost:3000/api/auth/callback/google`
- No trailing slash, must be exact

**"Sign in button doesn't appear"**
- Check browser console for errors
- Make sure .env.local is in the `/client` directory
- Restart dev server after changing .env.local
