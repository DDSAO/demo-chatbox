# Chat MVP

A minimal **AI chat** web app: one conversation per browser session, powered by **Google Gemini**, persisted in **PostgreSQL** via **Drizzle ORM**. Users can **edit** and **delete** their own messages; the UI and data model stay intentionally small so the product stays easy to reason about and extend.

**Scope (by design)**

- **Product**: Single-page chat box with streaming assistant replies and markdown rendering.
- **Data model**: One `session` row per visit and `chat` rows for user/assistant turns—no users, teams, or multi-chat navigation.
- **Design**: Bare-bones styling; polish is out of scope for this MVP.

**Stack**: [Next.js](https://nextjs.org) (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Drizzle · `pg` · `@google/generative-ai`

---

## Prerequisites

- **Node.js** (LTS recommended)
- **pnpm** (`corepack enable` or `npm i -g pnpm`)
- A running **PostgreSQL** instance you can connect to (local Docker, Postgres.app, or a hosted URL)

---

## Run locally

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Environment variables**

   Copy the example file and fill in real values:

   ```bash
   cp .env.example .env.development
   ```

   This project loads **`.env.development`** for local development (Next.js in `development` mode and `drizzle-kit` both read it—see `drizzle.config.ts`). For production, set the same variables in your host’s environment or `.env.production` as your deployment expects.

   | Variable | Required | Purpose |
   |----------|----------|---------|
   | `GEMINI_API_KEY` | Yes | Google AI Studio / Gemini API key |
   | `PG_HOST` | Yes | Postgres host |
   | `PG_PORT` | No | Defaults to `5432` |
   | `PG_USERNAME` | Yes | DB user |
   | `PG_PASSWORD` | Yes | DB password |
   | `PG_DATABASE` | Yes | Database name |
   | `PG_SSL` | No | Set to `true` if the server requires SSL |

3. **Apply the database schema**

   Easiest for a fresh local DB:

   ```bash
   pnpm db:push
   ```

   Alternatively, use migrations:

   ```bash
   pnpm db:migrate
   ```

   Tables are created under the Postgres schema **`demo`** (`demo.session`, `demo.chat`)—see `db/schema.ts`.

4. **Start the dev server**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

**Other scripts**

| Command | Description |
|---------|-------------|
| `pnpm build` | Production build |
| `pnpm start` | Run production server (after `build`) |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate a new migration from schema changes |
| `pnpm db:studio` | Open Drizzle Studio against your DB |

---

## Project structure

```text
my-app/
├── app/                      # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx              # Home — renders <Chat />
│   └── globals.css
├── actions/
│   ├── ai/index.ts           # Server actions: Gemini streaming / completion
│   └── db/index.ts           # Server actions: session + messages (CRUD, soft delete)
├── components/Chat/          # Chat UI (composer, list, edit/delete for user messages)
│   ├── index.tsx
│   ├── UserMessageItem.tsx
│   ├── AssistantMessageItem.tsx
│   ├── MarkdownComponents.tsx
│   └── helpers.ts
├── db/
│   ├── schema.ts             # Drizzle schema: demo.session, demo.chat
│   └── index.ts              # Pool + Drizzle client
├── drizzle/                  # SQL migrations (generated / applied by Drizzle Kit)
├── lib/
│   └── ai.ts                 # Shared types: models, roles, chat turn shapes
├── drizzle.config.ts         # Drizzle Kit config (loads .env.development)
├── next.config.ts
├── package.json
├── .env.example              # Template for local secrets (copy → .env.development)
└── README.md
```

---

## Deploying

Configure the same environment variables on your platform. Ensure Postgres is reachable from the app and run migrations (or `db:push` in non-production sandboxes only). For Vercel-style deploys, prefer managed Postgres with SSL and set `PG_SSL=true` if required.

---

## Learn more

- [Next.js documentation](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Google AI Gemini API](https://ai.google.dev/)
