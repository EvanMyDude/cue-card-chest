# CLAUDE.md — Prompt Library

## Project Overview
A local-first prompt library web app for storing, organizing, and syncing AI prompts. Works offline via localStorage; cloud sync is opt-in via Supabase authentication.

## Tech Stack
- **Framework:** React 18 + TypeScript + Vite (SWC)
- **Styling:** Tailwind CSS 3 + shadcn/ui (Radix primitives)
- **Backend:** Supabase (Postgres + Auth)
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
├── integrations/    # Supabase client & generated types
├── lib/             # Shared utilities (cn helper)
├── App.tsx          # Router + providers setup
└── main.tsx         # Entry point
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
| `src/hooks/useAuth.ts` | Supabase auth (email, magic link, Google OAuth) |
| `src/hooks/useSyncEnabled.ts` | Migration wizard state, sync control |
| `src/components/PromptForm.tsx` | Create/edit form |
| `src/components/PromptCard.tsx` | Display card for a prompt |
| `src/types/prompt.ts` | `Prompt` interface definition |

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

## Environment
- `.env` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Never commit `.env` — it is gitignored
- Dev server runs on port 8080
