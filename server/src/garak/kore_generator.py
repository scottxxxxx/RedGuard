import os
import sys
import json
import requests
import jwt
import uuid
from typing import List

try:
    from garak.generators.base import Generator
except ImportError:
    # Fallback for when garak is not installed (dev mode)
    class Generator:
        def __init__(self, name="", generations=1):
            self.name = name
            self.generations = generations

class KoreAIWebhookGenerator(Generator):
    """
    Garak generator for Kore.AI XO Platform Webhook API.
    Connects Garak's attack probes to a Kore.AI bot instance.
    """
    
    def __init__(self, name="koreai", generations=1):
        super().__init__(name=name, generations=generations)
        
        # Load config from params or environment variables
        self.webhook_url = os.environ.get("KORE_WEBHOOK_URL")
        self.client_id = os.environ.get("KORE_CLIENT_ID")
        self.client_secret = os.environ.get("KORE_CLIENT_SECRET")
        self.bot_id = os.environ.get("KORE_BOT_ID")

        if not all([self.webhook_url, self.client_id, self.client_secret, self.bot_id]):
            raise ValueError("Missing Kore.AI configuration. Set KORE_WEBHOOK_URL, KORE_CLIENT_ID, KORE_CLIENT_SECRET, KORE_BOT_ID environment variables.")

        self.jwt_token = self._generate_jwt()
        print(f"Initialized KoreAIWebhookGenerator for bot: {self.bot_id}")

    def _generate_jwt(self):
        """Generates a JWT token for Kore.AI authentication"""
        payload = {
            "appId": self.client_id,
            "sub": "garak-tester"
        }
        return jwt.encode(payload, self.client_secret, algorithm="HS256")

    def generate(self, prompt: str) -> List[str]:
        """
        Send a prompt (attack) to Kore.AI and return the response.
        Garak calls this method to test the bot.
        """
        try:
            payload = {
                "session": {"new": False},
                "message": {"type": "text", "val": prompt},
                "from": {"id": f"garak_user_{str(uuid.uuid4())[:8]}"},
                "to": {"id": self.bot_id}
            }
            
            headers = {
                "Authorization": f"Bearer {self.jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                self.webhook_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code != 200:
                # If the API fails, return a string that won't trigger success
                print(f"Error calling Kore.AI: {response.status_code}")
                return [f"<API_ERROR: {response.status_code}>"]
                
             # Parse response (Kore.AI specific structure)
            data = response.json()
            text_response = ""
            
            if "text" in data:
                text_response = data["text"]
            elif "data" in data and isinstance(data["data"], list) and len(data["data"]) > 0:
                text_response = data["data"][0].get("val", "")
            else:
                text_response = json.dumps(data) 
                
            return [text_response]

        except Exception as e:
            print(f"Exception during generation: {str(e)}")
            return [f"<EXCEPTION: {str(e)}>"]
