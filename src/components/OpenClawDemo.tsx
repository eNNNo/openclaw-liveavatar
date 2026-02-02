"use client";

import { useState, useEffect, useCallback } from "react";
import { LiveAvatarSession } from "./LiveAvatarSession";

type SessionState = "connecting" | "session" | "ended" | "error";

export const OpenClawDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("connecting");

  // Auto-start session on mount with default avatar
  useEffect(() => {
    startSessionWithAvatar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSessionStopped = useCallback(() => {
    setSessionToken("");
    setSessionState("ended");
  }, []);

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

  const handleStartOver = () => {
    startSessionWithAvatar();
  };

  const handleAvatarChange = useCallback((avatarId: string) => {
    // Start a new session with the selected avatar
    startSessionWithAvatar(avatarId);
  }, [startSessionWithAvatar]);

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
            onClick={handleStartOver}
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-lg transition-all"
          >
            Try Again
          </button>

          <p className="text-xs text-gray-500 text-center">
            Make sure your LIVEAVATAR_API_KEY is configured in .env.local
          </p>
        </div>
      </div>
    );
  }

  // Session ended screen
  if (sessionState === "ended") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-6 p-4">
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Session Ended
            </h1>
            <p className="text-gray-400">
              Your conversation with OpenClaw has ended.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleStartOver}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-lg transition-all"
            >
              Start New Session
            </button>
          </div>

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

  // Session screen with avatar change option
  return (
    <LiveAvatarSession
      sessionAccessToken={sessionToken}
      onSessionStopped={onSessionStopped}
      onAvatarChange={handleAvatarChange}
    />
  );
};
