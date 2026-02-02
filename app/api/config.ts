// LiveAvatar Configuration
// Get your free API key from https://app.liveavatar.com/developers
export const LIVEAVATAR_API_KEY = process.env.LIVEAVATAR_API_KEY || "";
export const LIVEAVATAR_API_URL = "https://api.liveavatar.com";

// Default avatar and voice (can be overridden by user selection)
export const DEFAULT_AVATAR_ID = "1c690fe7-23e0-49f9-bfba-14344450285b"; // Stock avatar
export const DEFAULT_VOICE_ID = ""; // Will use avatar's default voice

// Sandbox mode for development (uses minimal credits)
// Note: Not all avatars support sandbox mode - set to false for full avatar access
export const IS_SANDBOX = false;

export const LANGUAGE = "en";

// OpenClaw Gateway Configuration
export const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
export const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
