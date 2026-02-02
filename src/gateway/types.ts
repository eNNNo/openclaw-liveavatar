// OpenClaw Gateway WebSocket Protocol Types

export interface GatewayRequest {
  type: "req";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface GatewayResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface GatewayEvent {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: number;
}

export type GatewayMessage = GatewayRequest | GatewayResponse | GatewayEvent;

// Connection handshake
export interface ConnectRequest {
  minProtocol: number;
  maxProtocol: number;
  client: {
    name: string;
    version: string;
  };
  role: "operator" | "node";
  scopes?: string[];
  caps?: string[];
}

export interface ConnectResponse {
  protocol: number;
  policy?: Record<string, unknown>;
}

// Agent request/response
export interface AgentRequest {
  text: string;
  conversationId?: string;
}

export interface AgentResponse {
  runId: string;
  status: "completed" | "failed" | "cancelled";
  summary?: string;
  text?: string;
}

export type GatewayConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";
