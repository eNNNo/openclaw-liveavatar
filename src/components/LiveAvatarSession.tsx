"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  LiveAvatarContextProvider,
  useSession,
  useVoiceChat,
  useLiveAvatarContext,
} from "../liveavatar";
import { SessionState } from "@heygen/liveavatar-web-sdk";
import { useAvatarActions } from "../liveavatar/useAvatarActions";
import { MessageSender } from "../liveavatar/types";
import { GatewayConnectionState } from "../gateway/types";

interface Avatar {
  id: string;
  name: string;
  preview_url?: string;
  default_voice?: {
    id: string;
    name: string;
  };
  is_custom?: boolean;
  is_expired?: boolean;
}

// Audio level visualizer component
const AudioLevelMeter: React.FC<{
  deviceId: string;
  isActive: boolean;
}> = ({ deviceId, isActive }) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!isActive || !deviceId || deviceId === "default") {
      setAudioLevel(0);
      return;
    }

    const cleanup = () => {
      mountedRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };

    const startAnalyser = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!mountedRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { ideal: deviceId } },
        });

        if (!mountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
          if (!mountedRef.current) return;

          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const normalizedLevel = Math.min(100, (average / 128) * 100);

          setAudioLevel(normalizedLevel);
          animationRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
      } catch (err) {
        console.error("Failed to start audio analyser:", err);
        setAudioLevel(0);
      }
    };

    startAnalyser();

    return cleanup;
  }, [deviceId, isActive]);

  const bars = 5;
  const barHeights = Array.from({ length: bars }, (_, i) => {
    const threshold = (i + 1) * (100 / bars);
    return audioLevel >= threshold ? 100 : (audioLevel / threshold) * 100;
  });

  return (
    <div className="flex items-end gap-0.5 h-6">
      {barHeights.map((height, i) => (
        <div
          key={i}
          className="w-1 bg-green-500 rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(4, height * 0.24)}px`,
            opacity: audioLevel > 5 ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
};

// Microphone selector component
const MicrophoneSelector: React.FC<{
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  disabled?: boolean;
  showAudioLevel?: boolean;
}> = ({ selectedDeviceId, onDeviceChange, disabled, showAudioLevel }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter(
          (device) => device.kind === "audioinput"
        );
        setDevices(audioInputs);

        if (audioInputs.length > 0 && selectedDeviceId === "default") {
          onDeviceChange(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Failed to get audio devices:", err);
      }
    };
    getDevices();

    navigator.mediaDevices.addEventListener("devicechange", getDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", getDevices);
    };
  }, [selectedDeviceId, onDeviceChange]);

  const selectedDevice = devices.find((d) => d.deviceId === selectedDeviceId);
  const displayName = selectedDevice?.label || "Select microphone";

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        <span className="max-w-[180px] truncate">{displayName}</span>
        {showAudioLevel && selectedDeviceId !== "default" && (
          <AudioLevelMeter
            key={selectedDeviceId}
            deviceId={selectedDeviceId}
            isActive={true}
          />
        )}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium border-b">
            Select microphone
          </div>
          <div className="max-h-64 overflow-y-auto">
            {devices.map((device) => (
              <button
                key={device.deviceId}
                onClick={() => {
                  onDeviceChange(device.deviceId);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors ${
                  device.deviceId === selectedDeviceId
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-800"
                }`}
              >
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Avatar selector component
const AvatarSelector: React.FC<{
  onAvatarChange: (avatarId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}> = ({ onAvatarChange, isOpen, onClose }) => {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const fetchAvatars = async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/get-avatars");
          if (res.ok) {
            const data = await res.json();
            setAvatars(data.avatars || []);
          }
        } catch (err) {
          console.error("Failed to fetch avatars:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchAvatars();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Change Avatar</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Select an avatar to switch to. This will end your current session and start a new one.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : avatars.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No avatars available
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="grid grid-cols-4 gap-3">
              {avatars.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => {
                    onAvatarChange(avatar.id);
                    onClose();
                  }}
                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-white/10 hover:border-orange-500/50 transition-all group"
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
                  {avatar.is_expired && (
                    <div className="absolute top-1 left-1 bg-red-500 text-white text-[10px] px-1 rounded">
                      Expired
                    </div>
                  )}
                  {avatar.is_custom && (
                    <div className="absolute top-1 right-1 bg-blue-500 text-white text-[10px] px-1 rounded">
                      Custom
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Gateway connection status indicator
const GatewayStatus: React.FC<{
  state: GatewayConnectionState;
  isProcessing: boolean;
  isDemoMode: boolean;
}> = ({ state, isProcessing, isDemoMode }) => {
  const getStatusColor = () => {
    if (isProcessing) return "bg-yellow-500";
    if (isDemoMode) return "bg-blue-500";
    switch (state) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    if (isProcessing) return "Processing...";
    if (isDemoMode) return "Demo Mode";
    switch (state) {
      case "connected":
        return "OpenClaw Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Connection Error";
      default:
        return "Disconnected";
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-full">
      <span
        className={`w-2 h-2 rounded-full ${getStatusColor()} ${isProcessing ? "animate-pulse" : ""}`}
      />
      <span className="text-xs text-white/80">{getStatusText()}</span>
    </div>
  );
};

// Chat transcript panel component with text input
const ChatPanel: React.FC = () => {
  const { messages, gatewayState, isProcessingAgent, addTypedMessage, isDemoMode } = useLiveAvatarContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");

  // In demo mode or when connected, allow input
  const isReady = isDemoMode || gatewayState === "connected";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    const text = inputText.trim();
    if (!text) return;

    addTypedMessage(text);
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-900/50 rounded-2xl border border-white/10">
      {/* Header with Gateway status */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-white font-medium">Conversation</h3>
        <GatewayStatus state={gatewayState} isProcessing={isProcessingAgent} isDemoMode={isDemoMode} />
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-sm text-center py-8">
            {isDemoMode ? (
              <>Demo mode active. Type &quot;help&quot; to learn about this integration!</>
            ) : gatewayState === "connected" ? (
              <>Start speaking or type below to chat with your OpenClaw agent</>
            ) : (
              <>Connecting to OpenClaw Gateway...</>
            )}
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.sender === MessageSender.USER ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                  msg.sender === MessageSender.USER
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-100"
                }`}
              >
                <div className="text-xs opacity-70 mb-1">
                  {msg.sender === MessageSender.USER ? "You" : "OpenClaw Agent"}
                </div>
                {msg.message}
              </div>
            </div>
          ))
        )}
        {isProcessingAgent && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-100 px-3 py-2 rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Text input */}
      <div className="flex-shrink-0 p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isReady ? "Type a message..." : "Waiting for connection..."}
            disabled={!isReady || isProcessingAgent}
            className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-white/10 focus:border-orange-500/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || !isReady || isProcessingAgent}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const LiveAvatarSessionComponent: React.FC<{
  onSessionStopped: () => void;
  onAvatarChange?: (avatarId: string) => void;
}> = ({ onSessionStopped, onAvatarChange }) => {
  const [selectedMicId, setSelectedMicId] = useState("default");
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);

  const {
    sessionState,
    isStreamReady,
    startSession,
    stopSession,
    connectionQuality,
    attachElement,
    sessionRef,
  } = useSession();

  const {
    isAvatarTalking,
    isUserTalking,
    isMuted,
    isActive,
    mute,
    unmute,
    restartWithDevice,
  } = useVoiceChat();

  const { interrupt } = useAvatarActions("FULL");
  const { gatewayState, isProcessingAgent } = useLiveAvatarContext();

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      onSessionStopped();
    }
  }, [sessionState, onSessionStopped]);

  useEffect(() => {
    if (isStreamReady && videoRef.current) {
      attachElement(videoRef.current);
    }
  }, [attachElement, isStreamReady]);

  useEffect(() => {
    if (sessionState === SessionState.INACTIVE) {
      startSession();
    }
  }, [startSession, sessionState]);

  // Handle microphone device change
  const handleMicChange = useCallback(
    async (deviceId: string) => {
      console.log("Changing microphone to:", deviceId);
      setSelectedMicId(deviceId);

      try {
        const voiceChat = sessionRef.current?.voiceChat;
        if (voiceChat) {
          const result = await voiceChat.setDevice(deviceId);
          if (!result && isActive) {
            await restartWithDevice(deviceId);
          }
        }
      } catch (err) {
        console.error("Failed to set microphone device:", err);
        if (isActive) {
          await restartWithDevice(deviceId);
        }
      }
    },
    [sessionRef, isActive, restartWithDevice]
  );

  // Toggle mute
  const handleMuteToggle = useCallback(async () => {
    if (isMuted) {
      await unmute();
    } else {
      await mute();
    }
  }, [isMuted, mute, unmute]);

  // Calculate chat panel height
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [leftColumnHeight, setLeftColumnHeight] = useState<number>(0);

  useEffect(() => {
    const measureHeight = () => {
      if (videoContainerRef.current) {
        const leftColumn = videoContainerRef.current.parentElement;
        if (leftColumn) {
          setLeftColumnHeight(leftColumn.offsetHeight);
        }
      }
    };
    measureHeight();
    window.addEventListener("resize", measureHeight);
    return () => window.removeEventListener("resize", measureHeight);
  }, [isStreamReady]);

  return (
    <div className="w-full max-w-6xl flex gap-4 py-4 px-4">
      {/* Left side - Video and controls */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Video container */}
        <div
          ref={videoContainerRef}
          className="relative w-full aspect-video overflow-hidden rounded-2xl bg-gray-800 flex flex-col items-center justify-center"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />

          {/* Status overlay */}
          {sessionState !== SessionState.CONNECTED && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-lg">
                {sessionState === SessionState.CONNECTING && "Connecting..."}
                {sessionState === SessionState.INACTIVE && "Starting..."}
                {sessionState === SessionState.DISCONNECTING &&
                  "Disconnecting..."}
              </div>
            </div>
          )}

          {/* Bottom controls overlay */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            {/* Change avatar button */}
            {onAvatarChange && (
              <button
                className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-colors"
                onClick={() => setShowAvatarSelector(true)}
                title="Change avatar"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>
            )}

            {/* End call button */}
            <button
              className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full transition-colors"
              onClick={() => stopSession()}
              title="End conversation"
            >
              <svg
                className="w-5 h-5"
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
            </button>
          </div>

          {/* Talking indicators */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {isUserTalking && (
              <div className="bg-green-500/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                You&apos;re speaking
              </div>
            )}
            {isAvatarTalking && (
              <div className="bg-blue-500/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Agent speaking
              </div>
            )}
            {isProcessingAgent && (
              <div className="bg-yellow-500/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Thinking...
              </div>
            )}
          </div>

          {/* Connection quality */}
          <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs bg-black/50 text-white">
            {connectionQuality}
          </div>
        </div>

        {/* Control bar */}
        <div className="w-full flex items-center justify-center gap-3">
          {/* Mic selector with audio level */}
          <MicrophoneSelector
            selectedDeviceId={selectedMicId}
            onDeviceChange={handleMicChange}
            showAudioLevel={!isMuted}
          />

          {/* Single Mute/Unmute button */}
          <button
            onClick={handleMuteToggle}
            className={`p-4 rounded-full transition-colors ${
              isMuted
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600"
            }`}
            title={isMuted ? "Click to unmute" : "Click to mute"}
          >
            {isMuted ? (
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3l18 18"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            )}
          </button>

          {/* Interrupt button */}
          <button
            onClick={() => interrupt()}
            className="bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-full transition-colors"
            title="Interrupt avatar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
              />
            </svg>
          </button>
        </div>

        {/* Status text */}
        <div className="text-sm text-gray-400 text-center">
          {gatewayState !== "connected" ? (
            <span className="text-yellow-400">
              Waiting for OpenClaw Gateway connection...
            </span>
          ) : isMuted ? (
            "Microphone is muted - click to speak"
          ) : (
            "Speak to chat with your OpenClaw agent"
          )}
        </div>
      </div>

      {/* Right side - Chat panel */}
      <div
        className="w-80 flex flex-col overflow-hidden"
        style={{
          height: leftColumnHeight > 0 ? `${leftColumnHeight}px` : "500px",
        }}
      >
        <ChatPanel />
      </div>

      {/* Avatar selector modal */}
      {onAvatarChange && (
        <AvatarSelector
          isOpen={showAvatarSelector}
          onClose={() => setShowAvatarSelector(false)}
          onAvatarChange={(avatarId) => {
            stopSession();
            onAvatarChange(avatarId);
          }}
        />
      )}
    </div>
  );
};

export const LiveAvatarSession: React.FC<{
  sessionAccessToken: string;
  onSessionStopped: () => void;
  onAvatarChange?: (avatarId: string) => void;
}> = ({ sessionAccessToken, onSessionStopped, onAvatarChange }) => {
  return (
    <LiveAvatarContextProvider sessionAccessToken={sessionAccessToken}>
      <LiveAvatarSessionComponent
        onSessionStopped={onSessionStopped}
        onAvatarChange={onAvatarChange}
      />
    </LiveAvatarContextProvider>
  );
};
