# RedGuard Garak Integration

This module allows running NVIDIA Garak security scans against your Kore.AI bot.

## Prerequisites

You must have Python 3 installed. You also need to install the required Python packages.

### 1. Create a Virtual Environment (Optional but Recommended)
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies
Run this command in the `server` directory (or wherever you manage python deps):

```bash
pip install garak requests pyjwt
```

*Note: installing `garak` can take a while as it pulls in PyTorch and other ML libraries.*

## How it Works

The `kore_generator.py` script adapts Garak's `Generator` class to talk to your bot via Webhook. RedGuard spawns a Garak process using this generator to run specific probes.

## Docker Usage

The Docker container (`redguard-server`) comes with Python 3, `requests`, and `pyjwt` pre-installed. However, due to large dependencies (PyTorch) and build complexities, **Garak might need manual installation** inside the container.

### Step 1: Open Terminal inside Container
```bash
docker exec -it redguard-server-1 bash
```

### Step 2: Manually Install Garak
Inside the container, run:
```bash
# Try standard install first
pip install garak

# If that fails (due to base2048/Rust issues), try upgrading tools first:
pip install --upgrade pip setuptools wheel
pip install garak
```

If installation succeeds, you don't need to do anything else. The "Security Scan" feature in the web UI will start working.

### Step 3: Verify Install
```bash
python3 -m garak --version
```

## Running Scans via UI
1. Go to **Security Scan** tab in RedGuard UI (http://localhost:3000).
2. Select a test suite (e.g. "Restricted Topics").
3. Click **Run Security Scan**.
4. Watch the progress logs in real-time.

## Manual Testing (CLI)
You can run scans manually from your host machine if you have Python setup:
```bash
cd server/src/garak
export KORE_WEBHOOK_URL="your-url"
export KORE_CLIENT_ID="your-id"
export KORE_CLIENT_SECRET="your-secret"
export KORE_BOT_ID="your-bot-id"

python3 run_scan.py --url $KORE_WEBHOOK_URL \
  --client_id $KORE_CLIENT_ID --client_secret $KORE_CLIENT_SECRET --bot_id $KORE_BOT_ID \
  --guardrail restrict_toxicity
```
