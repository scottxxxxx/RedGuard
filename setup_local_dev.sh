#!/bin/bash
set -e

echo "🚀 Setting up RedGuard local development environment..."

# 1. Check Prerequisites
echo "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js (v18+)."
    exit 1
fi
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.10+."
    exit 1
fi
echo "✅ Prerequisites met."

# 2. Server Setup
echo "--------------------------------------------------"
echo "📦 Setting up Server..."
cd server

echo "Installing npm dependencies..."
npm install

echo "Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

echo "Installing Python dependencies (this might take a while)..."
pip install garak requests pyjwt

echo "Generating Prisma Client..."
npx prisma generate

echo "Syncing database schema..."
npx prisma db push

cd ..

# 3. Client Setup
echo "--------------------------------------------------"
echo "💻 Setting up Client..."
cd client

echo "Installing npm dependencies..."
npm install

echo "Configuring environment variables..."
if [ ! -f ".env.local" ]; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api" > .env.local
    echo "✅ Created .env.local"
else
    echo "ℹ️ .env.local already exists, skipping."
fi

cd ..

echo "--------------------------------------------------"
echo "🎉 Setup Complete!"
echo ""
echo "To start development:"
echo "1. Run Server (in one terminal):"
echo "   cd server"
echo "   source venv/bin/activate"
echo "   npm run dev"
echo ""
echo "2. Run Client (in another terminal):"
echo "   cd client"
echo "   npm run dev"
