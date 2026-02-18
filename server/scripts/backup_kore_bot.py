import requests
import jwt
import time
import os
import sys
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

# Configuration
# Prefer defaults if not set in .env, but usually they are there.
KORE_PLATFORM_HOST = "platform.kore.ai"
KORE_BOTS_HOST = "bots.kore.ai" # The status endpoint seems to work here or specifically needs this host
BOT_ID = os.getenv("KORE_BOT_ID", "***REMOVED_KORE_BOT_ID***")
CLIENT_ID = os.getenv("KORE_CLIENT_ID", "***REMOVED_KORE_CLIENT_ID***")
CLIENT_SECRET = os.getenv("KORE_CLIENT_SECRET", "***REMOVED_SECRET***")

def generate_jwt():
    try:
        payload = {
            'sub': CLIENT_ID,
            'iat': int(time.time()),
            'exp': int(time.time()) + 3600,
            'aud': 'https://idproxy.kore.ai/authorize',
            'iss': CLIENT_ID,
            'appId': CLIENT_ID
        }
        token = jwt.encode(payload, CLIENT_SECRET, algorithm='HS256')
        return token
    except Exception as e:
        print(f"Error generating JWT: {e}")
        sys.exit(1)

def initiate_export(token):
    url = f"https://{KORE_PLATFORM_HOST}/api/public/bot/{BOT_ID}/export"
    headers = {
        "auth": token,
        "Content-Type": "application/json"
    }
    data = {"exportType": "published"}
    
    print(f"Initiating export at {url}...")
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        export_id = result.get('exportId') or result.get('_id')
        if not export_id:
            print("Error: No exportId in response")
            print(result)
            sys.exit(1)
        print(f"Export initialized. ID: {export_id}")
        return export_id
    except Exception as e:
        print(f"Failed to initiate export: {e}")
        if 'response' in locals():
            print(response.text)
        sys.exit(1)

def check_status(token, export_id):
    # Based on findings: Status check works best on specific endpoint with exportId param
    # Testing indicates bots.kore.ai might be the robust host for this, or the path /export/status?exportId=...
    
    # We will try the path that worked in the shell script's final successful run
    url = f"https://{KORE_BOTS_HOST}/api/public/bot/{BOT_ID}/export/status"
    params = {"exportId": export_id}
    headers = {
        "auth": token,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        
        # Handle 404/405 gracefully by trying alternative if needed, but let's stick to what likely worked
        if response.status_code in [404, 405]:
            # Fallback to platform host if bots host fails?
            url_alt = f"https://{KORE_PLATFORM_HOST}/api/public/bot/{BOT_ID}/export/status"
            response = requests.get(url_alt, headers=headers, params=params)
            
        return response.json()
    except Exception as e:
        print(f"Status check failed: {e}")
        return None

def download_file(token, download_url, output_path="bot_export.zip"):
    headers = {"auth": token}
    print(f"Downloading from {download_url}...")
    try:
        response = requests.get(download_url, headers=headers, stream=True)
        response.raise_for_status()
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Download completed: {output_path}")
        print(f"File size: {os.path.getsize(output_path)} bytes")
    except Exception as e:
        print(f"Download failed: {e}")

def main():
    print("Starting Kore.ai Bot Backup Microservice...")
    token = generate_jwt()
    
    # 1. Initiate
    export_id = initiate_export(token)
    
    # 2. Poll
    print("Waiting 30 seconds for initial processing...")
    time.sleep(30)
    
    max_retries = 60
    for i in range(max_retries):
        status_res = check_status(token, export_id)
        if status_res:
            status = status_res.get('status') or status_res.get('exportStatus')
            print(f"Poll {i+1}: Status = {status}")
            
            if status in ['success', 'completed']:
                download_url = status_res.get('downloadURL') or status_res.get('fileId')
                if download_url:
                    # 3. Download
                    download_file(token, download_url)
                    return
                else:
                    print("Error: Success status but no download URL")
                    return
            elif status in ['failed', 'error']:
                print(f"Export failed: {status_res}")
                return
        else:
            print(f"Poll {i+1}: Status request failed.")
            
        time.sleep(10)
        
    print("Timed out waiting for export.")

if __name__ == "__main__":
    main()
