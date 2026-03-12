import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebSearchTool, TavilySearchProvider } from '../web-search.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('createWebSearchTool', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.TAVILY_API_KEY;
    mockFetch.mockReset();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TAVILY_API_KEY = originalEnv;
    } else {
      delete process.env.TAVILY_API_KEY;
    }
  });

  it('returns friendly error when TAVILY_API_KEY is not set', async () => {
    delete process.env.TAVILY_API_KEY;
    const webSearch = createWebSearchTool('/workspace');
    const result = await webSearch.execute({ query: 'test query', maxResults: 5 }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });
    expect(result).toContain('Web search is not configured');
    expect(result).toContain('TAVILY_API_KEY');
  });

  it('returns formatted results on successful search', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { title: 'Result One', url: 'https://example.com/1', content: 'First result snippet' },
          { title: 'Result Two', url: 'https://example.com/2', content: 'Second result snippet' },
        ],
      }),
    });

    const webSearch = createWebSearchTool('/workspace');
    const result = await webSearch.execute({ query: 'test query', maxResults: 5 }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });
    expect(result).toContain('**Result One**');
    expect(result).toContain('https://example.com/1');
    expect(result).toContain('First result snippet');
    expect(result).toContain('**Result Two**');
    expect(result).toContain('https://example.com/2');
    expect(result).toContain('Second result snippet');
  });

  it('returns error message on API failure', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const webSearch = createWebSearchTool('/workspace');
    const result = await webSearch.execute({ query: 'test query', maxResults: 5 }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });
    expect(result).toContain('Web search failed');
    expect(result).toContain('401');
  });

  it('returns "No results found" when results are empty', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const webSearch = createWebSearchTool('/workspace');
    const result = await webSearch.execute({ query: 'obscure query', maxResults: 5 }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });
    expect(result).toBe('No results found for: obscure query');
  });
});

describe('TavilySearchProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls Tavily API with correct request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { title: 'Test', url: 'https://example.com', content: 'A snippet' },
        ],
      }),
    });

    const provider = new TavilySearchProvider('my-api-key');
    const results = await provider.search('typescript guide', 3);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: 'my-api-key',
        query: 'typescript guide',
        max_results: 3,
        search_depth: 'basic',
      }),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      title: 'Test',
      url: 'https://example.com',
      snippet: 'A snippet',
    });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const provider = new TavilySearchProvider('my-api-key');
    await expect(provider.search('query', 5)).rejects.toThrow('Tavily API error: 500');
  });
});
