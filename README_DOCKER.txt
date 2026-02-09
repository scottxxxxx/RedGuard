HOW TO RUN REDGUARD ON ANOTHER MAC
==================================

1. TRANSFER FILES
   Copy the following files/folders to the new machine:
   - redguard_images.tar (The Docker images)
   - docker-compose.yml  (The configuration)
   - server/.env        (Your API keys and secrets - VERY IMPORTANT!)
     ^ You might need to manually create the 'server' folder and put .env inside it.

2. LOAD THE IMAGES
   Open Terminal in the folder where you copied the files and run:
   
   docker load -i redguard_images.tar

3. START THE APP
   Run:
   
   docker-compose up

   Wait for it to say "Server is running on port 3001" and "Ready in ...".

4. OPEN IN BROWSER
   Go to: http://localhost:3000

---
NOTES:
- The database (run history) will be stored in a Docker volume managed by Docker Desktop.
- If you need to stop it, press Ctrl+C in the terminal.
- To run in background, use: docker-compose up -d
