# Documentation Standards Guide

A reusable guide for top-level documentation and inline comments across any project. Apply this to new repos or audit existing ones. The goal: anyone opening the repo for the first time can understand what it does, how it's structured, and why non-obvious decisions were made — without asking the original author.

---

## 1. Top-Level Documentation

### README.md (root)

The README is the front door. It answers five questions in order:

1. **What is this?** — One sentence. What the project does, who it's for.
2. **How do I run it?** — Prerequisites, install steps, environment setup, dev server command. Copy-paste ready.
3. **How is it structured?** — Folder map with one-line descriptions. Not every file — just the top-level folders and key entry points.
4. **How do I deploy it?** — Production build, deploy target, environment variables needed.
5. **How do I contribute?** — Branch strategy, PR conventions, testing requirements.

#### Folder Map Format

```
project/
├── src/               # Application source code
│   ├── app/           # Next.js routes and pages
│   ├── components/    # Reusable UI components
│   ├── lib/           # Shared utilities, API clients, stores
│   └── styles/        # Global styles and design tokens
├── public/            # Static assets served as-is
├── docs/              # Project documentation and specs
├── supabase/          # Database migrations and config
├── tests/             # Test suites
└── scripts/           # Build, deploy, and maintenance scripts
```

Rules:
- Every top-level folder gets a one-line description
- If a folder has a non-obvious purpose, add a local README inside it
- Never describe generated folders (`node_modules`, `.next`, `dist`) — mention them only in `.gitignore`

#### Environment Variables

Document every env var the app needs. Format:

```
VARIABLE_NAME=           # What it does. Where to get it. Required or optional.
```

Group by service (database, auth, API keys, deployment). Include example values for non-secret vars. Never commit actual secrets — reference a `.env.example` file.

### Subfolder READMEs

Only create these when a folder's purpose isn't obvious from its name and the root README's folder map. When you do:

- Keep it under 20 lines
- Explain what the folder contains and how its contents relate
- Don't duplicate the root README

### Architecture Docs (optional, for complex projects)

If the project has non-trivial architecture (multiple services, async pipelines, complex state management), create `docs/architecture.md`:

- System diagram (text-based, e.g., Mermaid or ASCII)
- Data flow: how a request moves through the system
- Key design decisions and why they were made
- What talks to what (APIs, databases, external services)

Keep it under 200 lines. If it's longer, the architecture is too complex or the doc is too detailed.

---

## 2. Inline Comments

### When to Comment

Comment the **why**, never the **what**. Code already says what it does through naming. Comments explain:

- **Hidden constraints** — "This must run before X because Y depends on Z being initialized"
- **Non-obvious business logic** — "We round up here because billing requires whole cents"
- **Workarounds** — "Safari doesn't support X, so we do Y instead"
- **Performance decisions** — "Batching these reduces API calls from N to 1"
- **Security rationale** — "Service role client used here because RLS would block cross-user access"
- **Surprising behavior** — "Returns empty array on parse failure instead of throwing — callers expect this"

### When NOT to Comment

- Restating what the code does: `// increment counter` above `counter++`
- Describing function parameters that have clear names
- Explaining standard library usage
- Marking sections with banner comments (`// ===== SECTION =====`)
- Referencing tickets, PRs, or authors — those belong in git history
- Explaining removed code — just delete it

### Comment Placement

**Above the line or block they explain, not inline at the end:**

```typescript
// Safari doesn't fire canplay reliably on mobile — use loadeddata instead
video.addEventListener('loadeddata', handleReady);
```

Not:
```typescript
video.addEventListener('loadeddata', handleReady); // Safari fix
```

### Function/Module-Level Comments

Add a one-line comment at the top of a file or function when:
- The name alone doesn't convey the full scope
- There's a non-obvious constraint on usage
- The module has a specific lifecycle or initialization requirement

```typescript
// Converts any supported document format to text or images for AI extraction.
// Text-heavy formats (docx, csv, txt) return text. PDFs and images return base64.
export async function convertDocument(buffer: Buffer, fileName: string, mimeType: string): Promise<ConvertedContent> {
```

Skip this for self-explanatory modules (`UserProfile.tsx`, `eventStore.ts`).

### Type/Interface Comments

Only comment fields whose purpose isn't clear from the name:

```typescript
interface CalendarEvent {
  id: string;
  title: string;
  // Computed on read — type_weight * (1 / days_remaining), boosted 2x within 48 hours
  urgencyScore?: number;
  // RRULE string or null. Presence indicates a recurring event series.
  recurrence: string | null;
}
```

Don't comment `title: string` — it's obvious.

---

## 3. Code Organization Signals

Good documentation starts with good structure. If these are true, you need fewer comments:

### Naming Conventions

- Files named after their primary export: `AuthProvider.tsx` exports `AuthProvider`
- Folders group by feature or domain, not by type (prefer `src/auth/` over `src/contexts/`)
- API routes mirror their URL path: `src/app/api/calendar/events/route.ts` → `GET /api/calendar/events`
- Test files sit next to what they test or mirror the source tree under `tests/`

### File Size

- Components over 300 lines probably do too much — consider splitting
- Utility files over 200 lines should be broken into focused modules
- If you need a table of contents comment at the top of a file, the file is too long

### Import Order

Consistent import ordering makes scanning files faster:
1. External packages (`react`, `next`, libraries)
2. Internal aliases (`@/lib/`, `@/components/`)
3. Relative imports (`./`, `../`)
4. Types (if separated)

---

## 4. Documentation Maintenance

### Drift Prevention

Documentation rots faster than code. Prevent it:

- [ ] README install steps actually work when followed literally
- [ ] Folder map matches the real directory structure
- [ ] Environment variable docs list every var the app actually reads
- [ ] Architecture diagrams reflect the current system, not the original design
- [ ] Local dev ports in docs match actual config

### Review Checklist

Before calling a repo well-documented:

- [ ] A new person can clone, install, and run in under 5 minutes following the README
- [ ] Every top-level folder's purpose is clear from the folder map
- [ ] Non-obvious code has intent-level comments (why, not what)
- [ ] No stale comments referencing removed features or old variable names
- [ ] Environment setup is fully documented with example values
- [ ] No generated files are described as source-of-truth

### When to Update Docs

- Adding a new top-level folder or service → update folder map
- Adding a new env var → update env docs
- Changing the deploy process → update deploy section
- Making a non-obvious architectural decision → add a comment at the decision point

Don't update docs for routine code changes (new components, bug fixes, refactors within existing patterns). The code IS the documentation for those.

---

## 5. Templates

### Minimal README Template

```markdown
# Project Name

One-sentence description.

## Quick Start

\`\`\`bash
git clone <repo>
cd <project>
cp .env.example .env.local  # fill in values
npm install
npm run dev
\`\`\`

## Structure

\`\`\`
src/
├── app/          # Routes and pages
├── components/   # UI components
├── lib/          # Utilities and shared logic
└── ...
\`\`\`

## Environment Variables

See `.env.example` for all required variables.

## Deploy

\`\`\`bash
npm run build
vercel --prod
\`\`\`
```

### .env.example Template

```bash
# Database
DATABASE_URL=              # Postgres connection string (Supabase, Neon, etc.)

# Auth
NEXT_PUBLIC_SUPABASE_URL=  # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anonymous key (safe for client)
SUPABASE_SERVICE_ROLE_KEY= # Server-only. Never expose to client.

# External APIs
OPENAI_API_KEY=            # OpenAI API key for AI features
GOOGLE_CLIENT_ID=          # Google OAuth client ID
GOOGLE_CLIENT_SECRET=      # Google OAuth client secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Base URL for OAuth redirects
```
