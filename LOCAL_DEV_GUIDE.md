# Local Development Guide

Running RedGuard locally (without Docker) is significantly faster on macOS due to avoided filesystem overhead.

Follow these steps to set up your local environment.

## Prerequisites
- Node.js (v18+)
- Python 3.10+
- npm

## 1. Server Setup

Navigate to the server directory:
```bash
cd server
```

### Install Node Dependencies
```bash
npm install
```

### Setup Python Environment (for Garak)
Create a virtual environment and install dependencies:
```bash
python3 -m venv venv
source venv/bin/activate
pip install garak requests pyjwt
```

### Database Setup
The server is configured to use the SQLite database at `server/dev.db`.

Generate the Prisma client for your local OS:
```bash
npx prisma generate
```

**REQUIRED**: Sync the database schema with Prisma (creates missing tables):
```bash
npx prisma db push
```
*Note: If you get errors about missing tables (e.g., `api_logs does not exist`), run this command.*

### Start the Server
Make sure the virtual environment is active (`source venv/bin/activate`), then:
```bash
npm run dev
```
The server will run on [http://localhost:3001](http://localhost:3001).

## 2. Client Setup

Open a new terminal tab and navigate to the client directory:
```bash
cd client
```

### Install Dependencies
```bash
npm install
```

### Environment Variables
Create a `.env.local` file in the `client` directory with the following content:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```
(Previously in Docker, this might have been set via `docker-compose.yml`. For local dev, we set it explicitly here.)

### Start the Client
```bash
npm run dev
```
The client will run on [http://localhost:3000](http://localhost:3000).

## Troubleshooting
- **Port Conflicts**: Ensure Docker is stopped (`docker-compose down`) so ports 3000 and 3001 are free.
- **Python Errors**: If Garak fails to run, ensure you have activated the virtual environment in the server terminal before running `npm run dev`.
