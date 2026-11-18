export interface WhatsAppQueueMessage {
  recipient: string;
  message: string;
  type?: string;
  metadata?: Record<string, unknown>;
}

export interface Env {
  DB: D1Database;
  OTP_KV?: KVNamespace;
  WHATSAPP_QUEUE?: Queue<WhatsAppQueueMessage>;
  ASSETS?: Fetcher;
  JWT_SECRET?: string;
  CPFHUB_API_KEY?: string;
  WHATSAPP_GATEWAY_URL?: string;
}

export interface JwtUserPayload {
  userId: number;
  phone: string;
  type: string;
  exp?: number;
  iat?: number;
}
