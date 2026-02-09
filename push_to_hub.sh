#!/bin/bash

# Ask for Docker Hub Username
read -p "Enter your Docker Hub username: " DOCKER_USER

if [ -z "$DOCKER_USER" ]; then
    echo "Username is required!"
    exit 1
fi

echo "--- Logging in to Docker Hub ---"
docker login

echo "--- Tagging Images ---"
docker tag redguard-client:latest $DOCKER_USER/redguard-client:latest
docker tag redguard-server:latest $DOCKER_USER/redguard-server:latest

echo "--- Pushing Images to Docker Hub ---"
docker push $DOCKER_USER/redguard-client:latest
docker push $DOCKER_USER/redguard-server:latest

echo "--- DONE! ---"
echo "On the other machine, use 'docker-compose-hub.yml' but replace YOUR_DOCKERHUB_USERNAME with $DOCKER_USER"
