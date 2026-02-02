// OpenClaw Gateway WebSocket Client
// Connects to the local OpenClaw Gateway to send messages to the agent

import {
  GatewayMessage,
  GatewayResponse,
  GatewayEvent,
  GatewayConnectionState,
  AgentResponse,
} from "./types";

type MessageHandler = (message: GatewayMessage) => void;
type ConnectionStateHandler = (state: GatewayConnectionState) => void;
type AgentResponseHandler = (response: AgentResponse) => void;

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

  // Event handlers
  private onMessageHandlers: MessageHandler[] = [];
  private onConnectionStateHandlers: ConnectionStateHandler[] = [];
  private onAgentResponseHandlers: AgentResponseHandler[] = [];

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
    // Send connect request
    const connectRequest = {
      minProtocol: 1,
      maxProtocol: 1,
      client: {
        name: "openclaw-liveavatar",
        version: "0.1.0",
      },
      role: "operator" as const,
      scopes: ["agent"],
    };

    const response = await this.sendRequest("connect", connectRequest);
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
    console.log("[Gateway] Event:", event.event, event.payload);

    // Handle agent events
    if (event.event === "agent") {
      const payload = event.payload as AgentResponse;
      this.onAgentResponseHandlers.forEach((handler) => handler(payload));
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
   */
  async sendToAgent(text: string): Promise<AgentResponse> {
    const params: Record<string, unknown> = {
      text,
    };

    // Include conversation ID for context continuity
    if (this.conversationId) {
      params.conversationId = this.conversationId;
    }

    const response = (await this.sendRequest("agent", params)) as {
      runId: string;
      conversationId?: string;
    };

    // Store conversation ID for future messages
    if (response.conversationId) {
      this.conversationId = response.conversationId;
    }

    // Wait for the agent completion event
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Agent response timeout"));
      }, 60000);

      const handler = (agentResponse: AgentResponse) => {
        if (agentResponse.runId === response.runId) {
          clearTimeout(timeout);
          this.offAgentResponse(handler);
          resolve(agentResponse);
        }
      };

      this.onAgentResponse(handler);
    });
  }

  /**
   * Get current connection status
   */
  async getStatus(): Promise<unknown> {
    return this.sendRequest("status");
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

  onAgentResponse(handler: AgentResponseHandler) {
    this.onAgentResponseHandlers.push(handler);
  }

  offAgentResponse(handler: AgentResponseHandler) {
    const index = this.onAgentResponseHandlers.indexOf(handler);
    if (index > -1) {
      this.onAgentResponseHandlers.splice(index, 1);
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
