# OpenClaw LiveAvatar

Talk to your OpenClaw agent face-to-face with a real-time AI avatar powered by [HeyGen LiveAvatar](https://liveavatar.com).

![OpenClaw LiveAvatar Demo](public/demo.png)

## Features

- **Voice-to-Voice Conversation**: Speak naturally and hear your agent respond
- **Real-time Avatar**: Lip-synced video avatar with natural expressions
- **OpenClaw Integration**: Connects to your local OpenClaw Gateway
- **Microphone Selection**: Choose your preferred audio input device
- **Audio Level Visualization**: See when you're being heard
- **Chat Transcript**: View the conversation history

## Prerequisites

- Node.js 18+
- [OpenClaw](https://openclaw.ai) installed and Gateway running
- [LiveAvatar API Key](https://app.liveavatar.com/developers) (free tier available)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/eNNNo/openclaw-liveavatar.git
cd openclaw-liveavatar
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your LiveAvatar API key:

```
LIVEAVATAR_API_KEY=your-api-key-here
```

### 3. Start OpenClaw Gateway

In a separate terminal:

```bash
openclaw gateway
```

### 4. Start LiveAvatar

```bash
npm run dev
```

### 5. Open in Browser

Navigate to http://localhost:3000

> **Demo Mode**: If OpenClaw Gateway isn't running, the app will start in Demo Mode where you can interact with the avatar and learn about the integration. Type "help" to see available demo commands.

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
