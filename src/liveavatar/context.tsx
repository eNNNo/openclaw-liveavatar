"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ConnectionQuality,
  LiveAvatarSession,
  SessionState,
  SessionEvent,
  VoiceChatEvent,
  VoiceChatState,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";
import { LiveAvatarSessionMessage, MessageSender } from "./types";
import { LIVEAVATAR_API_URL } from "../../app/api/config";
import {
  OpenClawGatewayClient,
  getGatewayClient,
} from "../gateway/client";
import { GatewayConnectionState } from "../gateway/types";

/**
 * Truncate text for TTS to avoid overwhelming the avatar with long responses.
 * Keeps approximately 2-3 sentences (around 200 characters max).
 */
const truncateForTTS = (text: string, maxLength: number = 200): string => {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to cut at a sentence boundary
  const truncated = text.substring(0, maxLength);

  // Find the last sentence ending (., !, ?)
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("! "),
    truncated.lastIndexOf("? "),
    truncated.lastIndexOf(".\n"),
    truncated.lastIndexOf("!\n"),
    truncated.lastIndexOf("?\n")
  );

  if (lastSentenceEnd > maxLength * 0.5) {
    // Cut at sentence boundary if it's past halfway
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }

  // Otherwise cut at last space and add ellipsis
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace).trim() + "...";
  }

  return truncated.trim() + "...";
};

/**
 * Placeholder phrases to speak when OpenClaw takes longer than 2 seconds to respond
 */
const PROCESSING_PHRASES = [
  "Let me think about that...",
  "One moment please...",
  "Let me check on that...",
  "Give me a second...",
  "Looking into that...",
  "Hmm, let me see...",
];

const getRandomProcessingPhrase = (): string => {
  return PROCESSING_PHRASES[Math.floor(Math.random() * PROCESSING_PHRASES.length)];
};

/**
 * Intro phrases for when the avatar session starts
 */
const INTRO_PHRASES = [
  "Hey there! I'm ready to help. What can I do for you today?",
  "Hi! Good to see you. What would you like to work on?",
  "Hello! I'm all set. What's on your mind?",
  "Hey! Ready when you are. What can I help you with?",
  "Hi there! Let's get started. What do you need?",
  "Hello! I'm here to assist. What are you working on today?",
];

const DEMO_INTRO_PHRASES = [
  "Hi there! Welcome to the OpenClaw demo. Feel free to ask me anything, or say 'help' to learn more!",
  "Hello! This is the OpenClaw LiveAvatar demo. Try asking me what I can do!",
  "Hey! Welcome to the demo. I'm here to show you how this works. What would you like to know?",
];

const getRandomIntroPhrase = (isDemoMode: boolean): string => {
  const phrases = isDemoMode ? DEMO_INTRO_PHRASES : INTRO_PHRASES;
  return phrases[Math.floor(Math.random() * phrases.length)];
};

type LiveAvatarContextProps = {
  sessionRef: React.RefObject<LiveAvatarSession>;

  isMuted: boolean;
  voiceChatState: VoiceChatState;

  sessionState: SessionState;
  isStreamReady: boolean;
  connectionQuality: ConnectionQuality;

  isUserTalking: boolean;
  isAvatarTalking: boolean;

  messages: LiveAvatarSessionMessage[];
  addMessage: (message: LiveAvatarSessionMessage) => void;
  addTypedMessage: (text: string) => void;

  // OpenClaw Gateway state
  gatewayState: GatewayConnectionState;
  isProcessingAgent: boolean;
  isDemoMode: boolean;
};

export const LiveAvatarContext = createContext<LiveAvatarContextProps>({
  sessionRef: {
    current: null,
  } as unknown as React.RefObject<LiveAvatarSession>,
  connectionQuality: ConnectionQuality.UNKNOWN,
  isMuted: true,
  voiceChatState: VoiceChatState.INACTIVE,
  sessionState: SessionState.DISCONNECTED,
  isStreamReady: false,
  isUserTalking: false,
  isAvatarTalking: false,
  messages: [],
  addMessage: () => {},
  addTypedMessage: () => {},
  gatewayState: "disconnected",
  isProcessingAgent: false,
  isDemoMode: true,
});

type LiveAvatarContextProviderProps = {
  children: React.ReactNode;
  sessionAccessToken: string;
};

const useSessionState = (sessionRef: React.RefObject<LiveAvatarSession>) => {
  const [sessionState, setSessionState] = useState<SessionState>(
    sessionRef.current?.state || SessionState.INACTIVE
  );
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    sessionRef.current?.connectionQuality || ConnectionQuality.UNKNOWN
  );
  const [isStreamReady, setIsStreamReady] = useState<boolean>(false);

  useEffect(() => {
    if (sessionRef.current) {
      sessionRef.current.on(SessionEvent.SESSION_STATE_CHANGED, (state) => {
        setSessionState(state);
        if (state === SessionState.DISCONNECTED) {
          sessionRef.current.removeAllListeners();
          sessionRef.current.voiceChat.removeAllListeners();
          setIsStreamReady(false);
        }
      });
      sessionRef.current.on(SessionEvent.SESSION_STREAM_READY, () => {
        setIsStreamReady(true);
      });
      sessionRef.current.on(
        SessionEvent.SESSION_CONNECTION_QUALITY_CHANGED,
        setConnectionQuality
      );
    }
  }, [sessionRef]);

  return { sessionState, isStreamReady, connectionQuality };
};

const useVoiceChatState = (sessionRef: React.RefObject<LiveAvatarSession>) => {
  const [isMuted, setIsMuted] = useState(true);
  const [voiceChatState, setVoiceChatState] = useState<VoiceChatState>(
    sessionRef.current?.voiceChat.state || VoiceChatState.INACTIVE
  );

  useEffect(() => {
    if (sessionRef.current) {
      sessionRef.current.voiceChat.on(VoiceChatEvent.MUTED, () => {
        setIsMuted(true);
      });
      sessionRef.current.voiceChat.on(VoiceChatEvent.UNMUTED, () => {
        setIsMuted(false);
      });
      sessionRef.current.voiceChat.on(
        VoiceChatEvent.STATE_CHANGED,
        setVoiceChatState
      );
    }
  }, [sessionRef]);

  return { isMuted, voiceChatState };
};

const useTalkingState = (sessionRef: React.RefObject<LiveAvatarSession>) => {
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);

  useEffect(() => {
    if (sessionRef.current) {
      sessionRef.current.on(AgentEventsEnum.USER_SPEAK_STARTED, () => {
        setIsUserTalking(true);
      });
      sessionRef.current.on(AgentEventsEnum.USER_SPEAK_ENDED, () => {
        setIsUserTalking(false);
      });
      sessionRef.current.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => {
        setIsAvatarTalking(true);
      });
      sessionRef.current.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => {
        setIsAvatarTalking(false);
      });
    }
  }, [sessionRef]);

  return { isUserTalking, isAvatarTalking };
};

/**
 * Demo mode FAQ responses - comprehensive guide to the OpenClaw LiveAvatar integration
 */
const getDemoResponse = (text: string): string => {
  const lowerText = text.toLowerCase().trim();

  // Greetings
  if (lowerText.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)\.?$/)) {
    return "Hello! Welcome to the OpenClaw LiveAvatar integration demo. I'm here to show you how this works. Try asking me 'what is this?' or 'how does it work?' to learn more!";
  }

  // What is this / Introduction
  if (lowerText.includes("what is this") || lowerText.includes("what are you") || lowerText.includes("who are you")) {
    return "I'm a LiveAvatar - a real-time AI video avatar that serves as your voice and video interface to OpenClaw agents. Think of me as a friendly face for your AI assistant. When connected to OpenClaw, I'll speak your agent's responses and listen to your voice commands!";
  }

  // How does it work
  if (lowerText.includes("how does it work") || lowerText.includes("how do you work") || lowerText.includes("explain")) {
    return "Here's how it works: You speak to me or type a message. Your input goes to your OpenClaw agent, which processes it and generates a response. Then I speak that response back to you with natural lip-sync and expressions. It's like having a video call with your AI agent!";
  }

  // What is OpenClaw
  if (lowerText.includes("openclaw") && (lowerText.includes("what") || lowerText.includes("tell me about"))) {
    return "OpenClaw is an AI agent platform that lets you build and deploy intelligent assistants. These agents can handle tasks, answer questions, and integrate with your tools. This LiveAvatar integration adds a human-like video interface to make interactions more engaging and natural.";
  }

  // What is LiveAvatar
  if (lowerText.includes("liveavatar") && (lowerText.includes("what") || lowerText.includes("tell me about"))) {
    return "LiveAvatar is powered by HeyGen's streaming avatar technology. It creates real-time, photorealistic AI avatars that can speak any text with natural expressions and lip-sync. Combined with OpenClaw, it transforms text-based AI interactions into face-to-face conversations.";
  }

  // Help / Commands
  if (lowerText === "help" || lowerText.includes("what can i ask") || lowerText.includes("what can you do") || lowerText.includes("commands")) {
    return "In demo mode, you can ask me about: 'What is this?', 'How does it work?', 'What is OpenClaw?', 'What is LiveAvatar?', 'How do I connect?', 'Features', 'Requirements', 'Pricing', or 'Get started'. Once connected to OpenClaw, I'll respond with your actual agent's intelligence!";
  }

  // How to connect / Setup
  if (lowerText.includes("connect") || lowerText.includes("setup") || lowerText.includes("get started") || lowerText.includes("install")) {
    return "To connect to your OpenClaw agent: First, make sure OpenClaw is running on your computer with the Gateway enabled on port 18789. Then refresh this page - I'll automatically detect the connection and switch from demo mode to live mode. You'll see the status change from 'Demo Mode' to 'OpenClaw Connected'.";
  }

  // Features
  if (lowerText.includes("feature")) {
    return "Key features include: Voice-to-voice conversations with your AI agent, real-time video avatar with natural expressions, text chat as an alternative to voice, multiple avatar options to choose from, and seamless integration with your OpenClaw workflows. It's like giving your AI a face!";
  }

  // Requirements
  if (lowerText.includes("requirement") || lowerText.includes("need") || lowerText.includes("prerequisite")) {
    return "To use this integration you'll need: An OpenClaw account with an active agent, the OpenClaw Gateway running locally, a LiveAvatar API key from HeyGen, a modern browser with microphone access, and a stable internet connection for the video stream.";
  }

  // Pricing / Cost
  if (lowerText.includes("price") || lowerText.includes("cost") || lowerText.includes("free") || lowerText.includes("pricing")) {
    return "LiveAvatar sessions consume HeyGen credits based on session duration. OpenClaw has its own pricing for agent usage. Check openclaw.ai and heygen.com for current pricing. This demo mode is free to try and shows you exactly how the integration works!";
  }

  // Demo mode explanation
  if (lowerText.includes("demo mode") || lowerText.includes("demo")) {
    return "You're currently in demo mode because no OpenClaw Gateway connection was detected. In this mode, I respond with pre-set information about the integration. Once you connect to OpenClaw, I'll relay your messages to your actual AI agent and speak its responses!";
  }

  // Voice / Microphone
  if (lowerText.includes("voice") || lowerText.includes("microphone") || lowerText.includes("speak") || lowerText.includes("talk")) {
    return "You can talk to me using your microphone! Click the green microphone button to unmute, then just speak naturally. I'll transcribe what you say, process it, and respond verbally. You can also type in the chat box if you prefer text input.";
  }

  // Avatar / Change avatar
  if (lowerText.includes("avatar") || lowerText.includes("change") || lowerText.includes("appearance")) {
    return "You can change my appearance by clicking the person icon in the bottom right of the video. This opens the avatar selector where you can choose from different available avatars. Each avatar has its own look and voice!";
  }

  // Goodbye
  if (lowerText.includes("bye") || lowerText.includes("goodbye") || lowerText.includes("see you") || lowerText.includes("thanks")) {
    return "Thank you for trying the OpenClaw LiveAvatar demo! When you're ready to use it with your actual OpenClaw agent, just start the Gateway and refresh this page. Have a great day!";
  }

  // Default response for unrecognized input
  return `I heard: "${text}". I'm currently in demo mode, showing you how this integration works. Try asking me about 'what is this?', 'how does it work?', or type 'help' for more options. Once connected to OpenClaw, your agent will provide intelligent responses to any question!`;
};

/**
 * Hook to bridge LiveAvatar transcriptions to OpenClaw Gateway (or demo mode)
 * When user speaks, send to OpenClaw agent and make avatar speak the response
 */
const useOpenClawBridge = (
  sessionRef: React.RefObject<LiveAvatarSession>,
  addMessage: (message: LiveAvatarSessionMessage) => void,
  recentTypedMessages: React.RefObject<Set<string>>,
  recentMessagesRef: React.RefObject<Set<string>>,
  isAvatarTalkingRef: React.RefObject<boolean>
) => {
  const [gatewayState, setGatewayState] = useState<GatewayConnectionState>("disconnected");
  const [isProcessingAgent, setIsProcessingAgent] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true); // Start in demo mode, switch if Gateway connects
  const gatewayRef = useRef<OpenClawGatewayClient | null>(null);

  // Try to connect to OpenClaw Gateway on mount
  // If connection fails, stay in demo mode
  useEffect(() => {
    const gateway = getGatewayClient();
    gatewayRef.current = gateway;

    gateway.onConnectionState((state) => {
      setGatewayState(state);
      // If we successfully connect, disable demo mode
      if (state === "connected") {
        console.log("[OpenClaw] Gateway connected - switching to live mode");
        setIsDemoMode(false);
      }
      // If we disconnect/error after being connected, fall back to demo mode
      if (state === "disconnected" || state === "error") {
        console.log("[OpenClaw] Gateway disconnected - falling back to demo mode");
        setIsDemoMode(true);
      }
    });

    // Try to connect to gateway
    gateway.connect().catch((err) => {
      console.log("[OpenClaw] Gateway not available, staying in demo mode:", err.message);
      setIsDemoMode(true);
    });

    return () => {
      gateway.disconnect();
    };
  }, []);

  // Listen to user transcriptions and respond
  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    // Handler for user transcriptions
    const handleUserTranscription = async (data: {
      text?: string;
      transcript?: string;
    }) => {
      const text = data.text || data.transcript || "";
      if (!text.trim()) return;

      // Skip if avatar is currently speaking (avoid echo/feedback loop)
      if (isAvatarTalkingRef.current) {
        console.log("[Voice] Ignoring transcription while avatar is speaking:", text.substring(0, 30));
        return;
      }

      // Skip if this message was recently typed (to avoid duplicates)
      if (recentTypedMessages.current?.has(text.trim())) {
        recentTypedMessages.current.delete(text.trim());
        return;
      }

      // Skip if we've already seen this exact message recently (dedupe)
      const messageKey = `user:${text.trim()}`;
      if (recentMessagesRef.current?.has(messageKey)) {
        return;
      }
      recentMessagesRef.current?.add(messageKey);
      setTimeout(() => recentMessagesRef.current?.delete(messageKey), 3000);

      // Add user message to chat
      addMessage({
        sender: MessageSender.USER,
        message: text,
        timestamp: Date.now(),
      });

      try {
        setIsProcessingAgent(true);

        let responseText: string;
        let placeholderSpoken = false;

        if (isDemoMode) {
          // Demo mode: use comprehensive FAQ responses
          console.log("[Demo] Processing voice message locally:", text);
          responseText = getDemoResponse(text);
        } else {
          // Production mode: send to OpenClaw Gateway
          const gateway = gatewayRef.current;
          if (!gateway || gateway.state !== "connected") {
            console.warn("[OpenClaw] Gateway not connected, cannot send message");
            responseText = "I'm not connected to the agent. Please check the Gateway connection.";
          } else {
            console.log("[OpenClaw] Sending to agent:", text);

            // Set up placeholder timeout - speak a filler if response takes > 2s
            let placeholderTimeout: NodeJS.Timeout | null = null;
            if (session && session.state === SessionState.CONNECTED) {
              placeholderTimeout = setTimeout(async () => {
                const placeholder = getRandomProcessingPhrase();
                console.log("[Avatar] Speaking placeholder (slow response):", placeholder);
                placeholderSpoken = true;
                try {
                  await session.repeat(placeholder);
                } catch (err) {
                  console.error("[Avatar] Failed to speak placeholder:", err);
                }
              }, 2000);
            }

            const response = await gateway.sendToAgent(text);

            // Clear placeholder timeout if response came back in time
            if (placeholderTimeout) {
              clearTimeout(placeholderTimeout);
            }

            console.log("[OpenClaw] Agent response:", response);

            if (response.status === "completed" && response.text) {
              responseText = response.text;
            } else {
              responseText = "Sorry, I didn't get a response from the agent.";
            }
          }
        }

        // Parse response to extract TTS summary and full message
        const gateway = gatewayRef.current;
        let ttsText = responseText;
        let displayText = responseText;

        if (!isDemoMode && gateway) {
          const parsed = gateway.parseResponse(responseText);
          ttsText = parsed.tts;
          displayText = parsed.full;
        } else {
          // Demo mode: just truncate for TTS
          ttsText = truncateForTTS(responseText);
        }

        // Add full response to chat (without the TTS block)
        addMessage({
          sender: MessageSender.AVATAR,
          message: displayText,
          timestamp: Date.now(),
        });

        // Make avatar speak - only the TTS summary
        // If placeholder was spoken, wait a moment before speaking the actual response
        if (session && session.state === SessionState.CONNECTED) {
          try {
            if (placeholderSpoken) {
              // Small delay to let placeholder finish
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            console.log("[Avatar] Speaking TTS summary:", ttsText);
            await session.repeat(ttsText);
          } catch (speakErr) {
            console.error("[Avatar] Failed to make avatar speak:", speakErr);
          }
        }
      } catch (err) {
        console.error("[Chat] Failed to process voice message:", err);
        addMessage({
          sender: MessageSender.AVATAR,
          message: "Sorry, I couldn't process that. Please try again.",
          timestamp: Date.now(),
        });
      } finally {
        setIsProcessingAgent(false);
      }
    };

    // Register listener for user transcription
    session.on(AgentEventsEnum.USER_TRANSCRIPTION, handleUserTranscription);

    return () => {
      session.off(AgentEventsEnum.USER_TRANSCRIPTION, handleUserTranscription);
    };
  }, [sessionRef, addMessage, recentTypedMessages, recentMessagesRef, isDemoMode]);

  return { gatewayState, isProcessingAgent, isDemoMode };
};

export const LiveAvatarContextProvider = ({
  children,
  sessionAccessToken,
}: LiveAvatarContextProviderProps) => {
  // Voice chat config - start unmuted so user can speak immediately
  const config = {
    voiceChat: {
      defaultMuted: false,
    },
    apiUrl: LIVEAVATAR_API_URL,
  };
  const sessionRef = useRef<LiveAvatarSession>(
    new LiveAvatarSession(sessionAccessToken, config)
  );

  const [messages, setMessages] = useState<LiveAvatarSessionMessage[]>([]);

  // Track recently typed messages to avoid duplicates from transcription events
  const recentTypedMessagesRef = useRef<Set<string>>(new Set());
  // Track all recent messages to dedupe events that fire multiple times
  const recentMessagesRef = useRef<Set<string>>(new Set());

  const addMessage = useCallback((message: LiveAvatarSessionMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const { sessionState, isStreamReady, connectionQuality } =
    useSessionState(sessionRef);

  const { isMuted, voiceChatState } = useVoiceChatState(sessionRef);
  const { isUserTalking, isAvatarTalking } = useTalkingState(sessionRef);

  // Ref to track avatar talking state for use in async handlers (avoids stale closure)
  const isAvatarTalkingRef = useRef(false);
  useEffect(() => {
    isAvatarTalkingRef.current = isAvatarTalking;
  }, [isAvatarTalking]);

  // Bridge to OpenClaw Gateway - this determines demo mode
  const { gatewayState, isProcessingAgent: isProcessingVoiceAgent, isDemoMode } = useOpenClawBridge(
    sessionRef,
    addMessage,
    recentTypedMessagesRef,
    recentMessagesRef,
    isAvatarTalkingRef
  );

  // State for tracking if we're processing a typed message
  const [isProcessingTypedMessage, setIsProcessingTypedMessage] = useState(false);
  const gatewayClientRef = useRef<OpenClawGatewayClient | null>(null);
  const hasPlayedIntroRef = useRef(false);

  // Store gateway client reference
  useEffect(() => {
    gatewayClientRef.current = getGatewayClient();
  }, []);

  // Play intro message when stream is ready
  useEffect(() => {
    console.log("[Intro] Effect triggered - isStreamReady:", isStreamReady, "hasPlayed:", hasPlayedIntroRef.current);

    if (!isStreamReady) return;
    if (hasPlayedIntroRef.current) return;

    const session = sessionRef.current;
    if (!session) {
      console.log("[Intro] No session ref");
      return;
    }

    console.log("[Intro] Session state:", session.state);

    // Mark as played immediately to prevent double-play
    hasPlayedIntroRef.current = true;

    const playIntro = async () => {
      const introPhrase = getRandomIntroPhrase(isDemoMode);

      addMessage({
        sender: MessageSender.AVATAR,
        message: introPhrase,
        timestamp: Date.now(),
      });

      try {
        console.log("[Intro] Playing intro:", introPhrase);
        await session.repeat(introPhrase);
        console.log("[Intro] Intro played successfully");
      } catch (err) {
        console.error("[Intro] Failed to play intro:", err);
      }
    };

    // Small delay to ensure avatar is fully ready to speak
    setTimeout(playIntro, 1000);
  }, [isStreamReady, isDemoMode, addMessage, sessionRef]);

  // Add a typed message (from text input) - adds to messages and gets response
  const addTypedMessage = useCallback(
    async (text: string) => {
      // Track this message so we can skip it if it appears in transcription
      recentTypedMessagesRef.current.add(text);
      // Clear from tracking after a short delay
      setTimeout(() => {
        recentTypedMessagesRef.current.delete(text);
      }, 2000);

      // Add to messages
      addMessage({
        sender: MessageSender.USER,
        message: text,
        timestamp: Date.now(),
      });

      try {
        setIsProcessingTypedMessage(true);

        let responseText: string;
        let placeholderSpoken = false;
        const session = sessionRef.current;

        if (isDemoMode) {
          // Demo mode: use comprehensive FAQ responses
          console.log("[Demo] Processing typed message locally:", text);
          responseText = getDemoResponse(text);
        } else {
          // Production mode: send to OpenClaw Gateway
          const gateway = gatewayClientRef.current;
          if (!gateway || gateway.state !== "connected") {
            console.warn("[OpenClaw] Gateway not connected, cannot send typed message");
            responseText = "I'm not connected to the OpenClaw agent yet. Please make sure the Gateway is running.";
          } else {
            console.log("[OpenClaw] Sending typed message to agent:", text);

            // Set up placeholder timeout - speak a filler if response takes > 2s
            let placeholderTimeout: NodeJS.Timeout | null = null;
            if (session && session.state === SessionState.CONNECTED) {
              placeholderTimeout = setTimeout(async () => {
                const placeholder = getRandomProcessingPhrase();
                console.log("[Avatar] Speaking placeholder (slow response):", placeholder);
                placeholderSpoken = true;
                try {
                  await session.repeat(placeholder);
                } catch (err) {
                  console.error("[Avatar] Failed to speak placeholder:", err);
                }
              }, 2000);
            }

            const response = await gateway.sendToAgent(text);

            // Clear placeholder timeout if response came back in time
            if (placeholderTimeout) {
              clearTimeout(placeholderTimeout);
            }

            console.log("[OpenClaw] Agent response:", response);

            if (response.status === "completed" && response.text) {
              responseText = response.text;
            } else {
              responseText = "Sorry, I didn't get a response from the agent.";
            }
          }
        }

        // Parse response to extract TTS summary and full message
        const gateway = gatewayClientRef.current;
        let ttsText = responseText;
        let displayText = responseText;

        if (!isDemoMode && gateway) {
          const parsed = gateway.parseResponse(responseText);
          ttsText = parsed.tts;
          displayText = parsed.full;
        } else {
          // Demo mode: just truncate for TTS
          ttsText = truncateForTTS(responseText);
        }

        // Add full response to chat (without the TTS block)
        addMessage({
          sender: MessageSender.AVATAR,
          message: displayText,
          timestamp: Date.now(),
        });

        // Make avatar speak - only the TTS summary
        // If placeholder was spoken, wait a moment before speaking the actual response
        if (session && session.state === SessionState.CONNECTED) {
          try {
            if (placeholderSpoken) {
              // Small delay to let placeholder finish
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            console.log("[Avatar] Speaking TTS summary:", ttsText);
            await session.repeat(ttsText);
          } catch (speakErr) {
            console.error("[Avatar] Failed to make avatar speak:", speakErr);
          }
        }
      } catch (err) {
        console.error("[Chat] Failed to process message:", err);
        addMessage({
          sender: MessageSender.AVATAR,
          message: "Sorry, I couldn't process that. Please try again.",
          timestamp: Date.now(),
        });
      } finally {
        setIsProcessingTypedMessage(false);
      }
    },
    [addMessage, sessionRef, isDemoMode]
  );

  // Combine processing states from voice and typed messages
  const isProcessingAgent = isProcessingVoiceAgent || isProcessingTypedMessage;

  return (
    <LiveAvatarContext.Provider
      value={{
        sessionRef,
        sessionState,
        isStreamReady,
        connectionQuality,
        isMuted,
        voiceChatState,
        isUserTalking,
        isAvatarTalking,
        messages,
        addMessage,
        addTypedMessage,
        gatewayState,
        isProcessingAgent,
        isDemoMode,
      }}
    >
      {children}
    </LiveAvatarContext.Provider>
  );
};

export const useLiveAvatarContext = () => {
  return useContext(LiveAvatarContext);
};
