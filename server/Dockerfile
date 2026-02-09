# Use Debian-based image for better Python/ML support (Garak needs this)
FROM node:22-bullseye-slim

WORKDIR /app

# Install Python 3 and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    build-essential \
    rustc \
    cargo \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Garak and dependencies
# Using pipx or direct pip. Garak is large, so this build step will take time.
# Upgrade pip, setuptools, wheel first to avoid build errors
RUN python3 -m pip install --upgrade pip setuptools wheel

# Install Garak and dependencies
# Installation can be heavy, increasing build time
# TEMPORARY: Commented out due to base2048 build failure. 
# Providing curated prompts via fallback instead.
# RUN python3 -m pip install --no-cache-dir garak pyjwt requests
RUN python3 -m pip install --no-cache-dir pyjwt requests

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
