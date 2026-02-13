# Use Debian-based image for better Python/ML support
FROM node:20-bullseye-slim

WORKDIR /app

# Install Python 3 and basic build tools
# Removed rustc/cargo as they are huge, prone to failure, and not needed for basic scripts
RUN apt-get update --fix-missing && apt-get install -y \
    python3 \
    python3-pip \
    git \
    build-essential \
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
