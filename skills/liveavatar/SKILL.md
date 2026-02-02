---
name: liveavatar
description: Talk to your OpenClaw agent face-to-face with a real-time AI avatar
user-invocable: true
metadata: {"openclaw":{"emoji":"🎭","requires":{"bins":["node","npm"]},"install":[{"id":"npm","kind":"npm","package":"openclaw-liveavatar","bins":[],"label":"Install OpenClaw LiveAvatar"}]}}
---

# OpenClaw LiveAvatar

Give your OpenClaw agent a face and voice! This skill launches a real-time AI avatar that you can talk to naturally using your microphone. The avatar listens to you, sends your speech to your OpenClaw agent, and speaks the response back with lip-synced video.

## What You'll Need

1. **LiveAvatar API Key** - Get one free at https://app.liveavatar.com/developers
2. **OpenClaw Gateway** running locally (default: ws://127.0.0.1:18789)

## Quick Start

When the user runs `/liveavatar`, follow these steps:

### Step 1: Check for API Key

First, check if a LiveAvatar API key is configured:

```bash
# Check if the key exists in environment or OpenClaw config
grep -q "LIVEAVATAR_API_KEY" ~/.openclaw/openclaw.json 2>/dev/null || echo "NOT_FOUND"
```

If NOT_FOUND, ask the user:

> I need your LiveAvatar API key to continue. You can get a free one at:
> https://app.liveavatar.com/developers
>
> Please paste your API key:

Store the key in the user's OpenClaw config for future use.

### Step 2: Clone and Setup

```bash
# Clone the repository if not present
if [ ! -d ~/.openclaw/extensions/liveavatar ]; then
  git clone https://github.com/openclaw/openclaw-liveavatar.git ~/.openclaw/extensions/liveavatar
fi

cd ~/.openclaw/extensions/liveavatar

# Install dependencies
npm install
```

### Step 3: Configure Environment

Create `.env.local` with the API key:

```bash
cat > .env.local << EOF
LIVEAVATAR_API_KEY=<user's API key>
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
EOF
```

### Step 4: Start the Application

```bash
npm run dev
```

### Step 5: Open in Browser

Tell the user:

> Your OpenClaw LiveAvatar is starting!
> Open http://localhost:3001 in your browser to talk to your agent.
>
> Tips:
> - Select your microphone from the dropdown
> - Click the green mic button to start speaking
> - The avatar will respond with your agent's answers
> - Click the red X to end the session

## How It Works

```
You speak → LiveAvatar transcribes → OpenClaw agent processes → Avatar speaks response
```

1. **Voice Input**: You speak into your microphone
2. **Transcription**: LiveAvatar converts speech to text
3. **Agent Processing**: Text is sent to your OpenClaw agent via the Gateway
4. **Response**: Agent's response is sent back to LiveAvatar
5. **Avatar Speech**: The avatar speaks the response with lip-sync

## Troubleshooting

### "OpenClaw Disconnected" error
Make sure your OpenClaw Gateway is running:
```bash
openclaw gateway
```

### "No avatars available"
Check that your LIVEAVATAR_API_KEY is valid and set in `.env.local`

### Avatar not responding
1. Check that your microphone is not muted
2. Ensure the Gateway connection shows "Connected"
3. Try refreshing the page

## Credits

- Uses [HeyGen LiveAvatar](https://liveavatar.com) for real-time avatar rendering
- Part of the [OpenClaw](https://openclaw.ai) ecosystem
