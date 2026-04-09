import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Post,
  Res,
  Sse,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { AppService } from './app.service';

const SYSTEM_PROMPT = `
You are a deployment management assistant that helps engineers ship to production reliably.
You have deep knowledge of CI/CD pipelines, semantic versioning, conventional commits,
and multi-repo release coordination. Always be concise, structured, and actionable.
Use markdown formatting in your responses.
`.trim();

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * POST /deploy
   * Body: { repo: string, org?: string, base?: string, head?: string }
   * Opens an Anthropic agent session and streams a deploy preparation plan.
   */
  @Post('deploy')
  deploy(
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const message = [
      'Prepare a deploy for the following repository configuration:',
      '```json',
      JSON.stringify(body, null, 2),
      '```',
      'Compare main vs prod, categorise commits by conventional type, and draft a deploy PR description.',
    ].join('\n');

    this.appService.streamSession(message, SYSTEM_PROMPT).subscribe({
      next: (event: MessageEvent) =>
        res.write(`data: ${String(event.data)}\n\n`),
      error: (err: unknown) => {
        res.write(
          `data: ${JSON.stringify({ error: String(err) })}\n\n`,
        );
        res.end();
      },
      complete: () => res.end(),
    });
  }

  /**
   * GET /pending
   * Opens an Anthropic agent session and streams a pending-deploy report.
   */
  @Sse('pending')
  pending(): Observable<MessageEvent> {
    return this.appService.streamSession(
      [
        'Scan all known repositories and identify what is waiting to be deployed to prod.',
        'For each repo report: status (up-to-date | pending | error), number of commits waiting,',
        'authors involved, and a brief summary of change types.',
        'Flag any repos that appear stale (pending for an unusually long time).',
        'Summarise results in a clear markdown table.',
      ].join(' '),
      SYSTEM_PROMPT,
    );
  }

  /**
   * GET /release-notes
   * Opens an Anthropic agent session and streams structured release notes.
   */
  @Sse('release-notes')
  releaseNotes(): Observable<MessageEvent> {
    return this.appService.streamSession(
      [
        'Generate structured release notes from the most recently merged main→prod deploy PR.',
        'Group changes by type: ✨ Features, 🐛 Bug Fixes, ⚠️ Breaking Changes, 🔧 Chores & Refactors, 📦 Other.',
        'Include abbreviated commit SHA and PR number for each entry.',
        'Suggest a semantic version tag based on the highest-impact change type.',
      ].join(' '),
      SYSTEM_PROMPT,
    );
  }

  /**
   * GET /status
   * Opens an Anthropic agent session and streams a pipeline status summary.
   */
  @Sse('status')
  status(): Observable<MessageEvent> {
    return this.appService.streamSession(
      [
        'Give a brief, structured status summary of the current deployment pipeline.',
        'Include: overall health, any repos with open deploy PRs, any blocked or failing deploys,',
        'and a recommended next action if applicable.',
      ].join(' '),
      SYSTEM_PROMPT,
    );
  }
}
