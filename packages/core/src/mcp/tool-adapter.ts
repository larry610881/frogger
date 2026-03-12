import { tool } from 'ai';
import { z } from 'zod';
import type { Tool } from 'ai';
import type { ToolMetadata } from '@frogger/shared';
import type { MCPClientManager, MCPToolInfo } from './client.js';

/**
 * Convert a JSON Schema object to a Zod schema.
 * Handles common types used in MCP tool definitions.
 */
function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType {
  const type = schema.type as string | undefined;
  const description = schema.description as string | undefined;

  // Handle oneOf → z.union()
  if (schema.oneOf) {
    const variants = (schema.oneOf as Record<string, unknown>[]).map(s => jsonSchemaToZod(s));
    if (variants.length >= 2) {
      return z.union(variants as [z.ZodType, z.ZodType, ...z.ZodType[]]);
    }
    return variants[0] ?? z.unknown();
  }

  // Handle allOf → z.intersection()
  if (schema.allOf) {
    const parts = (schema.allOf as Record<string, unknown>[]).map(s => jsonSchemaToZod(s));
    if (parts.length === 0) return z.unknown();
    return parts.reduce((acc, cur) => z.intersection(acc, cur));
  }

  switch (type) {
    case 'string': {
      let s: z.ZodString = z.string();
      if (schema.enum) {
        // Use z.enum for string enums
        return z.enum(schema.enum as [string, ...string[]]);
      }
      if (description) s = s.describe(description);
      return s;
    }
    case 'number':
    case 'integer': {
      let n: z.ZodNumber = type === 'integer' ? z.number().int() : z.number();
      if (description) n = n.describe(description);
      return n;
    }
    case 'boolean':
      return description ? z.boolean().describe(description) : z.boolean();
    case 'array': {
      const items = schema.items as Record<string, unknown> | undefined;
      const itemSchema = items ? jsonSchemaToZod(items) : z.unknown();
      return z.array(itemSchema);
    }
    case 'object': {
      const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
      const required = (schema.required as string[]) ?? [];

      if (!properties) {
        return z.record(z.string(), z.unknown());
      }

      const shape: Record<string, z.ZodType> = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        let propZod = jsonSchemaToZod(propSchema);
        if (!required.includes(key)) {
          propZod = propZod.optional();
        }
        shape[key] = propZod;
      }
      return z.object(shape);
    }
    default:
      return z.unknown();
  }
}

/**
 * Convert MCP tools to Vercel AI SDK tool format.
 * Tools are prefixed with `mcp-{serverName}-` to avoid conflicts with built-in tools.
 */
export function convertMCPTools(
  serverName: string,
  tools: MCPToolInfo[],
  clientManager: MCPClientManager,
): { tools: Record<string, Tool>; metadata: ToolMetadata[] } {
  const result: Record<string, Tool> = {};
  const metadataList: ToolMetadata[] = [];

  for (const mcpTool of tools) {
    const prefixedName = `mcp-${serverName}-${mcpTool.name}`;
    const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);

    const aiTool = tool({
      description: mcpTool.description ?? `MCP tool: ${mcpTool.name} (from ${serverName})`,
      inputSchema: zodSchema as z.ZodObject<Record<string, z.ZodType>>,
      execute: async (args: Record<string, unknown>) => {
        try {
          const response = await clientManager.callTool(serverName, mcpTool.name, args);
          return typeof response === 'string' ? response : JSON.stringify(response);
        } catch (err) {
          return `MCP tool error: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    });

    result[prefixedName] = aiTool;
    metadataList.push({
      name: prefixedName,
      description: mcpTool.description ?? `MCP tool from ${serverName}`,
      permissionLevel: 'confirm',
    });
  }

  return { tools: result, metadata: metadataList };
}
