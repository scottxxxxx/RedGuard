# How to Inspect LLM Prompts in Kore.AI XO Platform

## The Problem

You need to see the **exact prompt** sent to the LLM from an Agent Node, including:
- The conversation history (after guardrails filter it)
- The system context
- The full request payload

This is critical for guardrails testing because:
1. Guardrails filter conversation history **before** it's sent to the LLM
2. Prompt injection detection happens on the input
3. You need to verify what actually reaches the LLM vs. what was blocked

---

## Method 1: GenAI Usage Logs (Built-in - RECOMMENDED)

The **LLM and GenAI Usage Logs** show the complete request and response payloads.

### How to Access:
1. Go to **Analytics > Gen AI Analytics > Usage Logs**
2. Click any record to view details

### What You Can See:

#### Summary Tab:
- Feature name (e.g., "Agent Node")
- Model used
- Prompt Name
- Request/Response tokens
- **Guardrails outcome** (Detected/Not Detected)
- Risk Score

#### Payload Details Tab:
| Field | Description |
|-------|-------------|
| **Request Payload** | The FULL prompt sent to the LLM including conversation history |
| **Response Payload** | The LLM's response |
| **Tokens Used** | Token breakdown |
| **Stream** | Whether streaming was used |

### Example Request Payload Structure:
```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant. You do not participate or respond to any abusive language..."
    },
    {
      "role": "user", 
      "content": "Order pizza"
    },
    {
      "role": "assistant",
      "content": "{\"bot\":\"Sure, I can help with that...\"}"
    },
    {
      "role": "user",
      "content": "[THE FILTERED USER MESSAGE - this is where you see what guardrails let through]"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

### API Access to Logs:
```bash
curl --location 'https://{{host}}/1.1/public/bot/{{botId}}/getLLMUsageLogs' \
  --header 'auth: {{YOUR_JWT_ACCESS_TOKEN}}' \
  --header 'Content-Type: application/json' \
  --data '{
    "dateFrom": "2024-03-07",
    "dateTo": "2024-04-26",
    "limit": "50",
    "featureName": ["Agent Node"],
    "isDeveloper": true
  }'
```

---

## Method 2: Debug Logs (Real-time during testing)

### How to Access:
1. Go to **Evaluation > Playground**
2. Start a conversation with your bot
3. View the **Debug Log** panel

### What Debug Logs Show:
- Conversation history sent to LLM
- Intent detection results
- Node execution flow
- **LLM request/response payloads for Dynamic Conversation features**

### Key Documentation Quote:
> "Conversation History Length: This setting allows you to specify the number of recent messages sent to the LLM as context. These messages include both user messages and AI Agent messages. **The default value is 10. This conversation history can be seen from the debug logs.**"

---

## Method 3: Custom Prompt with Logging (Development)

Create a custom prompt that logs the payload before sending to the LLM.

### Steps:
1. Go to **Generative AI Tools > Prompts Library**
2. Click **+ New Prompt**
3. Select **JavaScript** mode
4. Add logging to capture the payload:

```javascript
// Custom prompt with payload logging
let payload = {
  model: context.model || "gpt-4",
  messages: []
};

// Add system context
payload.messages.push({
  role: "system",
  content: context.systemContext
});

// Add conversation history (THIS IS WHAT GUARDRAILS FILTER)
if (context.conversationHistory) {
  context.conversationHistory.forEach(msg => {
    payload.messages.push({
      role: msg.role,
      content: msg.content
    });
  });
}

// Add current user message
payload.messages.push({
  role: "user",
  content: context.currentUserMessage
});

// LOG THE FULL PAYLOAD FOR INSPECTION
console.log("=== LLM REQUEST PAYLOAD ===");
console.log(JSON.stringify(payload, null, 2));

// Store in context for later retrieval
context.session.llmPayloadLog = payload;

return payload;
```

### Access the logged payload:
- Check **Task Execution Logs** under Analytics
- Or retrieve from `context.session.llmPayloadLog` in subsequent nodes

---

## Method 4: BotKit SDK Interception

The BotKit SDK can intercept messages, but has **limitations with LLM interactions**.

### What BotKit CAN Do:
- Intercept `onUserMessage` - see user input before processing
- Intercept `onBotMessage` - see bot response before delivery
- Intercept `on_webhook` - see webhook node payloads

### What BotKit CANNOT Do:
- **Cannot intercept streamed LLM responses** (documented limitation)
- Cannot directly intercept the LLM API call itself
- Cannot see guardrail-filtered content in transit

### BotKit Setup for Message Interception:

```javascript
// botkit.js
module.exports = {
  botId: "your-bot-id",
  botName: "your-bot-name",
  
  on_user_message: function(requestId, data, callback) {
    // Log the raw user message BEFORE it hits guardrails
    console.log("=== RAW USER INPUT ===");
    console.log(JSON.stringify(data, null, 2));
    
    // Store for comparison
    data.context.session.rawUserInput = data.message;
    
    // Pass to platform
    return sdk.sendBotMessage(data, callback);
  },
  
  on_bot_message: function(requestId, data, callback) {
    // Log the bot response
    console.log("=== BOT RESPONSE ===");
    console.log(JSON.stringify(data, null, 2));
    
    // Check context for LLM payload if we stored it
    if (data.context && data.context.session && data.context.session.llmPayloadLog) {
      console.log("=== LLM PAYLOAD THAT WAS SENT ===");
      console.log(JSON.stringify(data.context.session.llmPayloadLog, null, 2));
    }
    
    return sdk.sendUserMessage(data, callback);
  },
  
  on_webhook: function(requestId, data, componentId, callback) {
    // Log webhook data
    console.log("=== WEBHOOK DATA ===");
    console.log("Component:", componentId);
    console.log("Data:", JSON.stringify(data, null, 2));
    
    callback(null, data);
  }
};
```

### BotKit Limitations for Your Use Case:
> "When BotKit is enabled, interception of streamed response messages isn't supported due to the real-time delivery process."
> 
> "Guardrails aren't supported in streaming mode, as content moderation typically requires full-context evaluation."

**This means**: If you're using streaming responses, you cannot intercept with BotKit AND guardrails won't work anyway.

---

## Method 5: Custom LLM Proxy (Most Control)

Route LLM calls through your own proxy server to capture everything.

### Architecture:
```
User → Kore.AI → Your Proxy → OpenAI/Azure
                    ↓
              Log everything
```

### Setup:
1. Create a proxy server that logs all requests
2. Configure Kore.AI to use Custom LLM Integration
3. Point the endpoint to your proxy

### Proxy Server Example (Node.js):
```javascript
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());

const REAL_LLM_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const LOG_FILE = './llm_requests.jsonl';

app.post('/v1/chat/completions', async (req, res) => {
  const timestamp = new Date().toISOString();
  
  // LOG THE FULL REQUEST (this is what you want!)
  const logEntry = {
    timestamp,
    request: {
      headers: req.headers,
      body: req.body  // Contains messages array with conversation history
    }
  };
  
  console.log("=== INTERCEPTED LLM REQUEST ===");
  console.log(JSON.stringify(req.body, null, 2));
  
  // Check for prompt injection attempts in the filtered history
  const messages = req.body.messages || [];
  messages.forEach((msg, idx) => {
    console.log(`Message ${idx} (${msg.role}): ${msg.content.substring(0, 100)}...`);
  });
  
  try {
    // Forward to real LLM
    const response = await axios.post(REAL_LLM_ENDPOINT, req.body, {
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json'
      }
    });
    
    // Log response
    logEntry.response = response.data;
    fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
    
    res.json(response.data);
  } catch (error) {
    logEntry.error = error.message;
    fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('LLM Proxy running on port 3000');
});
```

### Configure in Kore.AI:
1. Go to **Generative AI Tools > Models Library**
2. Click **Custom LLM**
3. Set endpoint to your proxy: `https://your-proxy.com/v1/chat/completions`
4. Configure authentication to pass through

---

## Method 6: Test Mode in Prompt Editor

When creating/editing prompts, you can test and see the exact payload.

### Steps:
1. Go to **Generative AI Tools > Prompts Library**
2. Select or create a prompt
3. Enter **Sample Context Values**
4. Click **Test**
5. View the JSON request that would be sent to the LLM

This shows you the exact structure but with test values, not live conversation data.

---

## Comparison: Which Method to Use?

| Method | See Live Prompts | See Guardrail Effects | Effort | Real-time |
|--------|------------------|----------------------|--------|-----------|
| **GenAI Usage Logs** | ✅ Yes | ✅ Yes | Low | After-the-fact |
| **Debug Logs** | ✅ Yes | ✅ Yes | Low | Real-time |
| **Custom Prompt Logging** | ✅ Yes | ✅ Yes | Medium | Real-time |
| **BotKit SDK** | ⚠️ Limited | ❌ No (can't see filtered) | High | Real-time |
| **LLM Proxy** | ✅ Yes | ✅ Yes | High | Real-time |
| **Prompt Editor Test** | ❌ Test only | ❌ No | Low | N/A |

---

## Recommended Approach for Guardrails Testing

### For Testing Guardrails:

1. **Use GenAI Usage Logs API** to programmatically fetch LLM request payloads
2. Compare the **Request Payload** conversation history against raw input
3. Check **Guardrails > Outcome** field for detection results
4. Check **Risk Score** for prompt injection confidence

### Workflow:
```
1. Send test attack prompt to bot
2. Wait for processing
3. Query getLLMUsageLogs API
4. Extract request payload
5. Compare: 
   - Was the attack present in the payload? → Guardrail failed
   - Was the attack blocked/modified? → Guardrail worked
   - Check "Outcome" field for detection status
```

### Integration with Your Testing Tool:

```python
import requests
import json

class KoreAIPromptInspector:
    def __init__(self, host, bot_id, jwt_token):
        self.host = host
        self.bot_id = bot_id
        self.headers = {
            'auth': jwt_token,
            'Content-Type': 'application/json'
        }
    
    def get_llm_logs(self, date_from, date_to, limit=50):
        """Fetch LLM usage logs including full request payloads"""
        url = f"https://{self.host}/1.1/public/bot/{self.bot_id}/getLLMUsageLogs"
        
        payload = {
            "dateFrom": date_from,
            "dateTo": date_to,
            "limit": str(limit),
            "featureName": ["Agent Node"],
            "isDeveloper": True
        }
        
        response = requests.post(url, headers=self.headers, json=payload)
        return response.json()
    
    def analyze_guardrail_effectiveness(self, logs):
        """Analyze whether guardrails blocked attacks"""
        results = []
        
        for log in logs:
            result = {
                'timestamp': log.get('start Date'),
                'guardrails_configured': log.get('Configured Guardrails', []),
                'outcome': log.get('Outcome'),
                'risk_score': log.get('Risk Score', 0),
                'request_payload': log.get('Request Payload'),
                'prompt_injection_detected': log.get('Outcome') == 'Detected'
            }
            
            # Extract conversation history from request payload
            if result['request_payload']:
                messages = result['request_payload'].get('messages', [])
                result['conversation_sent_to_llm'] = messages
                
                # Check if attack patterns made it through
                user_messages = [m['content'] for m in messages if m['role'] == 'user']
                result['user_messages_to_llm'] = user_messages
            
            results.append(result)
        
        return results
```

---

## Key Insights for Your Testing Tool

1. **GenAI Usage Logs contain the FULL request payload** - this is the definitive source for what was sent to the LLM after guardrails processing

2. **The guardrails filter happens BEFORE the payload is constructed** - so the Request Payload in logs shows post-filtering content

3. **BotKit cannot see the LLM call itself** - it only sees user/bot messages, not the internal LLM API call

4. **Streaming mode bypasses guardrails** - if streaming is enabled, guardrails don't work

5. **The `Conversation History Length` setting determines how many messages go to the LLM** - default is 10

6. **Custom prompts give you more visibility** - you can add logging within the prompt JavaScript
