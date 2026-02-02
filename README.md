# OpenClaw LiveAvatar

Give your OpenClaw agent a face and voice! Talk face-to-face with a real-time AI avatar powered by [LiveAvatar](https://liveavatar.com).

![OpenClaw LiveAvatar Demo](public/demo.png)

## Features

- **Voice-to-Voice Conversation**: Speak naturally and hear your agent respond
- **Real-time Avatar**: Lip-synced video avatar with natural expressions
- **OpenClaw Integration**: Connects to your local OpenClaw Gateway
- **Smart TTS Summarization**: Long responses are summarized for natural speech
- **Echo Cancellation**: Won't respond to itself
- **Multiple Avatar Choices**: Select from custom or public avatars
- **Chat Transcript**: View the full conversation history

## Installation

### Option 1: ClawHub Skill (Recommended)

If you have [OpenClaw](https://openclaw.ai) installed:

```bash
clawhub install liveavatar
```

Then run the `/liveavatar` command in any OpenClaw chat.

### Option 2: NPX (Quick Start)

```bash
# Set your API key
export LIVEAVATAR_API_KEY=your_key_here

# Start OpenClaw Gateway (in another terminal)
openclaw gateway

# Run LiveAvatar
npx openclaw-liveavatar
```

### Option 3: Global Install

```bash
npm install -g openclaw-liveavatar

# Then run anytime with:
openclaw-liveavatar
```

### Option 4: Development Setup

```bash
git clone https://github.com/eNNNo/openclaw-liveavatar.git
cd openclaw-liveavatar
npm install
cp .env.example .env.local
# Edit .env.local with your API key
npm run dev
```

## Prerequisites

- Node.js 18+
- [OpenClaw](https://openclaw.ai) installed with Gateway running
- [LiveAvatar API Key](https://app.liveavatar.com) (free tier available)

## Setup

### 1. Get Your API Key (Free)

1. Go to [app.liveavatar.com](https://app.liveavatar.com)
2. Create a free account
3. Copy your API key from the dashboard

### 2. Set Your API Key

**Option A: Environment variable**
```bash
export LIVEAVATAR_API_KEY=your_api_key_here
```

**Option B: OpenClaw config** (`~/.openclaw/openclaw.json`)
```json
{
  "skills": {
    "entries": {
      "liveavatar": {
        "env": {
          "LIVEAVATAR_API_KEY": "your_api_key_here"
        }
      }
    }
  }
}
```

### 3. Start OpenClaw Gateway

```bash
openclaw gateway
```

### 4. Launch LiveAvatar

```bash
npx openclaw-liveavatar
# Or: /liveavatar (if installed as skill)
```

The interface will open at http://localhost:3001

> **Demo Mode**: If OpenClaw Gateway isn't running, the app will start in Demo Mode where you can interact with the avatar and learn about the integration.

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   You Speak     │────▶│   LiveAvatar     │────▶│  OpenClaw       │
│   (Microphone)  │     │   (Transcribe)   │     │  Gateway        │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
┌─────────────────┐     ┌──────────────────┐              │
│   Avatar Speaks │◀────│   LiveAvatar     │◀─────────────┘
│   (Lip-sync)    │     │   (TTS + Video)  │     Agent Response
└─────────────────┘     └──────────────────┘
```

1. **You speak** into your microphone
2. **LiveAvatar transcribes** your speech to text
3. **OpenClaw Gateway** receives the text and sends it to your agent
4. **Your agent responds** with text
5. **LiveAvatar synthesizes** the response as speech
6. **The avatar speaks** with synchronized lip movements

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LIVEAVATAR_API_KEY` | Your LiveAvatar API key (required) | - |
| `OPENCLAW_GATEWAY_URL` | WebSocket URL for OpenClaw Gateway | `ws://127.0.0.1:18789` |
| `OPENCLAW_GATEWAY_TOKEN` | Token for remote Gateway access | - |

### OpenClaw Skill Installation

This can also be installed as an OpenClaw skill:

```bash
clawhub install liveavatar
```

Or invoke directly:

```
/liveavatar
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Architecture

```
openclaw-liveavatar/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── config.ts      # Configuration
│   │   ├── start-session/ # Session token generation
│   │   └── get-avatars/   # Avatar listing
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── src/
│   ├── components/        # React components
│   │   ├── OpenClawDemo.tsx      # Setup/landing UI
│   │   └── LiveAvatarSession.tsx # Session UI
│   ├── gateway/           # OpenClaw Gateway client
│   │   ├── client.ts      # WebSocket client
│   │   └── types.ts       # Protocol types
│   └── liveavatar/        # LiveAvatar SDK hooks
│       ├── context.tsx    # React context with Gateway bridge
│       ├── useSession.ts  # Session management
│       ├── useVoiceChat.ts # Voice chat controls
│       └── ...
├── skills/                # OpenClaw skill definition
│   └── liveavatar/
│       └── SKILL.md
└── openclaw.plugin.json   # Channel plugin manifest
```

## Troubleshooting

### "OpenClaw Disconnected"

Make sure your OpenClaw Gateway is running:

```bash
openclaw gateway
```

### "No avatars available"

Verify your `LIVEAVATAR_API_KEY` is set correctly in `.env.local`

### Avatar not responding to speech

1. Check microphone permissions in your browser
2. Ensure the mic is not muted (green button = active)
3. Verify Gateway shows "Connected" status
4. Try a different microphone from the dropdown

### Connection quality issues

LiveAvatar uses WebRTC. For best results:
- Use a stable internet connection
- Close other video/audio applications
- Use Chrome or Edge for best WebRTC support

## Credits

- [HeyGen LiveAvatar](https://liveavatar.com) - Real-time AI avatar technology
- [OpenClaw](https://openclaw.ai) - AI agent gateway
- Based on [liveavatar-ai-sdr](https://github.com/eNNNo/liveavatar-ai-sdr)

## License

MIT
