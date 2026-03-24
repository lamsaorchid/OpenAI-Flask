# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Instagram auto-reply bot for "لمسة أوركيد" (Orchid Touch) — uses AI to automatically respond to Instagram post comments in Arabic.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Replit AI Integrations (OpenAI) — `@workspace/integrations-openai-ai-server`

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server + bot worker
│   └── orchid-dashboard/   # React + Vite Arabic RTL dashboard (preview path: /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-openai-ai-server/  # Replit AI OpenAI integration
├── scripts/
└── ...
```

## Bot Architecture

- `artifacts/api-server/src/bot/worker.ts` — background bot worker that polls Instagram every 60s, generates AI replies, posts them, and stores them in the DB
- `artifacts/api-server/src/routes/bot.ts` — REST API for bot control: GET /api/bot/status, GET /api/bot/replies, POST /api/bot/start, POST /api/bot/stop
- `lib/db/src/schema/botReplies.ts` — DB table tracking all replied comment IDs and reply content

## Required Secrets

- `PAGE_ACCESS_TOKEN` — Facebook Page Access Token
- `PAGE_ID` — Facebook Page ID
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — auto-set by Replit AI integration
- `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-set by Replit AI integration
- `DATABASE_URL` — auto-set by Replit DB

## Bot Behavior

1. User clicks "تشغيل البوت" (Start Bot) in the dashboard
2. Bot fetches the Instagram Business Account ID linked to the Facebook Page
3. Every 60 seconds: fetches 5 most recent posts, checks comments, skips already-replied ones
4. For each new comment: generates an Arabic reply using GPT, posts it as a reply, saves to DB
5. Dashboard polls status every 5s and replies every 10s via React Query
