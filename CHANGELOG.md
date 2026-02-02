# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-01-31

### Added
- Initial release as npm package and ClawHub skill
- Real-time video avatar with lip-synced speech
- Voice-to-voice conversations with OpenClaw agents
- Automatic session start with first available avatar
- Smart TTS summarization for long responses
- Echo cancellation to prevent feedback loops
- Random intro phrases when sessions start
- Processing placeholder phrases for slow responses
- Avatar selection with collapsible Custom/Public sections
- Expiration badges for custom avatars
- Text chat fallback option
- Demo mode when OpenClaw Gateway is not running
- CLI entry point (`npx openclaw-liveavatar`)
- ClawHub skill support (`/liveavatar` command)

### Technical
- Built with Next.js 15 and React 19
- Uses @heygen/liveavatar-web-sdk
- Connects to OpenClaw Gateway on port 18789
- WebSocket-based real-time communication
