# mi-v4-admin-api

Minimal NestJS API that powers the **Mission Inbox v4 deployment management assistant**. Each endpoint opens an Anthropic Claude streaming session and pipes the response back to the caller via **Server-Sent Events (SSE)**.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/deploy` | Prepare a deploy plan for a given repo |
| `GET` | `/pending` | Stream a pending-deploy report across repos |
| `GET` | `/release-notes` | Stream structured release notes from the latest deploy PR |
| `GET` | `/status` | Stream a pipeline status summary |

## Getting started

```bash
# Install dependencies
npm install

# Copy and fill in env vars
cp .env.example .env

# Run in development (watch mode)
npm run start:dev
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key (`sk-ant-...`) |
| `ANTHROPIC_MODEL` | optional | Model to use (default: `claude-opus-4-5`) |
| `PORT` | optional | HTTP port (default: `3000`) |

## Consuming SSE

### GET endpoints (EventSource)
```js
const es = new EventSource('http://localhost:3000/status');
es.onmessage = ({ data }) => {
  if (data === '[DONE]') return es.close();
  process.stdout.write(data);
};
```

### POST /deploy (fetch)
```js
const res = await fetch('http://localhost:3000/deploy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ repo: 'my-api', org: 'my-org' }),
});
const reader = res.body.getReader();
const dec = new TextDecoder();
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  process.stdout.write(dec.decode(value));
}
```

## Deploy to DigitalOcean App Platform

```bash
# Install the doctl CLI, then:
doctl apps create --spec .do/app.yaml
```

Set `ANTHROPIC_API_KEY` as a secret in the App Platform dashboard after creation.

## Architecture

```
AppModule
  └── AppController   # Route handlers — one per endpoint
  └── AppService      # Anthropic session management + SSE Observable factory
```

Each request lifecycle:
1. Controller receives the request and sets SSE headers (POST) or returns an Observable (GET).
2. `AppService.streamSession()` opens an Anthropic `messages.stream()` session.
3. Each `text_delta` event is forwarded as an SSE `data:` frame.
4. A final `data: [DONE]` frame signals end-of-stream and the session is closed.
