export type PermissionLevel = 'auto' | 'confirm';

export type PermissionResponse = 'allow' | 'deny' | 'always-project' | 'always-global';

export interface ToolMetadata {
  name: string;
  description: string;
  permissionLevel: PermissionLevel;
}
