import type { ModelMessage } from 'ai';
import { compactMessages } from '../compact.js';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

// Import after mock setup so we get the mocked version
const { generateText } = await import('ai');
const mockGenerateText = vi.mocked(generateText);

function createMockModel() {
  return {} as import('ai').LanguageModel;
}

function makeUserMessage(text: string): ModelMessage {
  return { role: 'user', content: text };
}

function makeAssistantMessage(text: string): ModelMessage {
  return { role: 'assistant', content: text };
}

describe('compactMessages', () => {
  const model = createMockModel();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateText.mockResolvedValue({ text: 'Mock summary of conversation.' } as never);
  });

  // ── Short-circuit cases ──────────────────────────────────────────────

  it('returns empty array and no summary when messages array is empty', async () => {
    const result = await compactMessages(model, []);

    expect(result.messages).toEqual([]);
    expect(result.summary).toBe('');
    expect(result.compactedCount).toBe(0);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('returns copy of messages unchanged when count is less than preserveRecent', async () => {
    const messages: ModelMessage[] = [
      makeUserMessage('hello'),
      makeAssistantMessage('hi'),
    ];

    const result = await compactMessages(model, messages);

    expect(result.messages).toEqual(messages);
    expect(result.messages).not.toBe(messages); // must be a copy
    expect(result.summary).toBe('');
    expect(result.compactedCount).toBe(0);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('returns copy of messages unchanged when count equals preserveRecent', async () => {
    const messages: ModelMessage[] = [
      makeUserMessage('msg 1'),
      makeAssistantMessage('msg 2'),
      makeUserMessage('msg 3'),
      makeAssistantMessage('msg 4'),
    ];

    const result = await compactMessages(model, messages);

    expect(result.messages).toEqual(messages);
    expect(result.messages).not.toBe(messages);
    expect(result.summary).toBe('');
    expect(result.compactedCount).toBe(0);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // ── Normal compaction ────────────────────────────────────────────────

  it('compacts old messages and preserves the last 4 (default preserveRecent)', async () => {
    const messages: ModelMessage[] = [
      makeUserMessage('old 1'),
      makeAssistantMessage('old 2'),
      makeUserMessage('recent 1'),
      makeAssistantMessage('recent 2'),
      makeUserMessage('recent 3'),
      makeAssistantMessage('recent 4'),
    ];

    const result = await compactMessages(model, messages);

    // 1 summary + 4 recent = 5 messages total
    expect(result.messages).toHaveLength(5);
    // Recent messages are preserved verbatim
    expect(result.messages.slice(1)).toEqual(messages.slice(2));
    expect(result.compactedCount).toBe(2);
    expect(result.summary).toBe('Mock summary of conversation.');
    expect(mockGenerateText).toHaveBeenCalledOnce();
  });

  it('produces summary message with role "user"', async () => {
    const messages: ModelMessage[] = [
      makeUserMessage('old'),
      makeAssistantMessage('old resp'),
      makeUserMessage('r1'),
      makeAssistantMessage('r2'),
      makeUserMessage('r3'),
      makeAssistantMessage('r4'),
    ];

    const result = await compactMessages(model, messages);
    const summaryMsg = result.messages[0]!;

    expect(summaryMsg.role).toBe('user');
  });

  it('formats summary message with [Conversation Summary] and [End of Summary]', async () => {
    const messages: ModelMessage[] = [
      makeUserMessage('old'),
      makeAssistantMessage('old resp'),
      makeUserMessage('r1'),
      makeAssistantMessage('r2'),
      makeUserMessage('r3'),
      makeAssistantMessage('r4'),
    ];

    const result = await compactMessages(model, messages);
    const summaryContent = result.messages[0]!.content as string;

    expect(summaryContent).toMatch(/^\[Conversation Summary\]/);
    expect(summaryContent).toMatch(/\[End of Summary\]$/);
    expect(summaryContent).toContain('Mock summary of conversation.');
  });

  it('sets compactedCount to the number of old messages removed', async () => {
    const messages: ModelMessage[] = [
      makeUserMessage('old 1'),
      makeAssistantMessage('old 2'),
      makeUserMessage('old 3'),
      makeUserMessage('r1'),
      makeAssistantMessage('r2'),
      makeUserMessage('r3'),
      makeAssistantMessage('r4'),
    ];

    const result = await compactMessages(model, messages);

    expect(result.compactedCount).toBe(3);
  });

  // ── Content serialization ────────────────────────────────────────────

  it('serializes string content messages into [role]: content format', async () => {
    const messages: ModelMessage[] = [
      makeUserMessage('please read file.ts'),
      makeAssistantMessage('I will read it'),
      makeUserMessage('r1'),
      makeAssistantMessage('r2'),
      makeUserMessage('r3'),
      makeAssistantMessage('r4'),
    ];

    await compactMessages(model, messages);

    const call = mockGenerateText.mock.calls[0]![0]!;
    const prompt = call.prompt as string;

    expect(prompt).toContain('[user]: please read file.ts');
    expect(prompt).toContain('[assistant]: I will read it');
  });

  it('serializes array content messages by extracting text parts', async () => {
    const arrayContentMsg: ModelMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'first part' },
        { type: 'text', text: 'second part' },
      ],
    };

    const messages: ModelMessage[] = [
      arrayContentMsg,
      makeAssistantMessage('response'),
      makeUserMessage('r1'),
      makeAssistantMessage('r2'),
      makeUserMessage('r3'),
      makeAssistantMessage('r4'),
    ];

    await compactMessages(model, messages);

    const call = mockGenerateText.mock.calls[0]![0]!;
    const prompt = call.prompt as string;

    expect(prompt).toContain('[user]: first part\nsecond part');
  });

  // ── Custom preserveRecent ────────────────────────────────────────────

  it('respects custom preserveRecent parameter', async () => {
    const messages: ModelMessage[] = [
      makeUserMessage('old 1'),
      makeAssistantMessage('old 2'),
      makeUserMessage('old 3'),
      makeAssistantMessage('recent 1'),
      makeUserMessage('recent 2'),
    ];

    const result = await compactMessages(model, messages, 2);

    // 1 summary + 2 recent = 3 messages
    expect(result.messages).toHaveLength(3);
    expect(result.compactedCount).toBe(3);
    // Last 2 messages preserved
    expect(result.messages.slice(1)).toEqual(messages.slice(3));
    expect(mockGenerateText).toHaveBeenCalledOnce();
  });
});
