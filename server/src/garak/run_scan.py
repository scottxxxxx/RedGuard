import sys
import os
import json
import argparse
import subprocess
import time

# Mapping of Guardrails to Garak Probes
# This allows selecting a "high level" test category and running relevant probes
GUARDRAIL_PROBE_MAPPING = {
    "restrict_toxicity": [
        "toxicity",  # Runs all toxicity probes
        "realtoxicityprompts",
        "continuation"
    ],
    "blacklist_topics": [
        "donotanswer", 
        "lmrc.Slurs", 
        "lmrc.Profanity"
    ],
    "prompt_injection": [
        "dan",      # Do Anything Now jailbreaks
        "encoding", # Base64, etc.
        "promptinject",
        "gcg",      # Gradient based attacks
        "jailbreak"
    ],
    "filter_responses": [
        "continuation",
        "knownbadsignatures" 
    ],
    "hallucination": [
        "snowball",
        "misleading"
    ],
    "all": [
        "toxicity", "dan", "encoding", "promptinject", "donotanswer"
    ]
}

def run_garak_scan(config, guardrail_type):
    """
    Executes Garak CLI for the specified guardrail type
    """
    
    # 1. Select Probes
    probes = GUARDRAIL_PROBE_MAPPING.get(guardrail_type, [])
    if not probes:
        print(f"Error: No probes defined for guardrail type '{guardrail_type}'")
        return
        
    print(f"Starting Garak Scan for '{guardrail_type}' with probes: {probes}")
    
    results = []
    
    # Set environment variables for the custom generator
    env = os.environ.copy()
    env["KORE_WEBHOOK_URL"] = config["webhook_url"]
    env["KORE_CLIENT_ID"] = config["client_id"]
    env["KORE_CLIENT_SECRET"] = config["client_secret"]
    env["KORE_BOT_ID"] = config["bot_id"]
    
    # Ideally we'd set PYTHONPATH to include the current directory so garak can find the generator
    # Assuming run_scan.py is in server/src/garak/
    # We want to be able to import 'kore_generator'
    current_dir = os.path.dirname(os.path.abspath(__file__))
    env["PYTHONPATH"] = current_dir + os.pathsep + env.get("PYTHONPATH", "")
    
    # 2. Run Garak for each probe category
    # We run them sequentially to avoid overwhelming the bot or system
    timestamp = int(time.time())
    
    for probe in probes:
        report_prefix = f"garak_report_{guardrail_type}_{probe}_{timestamp}"
        
        cmd = [
            sys.executable, "-m", "garak",
            "--model_type", "custom",
            "--model_name", "kore_generator.KoreAIWebhookGenerator",
            "--probes", probe,
            "--report_prefix", report_prefix,
            "--generations", "1", # 1 generation per prompt to save time/tokens
            "--parallel_requests", "1" # Sequential to valid rate limits
        ]
        
        print(f"Running probe: {probe}...")
        try:
            # We capture output to avoid cluttering stdout, but print progress
            result = subprocess.run(
                cmd, 
                env=env, 
                capture_output=True, 
                text=True
            )
            
            if result.returncode != 0:
                print(f"Error running probe {probe}: {result.stderr}")
                results.append({"probe": probe, "status": "error", "error": result.stderr})
            else:
                # Garak generates a JSONL report. We should parse it or just link to it.
                # For this MVP, we just note success.
                print(f"Probe {probe} completed successfully.")
                results.append({"probe": probe, "status": "completed", "report": f"{report_prefix}.report.jsonl"})
                
        except Exception as e:
            print(f"Exception invoking garak: {str(e)}")
            results.append({"probe": probe, "status": "exception", "error": str(e)})

    # 3. Summary
    print(json.dumps({"scan_summary": results}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Garak Security Scan")
    parser.add_argument("--url", required=True, help="Kore.AI Webhook URL")
    parser.add_argument("--client_id", required=True)
    parser.add_argument("--client_secret", required=True)
    parser.add_argument("--bot_id", required=True)
    parser.add_argument("--guardrail", required=True, help="Guardrail type to test (e.g. restrict_toxicity)")
    
    args = parser.parse_args()
    
    config = {
        "webhook_url": args.url,
        "client_id": args.client_id,
        "client_secret": args.client_secret,
        "bot_id": args.bot_id
    }
    
    run_garak_scan(config, args.guardrail)
