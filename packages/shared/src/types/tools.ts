export type PermissionLevel = 'auto' | 'confirm';

export type PermissionResponse = 'allow' | 'deny' | 'always-project' | 'always-global' | 'deny-project' | 'deny-global';

export type ToolCategory = 'read' | 'write' | 'search' | 'git' | 'test' | 'github' | 'system';

export interface ToolMetadata {
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
  /** Usage tips and best practices for this tool */
  hints?: string;
  /** Tool category for grouping in system prompt */
  category?: ToolCategory;
}
