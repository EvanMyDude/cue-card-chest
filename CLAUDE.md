# CLAUDE.md — Prompt Library

## Project Overview
A local-first prompt library web app for storing, organizing, and syncing AI prompts. Works offline via localStorage; cloud sync is opt-in via Supabase authentication.

## Tech Stack
- **Framework:** React 18 + TypeScript + Vite (SWC)
- **Styling:** Tailwind CSS 3 + shadcn/ui (Radix primitives)
- **Backend:** Supabase (Postgres + Auth — own project, native OAuth)
- **Hosting:** Cloudflare Pages (`cue-card-chest.pages.dev`)
- **State:** TanStack React Query + custom hooks
- **Routing:** React Router DOM v6
- **Forms:** React Hook Form + Zod validation
- **Drag & Drop:** @dnd-kit
- **Export:** jsPDF (PDF), custom JSON import/export

## Commands
```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # ESLint
npm run preview    # Preview production build
npm run deploy     # Build for GitHub Pages + deploy
```

## Project Structure
```
src/
├── pages/           # Route pages (Index.tsx is the main app)
├── components/      # App components + ui/ (shadcn)
├── hooks/           # Custom React hooks (core logic lives here)
├── utils/           # PDF/JSON export, prompt merging
├── types/           # TypeScript interfaces (Prompt type)
├── integrations/    # Supabase client & types
├── lib/             # Shared utilities (cn helper)
├── App.tsx          # Router + providers setup
└── main.tsx         # Entry point

supabase/
├── config.toml              # Supabase project config (project ref)
└── functions/
    └── import-pack/         # Edge function: import starter prompt packs
        └── index.ts
```

## Key Architecture Patterns

### Local-First Data Flow
- Prompts are always persisted to localStorage first
- Cloud sync layer activates only when authenticated via Supabase
- `usePrompts` hook manages dual-storage (local + remote) with optimistic updates
- `useSyncEnabled` controls migration state between local-only and synced modes

### Core Files
| File | Responsibility |
|------|---------------|
| `src/pages/Index.tsx` | Main page — search, grid, drag-and-drop, all UI state |
| `src/hooks/usePrompts.ts` | CRUD operations, sync logic, reordering |
| `src/hooks/useAuth.ts` | Auth (email, magic link, Google OAuth — all native Supabase) |
| `src/hooks/useSyncEnabled.ts` | Migration wizard state, sync control |
| `src/components/PromptForm.tsx` | Create/edit form with client-side "Smart Title" generation |
| `src/components/PromptCard.tsx` | Display card for a prompt |
| `src/types/prompt.ts` | `Prompt` interface definition |
| `src/integrations/supabase/client.ts` | Supabase client initialization |
| `src/integrations/supabase/types.ts` | Auto-generated database types |

### Authentication (Native Supabase)
- All auth flows use native Supabase methods — no third-party wrappers
- **Google OAuth:** `supabase.auth.signInWithOAuth({ provider: 'google' })` — redirects to Google consent, then to Supabase callback, then back to app
- **Email/Password:** `supabase.auth.signInWithPassword()` / `supabase.auth.signUp()`
- **Magic Link:** `supabase.auth.signInWithOtp()` — sends email with login link
- Session is persisted in localStorage and auto-refreshed by the Supabase client
- `useAuth` hook manages auth state via `onAuthStateChange` listener + `getSession()`

### Database Schema (Supabase Postgres)
9 tables with Row Level Security (RLS):
- **`prompts`** — User's saved prompts (title, content, checksum, order, pinned, etc.)
- **`tags`** — User's tags
- **`prompt_tags`** — Many-to-many join between prompts and tags
- **`devices`** — Registered sync devices per user
- **`sync_state`** — Per-device sync status tracking
- **`prompt_revisions`** — Version history for conflict resolution
- **`user_roles`** — Admin/user role assignments
- **`prompt_packs`** — Curated prompt collections (public read)
- **`pack_prompts`** — Individual prompts within packs (public read)

Key functions: `compute_checksum()` (SHA-256 dedup), `handle_updated_at()` (trigger), `has_role()` (RBAC)

### Edge Functions
- **`import-pack`** — Imports a prompt pack into user's library with checksum-based deduplication. Deployed to Supabase (`verify_jwt = false`, handles auth internally).
- **Smart Title** — Client-side title generation from prompt content (no server call). Extracts first sentence/phrase, strips markdown, caps at 50 chars.

### Prompt Type
```typescript
interface Prompt {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}
```

## Conventions

### Imports
- Use `@/` path alias for all src imports (maps to `./src/`)
- shadcn components live in `@/components/ui/`

### Styling
- Use Tailwind utility classes; avoid inline styles
- Colors use CSS variables via HSL: `hsl(var(--primary))`, `hsl(var(--background))`, etc.
- Dark mode supported via `class` strategy
- shadcn/ui components are the standard building blocks — use them before creating custom UI

### TypeScript
- Relaxed strict mode: `noImplicitAny`, `strictNullChecks`, and `noUnusedLocals` are off
- Unused vars ESLint rule is disabled
- All component files use `.tsx`; utility files use `.ts`

### State Management
- Server/async state: TanStack React Query
- Local UI state: React hooks (`useState`, `useReducer`)
- Persistent local state: `useLocalStorage` hook
- No global state library — state flows through hooks

### Components
- shadcn/ui config: default style, slate base color, CSS variables enabled
- New shadcn components can be added via `npx shadcn-ui@latest add <component>`

## Deployment

### Cloudflare Pages
- **Production branch:** `cloudflare-live`
- **Build command:** `npm ci && npm run build`
- **Output directory:** `dist`
- **Environment variables (Production):**
  - `VITE_SUPABASE_URL` — Supabase project URL
  - `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon (public) key
- Vite bakes `VITE_`-prefixed env vars into the bundle at build time

### Supabase
- **Project ref:** `pgglvjfmhhaqlfhcejcz`
- **Auth providers:** Google OAuth, Email/Password, Magic Link
- **Redirect URLs configured for:** `https://cue-card-chest.pages.dev`, `http://localhost:8080`
- **Edge functions deployed via:** `npx supabase functions deploy <name> --project-ref pgglvjfmhhaqlfhcejcz`

### Git Branches
- `main` — Primary development branch
- `dev` — Tracks main
- `cloudflare-live` — Production deployment branch (Cloudflare Pages watches this)
- `feature/prompt-packs` — Backup of prior Lovable-connected dev work

## Environment
- `.env` contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID`
- Never commit `.env` — it is gitignored
- Dev server runs on port 8080
