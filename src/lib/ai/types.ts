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
  /** Human-readable summaries of project changes applied automatically. */
  applied?: string[];
  /** Actions or fields that were rejected by validation. */
  skipped?: string[];
}
