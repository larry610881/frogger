import { tool } from 'ai';
import { z } from 'zod';
import type { ToolMetadata } from '@frogger/shared';

export interface SearchProvider {
  search(query: string, maxResults: number): Promise<SearchResult[]>;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export const webSearchMetadata: ToolMetadata = {
  name: 'web-search',
  description: 'Search the web for current information. Returns titles, URLs, and snippets.',
  permissionLevel: 'auto',
};

export class TavilySearchProvider implements SearchProvider {
  constructor(private apiKey: string) {}

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
      }),
    });
    if (!response.ok) throw new Error(`Tavily API error: ${response.status}`);
    const data = await response.json() as { results: Array<{ title: string; url: string; content: string }> };
    return data.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));
  }
}

export function createWebSearchTool(_workingDirectory: string) {
  return tool({
    description: webSearchMetadata.description,
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      maxResults: z.number().min(1).max(10).default(5).describe('Maximum number of results to return'),
    }),
    execute: async ({ query, maxResults }) => {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        return 'Web search is not configured. Set TAVILY_API_KEY environment variable to enable. Get a key at https://tavily.com';
      }
      const provider = new TavilySearchProvider(apiKey);
      try {
        const results = await provider.search(query, maxResults);
        if (results.length === 0) return `No results found for: ${query}`;
        return results.map((r, i) =>
          `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
        ).join('\n\n');
      } catch (error) {
        return `Web search failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
}
