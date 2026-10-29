export type AITransport = 'direct' | 'relay';

export interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** `direct` calls the provider from the browser. `relay` routes through this app's server. */
  transport: AITransport;
  /** Explicit consent for sending the API key through the server relay. */
  relayConsent: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: number;
  /** Optional base64 or URL image attachment for multimodal vision requests. */
  image?: string;
  /** Raw completion string from the model, preserved for consistent multi-turn history. */
  raw?: string;
  /** Human-readable summaries of project changes applied automatically. */
  applied?: string[];
  /** Actions or fields that were rejected by validation. */
  skipped?: string[];
}
