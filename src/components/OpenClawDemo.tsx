"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";
import { getGatewayClient } from "../gateway/client";
import { GatewayConnectionState } from "../gateway/types";

type SessionState = "idle" | "connecting" | "session" | "ended" | "error";

interface Avatar {
  id: string;
  name: string;
  preview_url?: string;
  is_expired?: boolean;
  is_custom?: boolean;
}

// Collapsible section component for avatar groups
const AvatarSection = ({
  title,
  avatars,
  isExpanded,
  onToggle,
  onSelectAvatar,
  badge,
  showExpiredBadge = true,
}: {
  title: string;
  avatars: Avatar[];
  isExpanded: boolean;
  onToggle: () => void;
  onSelectAvatar: (id: string) => void;
  badge?: { text: string; color: string };
  showExpiredBadge?: boolean;
}) => {
  // For custom avatars, count non-expired; for public avatars, all are active
  const expiredCount = avatars.filter(a => a.is_expired === true).length;
  const activeCount = avatars.length - expiredCount;

  return (
    <div className="w-full">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800/70 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-medium text-white">{title}</span>
          {badge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.color}`}>
              {badge.text}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {expiredCount > 0 ? `${activeCount} active / ${avatars.length} total` : `${avatars.length} available`}
        </span>
      </button>

      {isExpanded && avatars.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 mt-3 px-1">
          {avatars.map((avatar) => {
            const isExpired = avatar.is_expired === true;
            return (
              <button
                key={avatar.id}
                onClick={() => onSelectAvatar(avatar.id)}
                disabled={isExpired}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
                  isExpired
                    ? "border-red-500/30 opacity-50 cursor-not-allowed"
                    : "border-white/10 hover:border-orange-500/50 hover:scale-105"
                }`}
              >
                {avatar.preview_url ? (
                  <img
                    src={avatar.preview_url}
                    alt={avatar.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <span className="text-gray-400 text-xs text-center px-1">
                      {avatar.name.slice(0, 10)}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                  <div className="w-full p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs truncate block">{avatar.name}</span>
                  </div>
                </div>
                {showExpiredBadge && isExpired && (
                  <div className="absolute top-1 left-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded">
                    Expired
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {isExpanded && avatars.length === 0 && (
        <div className="text-center py-6 text-gray-500 text-sm">
          No {title.toLowerCase()} available
        </div>
      )}
    </div>
  );
};

export const OpenClawDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("connecting"); // Start connecting immediately
  const [customAvatars, setCustomAvatars] = useState<Avatar[]>([]);
  const [publicAvatars, setPublicAvatars] = useState<Avatar[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState(true);
  const [gatewayState, setGatewayState] = useState<GatewayConnectionState>("disconnected");
  const [customExpanded, setCustomExpanded] = useState(false); // Start collapsed since likely expired
  const [publicExpanded, setPublicExpanded] = useState(true); // Start expanded
  const hasAutoStartedRef = useRef(false);

  // Start a session with an optional specific avatar
  const startSessionWithAvatar = useCallback(async (avatarId?: string) => {
    setError(null);
    setSessionState("connecting");

    try {
      const sessionRes = await fetch("/api/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(avatarId ? { avatarId } : {}),
      });

      if (!sessionRes.ok) {
        const errorData = await sessionRes.json();
        throw new Error(errorData.error || "Failed to start session");
      }

      const { session_token } = await sessionRes.json();
      setSessionToken(session_token);
      setSessionState("session");
    } catch (err: unknown) {
      setError((err as Error).message);
      setSessionState("error");
    }
  }, []);

  // Fetch avatars and connect to gateway on mount
  useEffect(() => {
    // Fetch available avatars and auto-start with first available
    const fetchAvatarsAndAutoStart = async () => {
      setLoadingAvatars(true);
      try {
        const res = await fetch("/api/get-avatars");
        if (res.ok) {
          const data = await res.json();
          const custom: Avatar[] = data.customAvatars || [];
          const publicList: Avatar[] = data.publicAvatars || [];
          setCustomAvatars(custom);
          setPublicAvatars(publicList);

          // Auto-start with first available avatar (prefer active custom, then public)
          if (!hasAutoStartedRef.current) {
            hasAutoStartedRef.current = true;
            const firstActiveCustom = custom.find(a => !a.is_expired);
            const firstPublic = publicList[0];
            const firstAvatar = firstActiveCustom || firstPublic;

            if (firstAvatar) {
              console.log("[AutoStart] Starting session with avatar:", firstAvatar.name);
              startSessionWithAvatar(firstAvatar.id);
            } else {
              // No avatars available, go to selection screen
              setSessionState("ended");
            }
          }
        } else {
          setSessionState("error");
          setError("Failed to fetch avatars");
        }
      } catch (err) {
        console.error("Failed to fetch avatars:", err);
        setSessionState("error");
        setError("Failed to connect to avatar service");
      } finally {
        setLoadingAvatars(false);
      }
    };
    fetchAvatarsAndAutoStart();

    // Connect to OpenClaw gateway
    const gateway = getGatewayClient();
    gateway.onConnectionState(setGatewayState);
    gateway.connect().catch((err) => {
      console.log("[OpenClaw] Gateway not available:", err.message);
    });

    return () => {
      gateway.offConnectionState(setGatewayState);
    };
  }, [startSessionWithAvatar]);

  const onSessionStopped = useCallback(() => {
    setSessionToken("");
    setSessionState("ended");
  }, []);

  // Connecting screen (shown immediately on load)
  if (sessionState === "connecting") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-orange-500/30 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                <span className="text-xl">🦞</span>
              </div>
              <h1 className="text-2xl font-bold text-white">
                OpenClaw LiveAvatar
              </h1>
            </div>
            <p className="text-gray-400 text-sm">
              Connecting to your AI avatar...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error screen
  if (sessionState === "error") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-4">
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Connection Failed
            </h1>
            <p className="text-gray-400 mb-4">
              Could not connect to the LiveAvatar service.
            </p>
            {error && (
              <div className="text-red-400 bg-red-900/30 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}
          </div>

          <button
            onClick={() => setSessionState("idle")}
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-lg transition-all"
          >
            Back to Avatar Selection
          </button>

          <p className="text-xs text-gray-500 text-center">
            Make sure your LIVEAVATAR_API_KEY is configured in .env.local
          </p>
        </div>
      </div>
    );
  }

  // Avatar selection screen (only shown after session ends)
  if (sessionState === "ended") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-4">
        <div className="w-full max-w-2xl flex flex-col items-center gap-6">
          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                <span className="text-xl">🦞</span>
              </div>
              <h1 className="text-2xl font-bold text-white">
                OpenClaw LiveAvatar
              </h1>
            </div>
            <p className="text-gray-400 mb-2">Session ended. Select an avatar to start a new conversation.</p>
          </div>

          {/* OpenClaw Connection Status */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${
              gatewayState === "connected" ? "bg-green-500" :
              gatewayState === "connecting" ? "bg-yellow-500 animate-pulse" :
              "bg-gray-500"
            }`} />
            <span className="text-sm text-gray-300">
              {gatewayState === "connected" ? "OpenClaw Connected" :
               gatewayState === "connecting" ? "Connecting to OpenClaw..." :
               "OpenClaw Disconnected"}
            </span>
          </div>

          {/* Avatar Lists */}
          <div className="w-full space-y-4">
            <h2 className="text-lg font-medium text-white">Select an Avatar</h2>
            {loadingAvatars ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : customAvatars.length === 0 && publicAvatars.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                No avatars available. Check your LiveAvatar API key.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Custom Avatars Section */}
                {customAvatars.length > 0 && (
                  <AvatarSection
                    title="Custom Avatars"
                    avatars={customAvatars}
                    isExpanded={customExpanded}
                    onToggle={() => setCustomExpanded(!customExpanded)}
                    onSelectAvatar={startSessionWithAvatar}
                  />
                )}

                {/* Public Avatars Section */}
                {publicAvatars.length > 0 && (
                  <AvatarSection
                    title="Public Avatars"
                    avatars={publicAvatars}
                    isExpanded={publicExpanded}
                    onToggle={() => setPublicExpanded(!publicExpanded)}
                    onSelectAvatar={startSessionWithAvatar}
                    showExpiredBadge={false}
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-500 text-center">
            Powered by{" "}
            <a
              href="https://liveavatar.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              LiveAvatar
            </a>{" "}
            +{" "}
            <a
              href="https://openclaw.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline"
            >
              OpenClaw
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Session screen
  return (
    <LiveAvatarSession
      sessionAccessToken={sessionToken}
      onSessionStopped={onSessionStopped}
    />
  );
};
