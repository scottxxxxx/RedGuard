#!/bin/bash

# Configuration from server/.env (or defaults)
# Using values found in your server/.env for convenience
# These are likely your test bot credentials
# Load from environment: export KORE_HOST, BOT_ID, CLIENT_ID, CLIENT_SECRET before running
# Or create a .env file and source it: source server/.env
KORE_HOST="${KORE_HOST:-platform.kore.ai}"
BOT_ID="${BOT_ID:?Error: BOT_ID not set}"
CLIENT_ID="${CLIENT_ID:?Error: CLIENT_ID not set}"
CLIENT_SECRET="${CLIENT_SECRET:?Error: CLIENT_SECRET not set}"

# Function to generate JWT using Python (requires python3 and pyjwt)
generate_jwt() {
    python3 << EOF
import jwt
import time
import sys

try:
    payload = {
        'sub': '${CLIENT_ID}',
        'iat': int(time.time()),
        'exp': int(time.time()) + 3600,
        'aud': 'https://idproxy.kore.ai/authorize',
        'iss': '${CLIENT_ID}',
        'appId': '${CLIENT_ID}'
    }
    token = jwt.encode(payload, '${CLIENT_SECRET}', algorithm='HS256')
    print(token)
except Exception as e:
    print(f"Error generating JWT: {e}", file=sys.stderr)
    sys.exit(1)
EOF
}

echo "Generating JWT..."
JWT_TOKEN=$(generate_jwt)

if [ -z "$JWT_TOKEN" ]; then
    echo "Failed to generate JWT. Ensure python3 and pyjwt are installed (pip install pyjwt)."
    exit 1
fi

echo "JWT Generated successfully."
echo "-----------------------------------"

# Step 1: Initiate Export
echo "Step 1: Initiating Bot Export..."
EXPORT_URL="https://${KORE_HOST}/api/public/bot/${BOT_ID}/export"

RESPONSE=$(curl -s -X POST "${EXPORT_URL}" \
  --header "auth: ${JWT_TOKEN}" \
  --header "Content-Type: application/json" \
  --data '{
    "exportType": "published"
  }')

echo "Response: $RESPONSE"

# Extract Export ID (using grep/sed/awk since jq might not be installed, though jq is preferred)
# Ideally use jq: EXPORT_ID=$(echo "$RESPONSE" | jq -r '.exportId // ._id')
if command -v jq &> /dev/null; then
    EXPORT_ID=$(echo "$RESPONSE" | jq -r '.exportId // ._id')
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.errors[0].msg // .message // empty')
else
    # Fallback to simple extraction
    EXPORT_ID=$(echo "$RESPONSE" | grep -o '"exportId":"[^"]*"' | cut -d'"' -f4)
    if [ -z "$EXPORT_ID" ]; then
        EXPORT_ID=$(echo "$RESPONSE" | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)
    fi
fi

if [ -z "$EXPORT_ID" ] || [ "$EXPORT_ID" == "null" ]; then
    echo "Failed to get Export ID."
    if [ -n "$ERROR_MSG" ]; then
        echo "Error: $ERROR_MSG"
    fi
    exit 1
fi

echo "Export ID: $EXPORT_ID"
echo "-----------------------------------"

# Step 2: Poll Status
# Step 2: Poll Status
echo "Step 2: Polling Export Status..."
echo "Waiting 30 seconds for initial processing..."
sleep 30

MAX_RETRIES=60 # 60 * 10s = 600s (10 minutes)
COUNT=0

while [ $COUNT -lt $MAX_RETRIES ]; do
    # Try multiple variations to find the working endpoint
    FOUND_STATUS=false
    
    # List of URL patterns to try
    URLS=(
        "https://${KORE_HOST}/api/public/bot/${BOT_ID}/export/status?exportId=${EXPORT_ID}"
        "https://${KORE_HOST}/api/public/bot/${BOT_ID}/export/status?id=${EXPORT_ID}"
        "https://${KORE_HOST}/api/public/bot/${BOT_ID}/export/status"
        "https://bots.kore.ai/api/public/bot/${BOT_ID}/export/status?exportId=${EXPORT_ID}"
    )

    # Verbose debug for first attempt
    echo "DEBUG: Trying documented endpoint (status?exportId)..."
    curl -v -X GET "${URLS[0]}" --header "auth: ${JWT_TOKEN}" --header "Content-Type: application/json" > /dev/null

    for TEST_URL in "${URLS[@]}"; do
        STATUS_RES=$(curl -s -X GET "${TEST_URL}" --header "auth: ${JWT_TOKEN}" --header "Content-Type: application/json")
        
        # Check if response is valid JSON and not an error
        if [[ "$STATUS_RES" == *"error"* ]] || [[ "$STATUS_RES" == *"404"* ]] || [[ "$STATUS_RES" == *"405"* ]]; then
            echo "Failed: $TEST_URL -> (Error response)"
            continue
        else
            # Looks like a valid response (contains status or fileId)
            if [[ "$STATUS_RES" == *"status"* ]] || [[ "$STATUS_RES" == *"exportStatus"* ]]; then
                echo "SUCCESS: Found valid endpoint: $TEST_URL"
                STATUS_URL="$TEST_URL" # Remember this one? simplified logic: just use result
                FOUND_STATUS=true
                break
            fi
        fi
    done
    
    if [ "$FOUND_STATUS" = false ]; then
        echo "All endpoints failed. Retrying..."
        STATUS="null"
        if command -v jq &> /dev/null; then
            STATUS=$(echo "$STATUS_RES" | jq -r '.status // .exportStatus')
        else
            STATUS=$(echo "$STATUS_RES" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            if [ -z "$STATUS" ]; then STATUS=$(echo "$STATUS_RES" | grep -o '"exportStatus":"[^"]*"' | cut -d'"' -f4); fi
        fi
    fi

    echo "Attempt $((COUNT+1)): Status = $STATUS"
    
    if [ "$STATUS" == "success" ] || [ "$STATUS" == "completed" ]; then
        if command -v jq &> /dev/null; then
            DOWNLOAD_URL=$(echo "$STATUS_RES" | jq -r '.downloadURL // .fileId')
        else
             # Try to extract URL if jq missing
             DOWNLOAD_URL=$(echo "$STATUS_RES" | grep -o '"downloadURL":"[^"]*"' | cut -d'"' -f4)
        fi
        
        echo "Export Completed! Download URL: $DOWNLOAD_URL"
        
        # Step 3: Download
        if [ -n "$DOWNLOAD_URL" ] && [ "$DOWNLOAD_URL" != "null" ]; then
            echo "-----------------------------------"
            echo "Step 3: Downloading Bot Definition..."
            curl -s -X GET "$DOWNLOAD_URL" --header "auth: ${JWT_TOKEN}" -o bot_export.json
            echo "Bot definition saved to bot_export.json"
            
            # Verify file size
            FILESIZE=$(wc -c < "bot_export.json")
            echo "File size: $FILESIZE bytes"
        else
            echo "Error: Download URL not found in response."
        fi
        exit 0
    elif [ "$STATUS" == "failed" ] || [ "$STATUS" == "error" ]; then
        echo "Export Failed."
        echo "$STATUS_RES"
        exit 1
    fi
    
    COUNT=$((COUNT+1))
    echo "Waiting 10 seconds..."
    sleep 10
done

echo "Timed out waiting for export."
exit 1
