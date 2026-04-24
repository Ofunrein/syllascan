# Project Instructions (AGENTS.md)

## Tech Stack
- Next.js 15.2.0 (App Router), TypeScript, React 19.
- Tailwind CSS 4, Shadcn UI.
- OpenAI Vision (gpt-4o) for OCR.
- Firebase for backend services.

## Code Style
- Use PascalCase for React components in `src/components/`.
- Use camelCase for logic files in `src/lib/` and `src/utils/`.
- Prioritize functional components and hooks.

## Key Patterns
- **Extraction**: Event normalization logic belongs in `processEvent` within `src/app/api/extract-events/route.ts`.
- **Logic**: Keep API calls (OpenAI, Google) abstracted in `src/lib/`.
- **Validation**: Always validate dates and times before returning them to the client.

## Build & Run
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
