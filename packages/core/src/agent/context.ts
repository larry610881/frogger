import type { ModelMessage } from 'ai';

export class AgentContext {
  readonly workingDirectory: string;
  private messages: ModelMessage[] = [];

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory;
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content });
  }

  addAssistantMessage(content: string): void {
    this.messages.push({ role: 'assistant', content });
  }

  getMessages(): ModelMessage[] {
    return [...this.messages];
  }

  getLastMessages(n: number): ModelMessage[] {
    return this.messages.slice(-n);
  }

  clear(): void {
    this.messages = [];
  }
}
