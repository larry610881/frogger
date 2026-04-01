export interface AuditEvent {
  timestamp: string;
  tool: string;
  args: Record<string, unknown>;
  result: 'success' | 'error' | 'denied';
  durationMs: number;
  mode: string;
  sessionId?: string;
  provider: string;
  model: string;
}

export interface AuditConfig {
  enabled: boolean;
  endpoint?: string;
}
