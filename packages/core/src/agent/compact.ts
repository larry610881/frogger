import { generateText, type LanguageModel, type ModelMessage } from 'ai';
import { COMPACT_PRESERVE_RECENT } from '@frogger/shared';

export interface CompactResult {
  messages: ModelMessage[];
  summary: string;
  compactedCount: number;
}

const COMPACT_SYSTEM_PROMPT = `You are a conversation summarizer. Summarize the conversation history concisely while preserving:
- File paths that were read, edited, or created
- Key decisions and their reasoning
- Code changes and their purpose
- Error messages and how they were resolved
- Any pending tasks or next steps

Output ONLY the summary, no preamble.`;

/**
 * Compact messages by summarizing older ones and preserving recent ones.
 */
export async function compactMessages(
  model: LanguageModel,
  messages: ModelMessage[],
  preserveRecent: number = COMPACT_PRESERVE_RECENT,
): Promise<CompactResult> {
  if (messages.length <= preserveRecent) {
    return { messages: [...messages], summary: '', compactedCount: 0 };
  }

  const oldMessages = messages.slice(0, messages.length - preserveRecent);
  const recentMessages = messages.slice(messages.length - preserveRecent);

  // Build text representation of old messages for summarization
  const conversationText = oldMessages
    .map(msg => {
      const role = msg.role;
      const content = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map(p => 'text' in p ? p.text : '').join('\n')
          : '';
      return `[${role}]: ${content}`;
    })
    .join('\n\n');

  const { text: summary } = await generateText({
    model,
    system: COMPACT_SYSTEM_PROMPT,
    prompt: `Summarize the following conversation:\n\n${conversationText}`,
  });

  const summaryMessage: ModelMessage = {
    role: 'user',
    content: `[Conversation Summary]\n${summary}\n[End of Summary]`,
  };

  return {
    messages: [summaryMessage, ...recentMessages],
    summary,
    compactedCount: oldMessages.length,
  };
}
