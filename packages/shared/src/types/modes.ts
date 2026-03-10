export type ModeName = 'ask' | 'plan' | 'agent';

export type ApprovalPolicy = 'auto' | 'confirm-writes' | 'confirm-all';

export interface ModeConfig {
  name: ModeName;
  displayName: string;
  allowedTools: readonly string[];
  approvalPolicy: ApprovalPolicy;
  systemPromptSuffix: string;
}
