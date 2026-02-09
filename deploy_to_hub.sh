#!/bin/bash

# Configuration: Set these variables once
DOCKER_HUB_USERNAME="your_username_here"  # CHANGE THIS!
IMAGE_TAG="latest"  # You can change this to versions like "v1.0" if desired

# 1. Login to Docker Hub (if not already logged in)
echo "Ensuring you are logged in to Docker Hub..."
docker login

# 2. Build the Production Images
echo "Building Docker images for production..."
docker compose -f docker-compose.prod.yml build --build-arg DOCKER_HUB_USERNAME=$DOCKER_HUB_USERNAME

# 3. Push to Docker Hub
echo "Pushing images to Docker Hub ($DOCKER_HUB_USERNAME)..."
docker compose -f docker-compose.prod.yml push

echo "Deployment complete! Your images are now available on Docker Hub."
echo "On your GCP server, you can run:"
echo "  export DOCKER_HUB_USERNAME=$DOCKER_HUB_USERNAME"
echo "  docker compose -f docker-compose.prod.yml up -d"
