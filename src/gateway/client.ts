// OpenClaw Gateway WebSocket Client
// Connects to the local OpenClaw Gateway to send messages to the agent

import {
  GatewayMessage,
  GatewayResponse,
  GatewayEvent,
  GatewayConnectionState,
  AgentResponse,
  AgentEvent,
} from "./types";

type MessageHandler = (message: GatewayMessage) => void;
type ConnectionStateHandler = (state: GatewayConnectionState) => void;

export class OpenClawGatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageId = 0;
  private pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private connectionState: GatewayConnectionState = "disconnected";
  private conversationId: string | null = null;
  private sessionKey: string | null = null;

  // Event handlers
  private onMessageHandlers: MessageHandler[] = [];
  private onConnectionStateHandlers: ConnectionStateHandler[] = [];

  constructor(url: string, token?: string) {
    this.url = url;
    this.token = token || "";
  }

  get state(): GatewayConnectionState {
    return this.connectionState;
  }

  private setConnectionState(state: GatewayConnectionState) {
    this.connectionState = state;
    this.onConnectionStateHandlers.forEach((handler) => handler(state));
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.setConnectionState("connecting");

        // Build URL with token if provided
        let wsUrl = this.url;
        if (this.token) {
          const separator = wsUrl.includes("?") ? "&" : "?";
          wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(this.token)}`;
        }

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log("[Gateway] WebSocket connected");
          this.reconnectAttempts = 0;
          this.performHandshake()
            .then(() => {
              this.setConnectionState("connected");
              resolve();
            })
            .catch((err) => {
              this.setConnectionState("error");
              reject(err);
            });
        };

        this.ws.onclose = (event) => {
          console.log("[Gateway] WebSocket closed:", event.code, event.reason);
          this.setConnectionState("disconnected");
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error("[Gateway] WebSocket error:", error);
          this.setConnectionState("error");
          reject(new Error("WebSocket connection failed"));
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.setConnectionState("error");
        reject(error);
      }
    });
  }

  private async performHandshake(): Promise<void> {
    // Send connect request matching OpenClaw protocol schema
    // Protocol version 3 is required by OpenClaw Gateway 2026.1.30
    const connectRequest: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "webchat" as const,
        version: "0.1.0",
        platform: "web",
        mode: "webchat" as const,
        displayName: "OpenClaw LiveAvatar",
      },
    };

    // Add token auth if provided - this allows skipping device identity
    if (this.token) {
      connectRequest.auth = { token: this.token };
    }

    const response = (await this.sendRequest("connect", connectRequest)) as {
      type?: string;
      snapshot?: {
        sessionDefaults?: {
          mainSessionKey?: string;
          defaultAgentId?: string;
        };
      };
    };

    // Capture session key for agent event routing
    if (response.snapshot?.sessionDefaults?.mainSessionKey) {
      this.sessionKey = response.snapshot.sessionDefaults.mainSessionKey;
      console.log("[Gateway] Session key captured:", this.sessionKey);
    }

    console.log("[Gateway] Handshake complete:", response);
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data) as GatewayMessage;

      // Notify all message handlers
      this.onMessageHandlers.forEach((handler) => handler(message));

      if (message.type === "res") {
        // Handle response to a pending request
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          if (message.ok) {
            pending.resolve(message.payload);
          } else {
            pending.reject(
              new Error(message.error?.message || "Request failed")
            );
          }
        }
      } else if (message.type === "event") {
        // Handle events
        this.handleEvent(message);
      }
    } catch (error) {
      console.error("[Gateway] Failed to parse message:", error);
    }
  }

  private handleEvent(event: GatewayEvent) {
    // Log all events with full payload for debugging
    console.log("[Gateway] Event:", event.event, JSON.stringify(event.payload));

    // Handle agent events - these are streamed events with runId, stream, data
    if (event.event === "agent") {
      const payload = event.payload as AgentEvent;
      console.log("[Gateway] Agent event received:", payload.runId, payload.stream, payload.data);
      this.onAgentEventHandlers.forEach((handler) => handler(payload));
    }
  }

  // Agent event handlers (for streaming events)
  private onAgentEventHandlers: ((event: AgentEvent) => void)[] = [];

  onAgentEvent(handler: (event: AgentEvent) => void) {
    this.onAgentEventHandlers.push(handler);
  }

  offAgentEvent(handler: (event: AgentEvent) => void) {
    const index = this.onAgentEventHandlers.indexOf(handler);
    if (index > -1) {
      this.onAgentEventHandlers.splice(index, 1);
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[Gateway] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(
      `[Gateway] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch((err) => {
        console.error("[Gateway] Reconnect failed:", err);
      });
    }, delay);
  }

  private async sendRequest(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = `${++this.messageId}`;
      const request = {
        type: "req" as const,
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);

      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Send a message to the OpenClaw agent and get a response
   * Wraps user message with instructions to return structured response with TTS summary
   */
  async sendToAgent(text: string): Promise<AgentResponse> {
    // Generate a unique idempotency key for this request
    const idempotencyKey = `liveavatar-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Wrap user message with instructions for structured response
    const wrappedMessage = `${text}

[RESPONSE FORMAT: Start with a 3-5 sentence spoken summary wrapped in [TTS]...[/TTS] tags that captures the key points of your response, then provide your full detailed response. The TTS summary should be informative and conversational, giving the user the gist while they read the full text. Example:
[TTS]Here's what I found. The main issue is X, which can be solved by Y. I'd recommend starting with Z approach because it's the most straightforward.[/TTS]
Full detailed response here with all the specifics...]`;

    const params: Record<string, unknown> = {
      message: wrappedMessage,
      idempotencyKey,
    };

    // Include session key for agent event routing
    if (this.sessionKey) {
      params.sessionKey = this.sessionKey;
    }

    // Include conversation ID for context continuity
    if (this.conversationId) {
      params.conversationId = this.conversationId;
    }

    // Create promise to collect streaming events BEFORE sending request
    // This prevents race condition where events arrive before handler is registered
    let runId: string | null = null;
    let collectedText = "";
    let completed = false;
    let resolveResponse: (value: AgentResponse) => void;
    let rejectResponse: (error: Error) => void;

    // Buffer events that arrive before we have runId
    const bufferedEvents: AgentEvent[] = [];

    const responsePromise = new Promise<AgentResponse>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });

    const timeout = setTimeout(() => {
      this.offAgentEvent(handler);
      rejectResponse(new Error("Agent response timeout"));
    }, 60000);

    // Track processed event sequences to avoid duplicates
    const processedSeqs = new Set<number>();

    const processEvent = (event: AgentEvent) => {
      if (completed) return;

      // Deduplicate events by sequence number
      if (event.seq !== undefined && processedSeqs.has(event.seq)) {
        return; // Skip duplicate event
      }
      if (event.seq !== undefined) {
        processedSeqs.add(event.seq);
      }

      console.log("[Gateway] Agent event:", event.stream, event.seq, event.data?.delta?.substring(0, 20));

      // Collect text from assistant stream - use delta (incremental) not text (cumulative)
      if (event.stream === "assistant") {
        // Only use delta for incremental text
        if (event.data?.delta) {
          collectedText += event.data.delta;
        }
      }

      // Check for lifecycle end
      if (event.stream === "lifecycle" && event.data?.phase === "end") {
        completed = true;
        clearTimeout(timeout);
        this.offAgentEvent(handler);
        resolveResponse({
          runId: runId!,
          status: "completed",
          text: collectedText || undefined,
        });
      }

      // Check for lifecycle error
      if (event.stream === "lifecycle" && event.data?.phase === "error") {
        completed = true;
        clearTimeout(timeout);
        this.offAgentEvent(handler);
        resolveResponse({
          runId: runId!,
          status: "failed",
          text: event.data?.error || "Agent encountered an error",
        });
      }
    };

    const handler = (event: AgentEvent) => {
      // If we don't have runId yet, buffer all events
      if (!runId) {
        bufferedEvents.push(event);
        return;
      }

      // Only handle events for this run
      if (event.runId !== runId) {
        return;
      }

      processEvent(event);
    };

    // Register handler BEFORE sending request
    this.onAgentEvent(handler);

    try {
      const response = (await this.sendRequest("agent", params)) as {
        runId: string;
        status: string;
        conversationId?: string;
      };

      console.log("[Gateway] Agent request accepted:", response);

      // Now set runId
      runId = response.runId;

      // Store conversation ID for future messages
      if (response.conversationId) {
        this.conversationId = response.conversationId;
      }

      // Process any buffered events that match this runId
      for (const event of bufferedEvents) {
        if (event.runId === runId) {
          processEvent(event);
        }
      }
    } catch (error) {
      clearTimeout(timeout);
      this.offAgentEvent(handler);
      throw error;
    }

    return responsePromise;
  }

  /**
   * Get current connection status
   */
  async getStatus(): Promise<unknown> {
    return this.sendRequest("status");
  }

  /**
   * Parse structured response to extract TTS summary and full message
   * Expected format:
   * [TTS]Short summary for speech[/TTS]
   * Full detailed response...
   */
  parseResponse(text: string): { tts: string; full: string } {
    // Look for [TTS]...[/TTS] block
    const ttsMatch = text.match(/\[TTS\]([\s\S]*?)\[\/TTS\]/i);

    if (ttsMatch) {
      const ttsSummary = ttsMatch[1].trim();
      // Remove the entire TTS block from display message
      const fullMessage = text.replace(/\[TTS\][\s\S]*?\[\/TTS\]\n?/i, "").trim();
      console.log("[Gateway] Parsed TTS summary:", ttsSummary.length, "chars");
      return { tts: ttsSummary, full: fullMessage || text };
    }

    // Fallback: extract first 3-5 sentences as TTS
    console.log("[Gateway] No [TTS] block found, extracting first sentences");
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];

    let tts = "";
    const maxSentences = 5;
    const maxChars = 400; // Allow longer TTS for more informative summary

    for (let i = 0; i < Math.min(maxSentences, sentences.length); i++) {
      const sentence = sentences[i].trim();
      if (tts.length + sentence.length > maxChars && tts.length > 0) break;
      tts += (tts ? " " : "") + sentence;
    }

    return {
      tts: tts || this.truncateToSentences(text, 300),
      full: text
    };
  }

  /**
   * Truncate text to complete sentences within a max length
   */
  private truncateToSentences(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const truncated = text.substring(0, maxLength);
    const lastSentence = Math.max(
      truncated.lastIndexOf(". "),
      truncated.lastIndexOf("! "),
      truncated.lastIndexOf("? "),
      truncated.lastIndexOf(".\n"),
      truncated.lastIndexOf("!\n"),
      truncated.lastIndexOf("?\n")
    );

    if (lastSentence > maxLength * 0.5) {
      return truncated.substring(0, lastSentence + 1).trim();
    }

    // Fall back to cutting at last space
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace).trim() + "...";
    }

    return truncated.trim() + "...";
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState("disconnected");
  }

  // Event subscription methods
  onMessage(handler: MessageHandler) {
    this.onMessageHandlers.push(handler);
  }

  offMessage(handler: MessageHandler) {
    const index = this.onMessageHandlers.indexOf(handler);
    if (index > -1) {
      this.onMessageHandlers.splice(index, 1);
    }
  }

  onConnectionState(handler: ConnectionStateHandler) {
    this.onConnectionStateHandlers.push(handler);
  }

  offConnectionState(handler: ConnectionStateHandler) {
    const index = this.onConnectionStateHandlers.indexOf(handler);
    if (index > -1) {
      this.onConnectionStateHandlers.splice(index, 1);
    }
  }

}

// Singleton instance for the app
let gatewayClient: OpenClawGatewayClient | null = null;

export function getGatewayClient(): OpenClawGatewayClient {
  if (!gatewayClient) {
    // Get config from environment or use defaults
    const url =
      typeof window !== "undefined"
        ? (window as unknown as { __OPENCLAW_GATEWAY_URL?: string })
            .__OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789"
        : "ws://127.0.0.1:18789";
    const token =
      typeof window !== "undefined"
        ? (window as unknown as { __OPENCLAW_GATEWAY_TOKEN?: string })
            .__OPENCLAW_GATEWAY_TOKEN || ""
        : "";

    gatewayClient = new OpenClawGatewayClient(url, token);
  }
  return gatewayClient;
}
