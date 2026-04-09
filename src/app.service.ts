import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  private readonly client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  private readonly model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-5';

  /**
   * Creates an Anthropic managed-agent session, streams the response,
   * and emits SSE MessageEvents until the session is complete.
   */
  streamSession(
    userMessage: string,
    systemPrompt: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      void (async () => {
        this.logger.log(`Starting agent session | model=${this.model}`);

        try {
          // Open a streaming messages session (managed agent turn)
          const stream = this.client.messages.stream({
            model: this.model,
            max_tokens: 8096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          });

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              subscriber.next({ data: event.delta.text } as MessageEvent);
            }
          }

          // Signal end-of-stream to the client
          subscriber.next({ data: '[DONE]' } as MessageEvent);
          subscriber.complete();
          this.logger.log('Agent session closed.');
        } catch (err) {
          this.logger.error('Agent session error', err);
          subscriber.error(err);
        }
      })();
    });
  }
}
