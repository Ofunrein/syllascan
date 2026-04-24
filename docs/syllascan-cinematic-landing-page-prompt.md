# SyllaScan Cinematic Landing Page Builder Prompt

## Source Of Truth

Use `/Users/martinofunrein/Downloads/1. claude-md/GEMINI_CINEMATIC_LANDING_PAGE_BUILDER.md` as the primary source of truth for structure, interaction quality, animation discipline, and implementation expectations.

Use `/Users/martinofunrein/Downloads/1. claude-md/LANDING_PAGE_PROMPT.md` only as a reference for fidelity, polish, section depth, functional artifact quality, and cinematic pacing. Do not copy the Rubik's Cube brand, military theme, 3D cube requirements, team roster, palette, or content.

You are adapting the Gemini cinematic landing page builder to the existing SyllaScan Next.js application.

## Role

Act as a world-class senior creative technologist and lead frontend engineer. Build a high-fidelity landing page and product interface that feels intentional, precise, and useful. The UI should feel like a working academic command surface, not a generic SaaS template. You build high-fidelity, cinematic "1:1 Pixel Perfect" landing pages. Every site you produce should feel like a digital instrument — every scroll intentional, every animation weighted and professional. Eradicate all generic AI patterns.

Do not scaffold a new project. Do not create a Vite app. Work inside the existing Next.js app.

## Product Context

- **Brand name:** SyllaScan
- **One-line purpose:** AI syllabus and academic document scanning that turns dates, assignments, exams, meetings, and deadlines into editable Google Calendar events.
- **Primary CTA:** Upload a syllabus
- **Audience:** Students, educators, academic advisors, and anyone converting dense class documents into usable calendar plans.
- **Core workflow:** Upload document -> preview file -> extract events with AI -> review/edit events -> add selected events to Google Calendar.

## Core Value Propositions

1. **Document Upload And Preview** — Upload syllabi, schedules, assignment sheets, PDFs, and images with clear file previews before processing.
2. **AI Event Extraction** — Detect assignments, exams, deadlines, class meetings, holidays, and other academic dates from messy documents.
3. **Editable Calendar Sync** — Review, edit, select, and add extracted events to Google Calendar without losing control.

## Hard Visual Rule: No Gradients

Remove all gradient colors and gradient effects from the UI.

Do not use:

- `linear-gradient`
- `radial-gradient`
- `conic-gradient`
- `bg-gradient-*`
- gradient text
- glow blobs
- decorative gradient overlays

Use these instead:

- Solid surfaces
- Borders
- Subtle shadows
- Noise texture
- Real product UI states
- Thin dividers
- Monochrome image overlays
- Clear contrast between sections

## Aesthetic Direction

Adapt the Gemini prompt's premium cinematic structure into an academic-tech product interface.

The feel: a study operations console meets a precise calendar planning tool. Calm, focused, credible, and high signal. It should feel useful on first load, not like a detached marketing page.

Suggested palette:

- Ink: `#111827`
- Graphite: `#1F2937`
- Paper: `#F8FAFC`
- Card: `#FFFFFF`
- Line: `#D1D5DB`
- Calendar Blue: `#2563EB`
- Signal Green: `#16A34A`
- Deadline Red: `#DC2626`
- Muted Text: `#6B7280`

Use solid colors only.

Suggested typography:

- Headings: `Space Grotesk` or current app heading font if already loaded
- Body: `Inter`
- Data labels: `IBM Plex Mono` or another monospace font

## Existing App Requirements

Preserve all current SyllaScan functionality.

Do not remove or break:

- `src/app/page.tsx` home workflow state
- `Header`
- `FileUploader`
- `EventList`
- `LiveCalendarView`
- `EmbeddedCalendarView`
- `GoogleAuthWrapper`
- `CalendarAuthBanner`
- Google sign-in and sign-out
- Dashboard link
- Settings link
- Privacy Policy link
- Terms of Service link
- Upload tab
- Events tab
- Live Calendar tab
- Embedded Calendar tab
- URL hash tab behavior
- Extract Events API call
- Event editing, selecting, clearing, and adding to calendar
- PDF/image preview behavior

The first screen may be cinematic, but it must still expose the actual product workflow quickly. Do not hide the upload flow behind a purely decorative landing page.

## Required Next.js Approach

Use the existing project structure:

- `src/app/page.tsx` for the main landing/product workflow
- `src/app/layout.tsx` for metadata/font-level adjustments if needed
- `src/app/globals.css` for global tokens, noise texture, base layout, and reusable utilities
- `src/components/Header.tsx` for navigation
- Existing workflow components for upload, events, calendar views, auth, and dashboard behavior

Do not move the app to Vite. Do not replace the app with a single `App.jsx`. Do not remove the existing App Router setup.

## Component Architecture

### A. Navbar: Floating Study Console

Create a fixed or sticky navigation surface inspired by the Gemini "Floating Island" pattern.

Requirements:

- Solid or translucent solid background, no gradients
- Border and subtle shadow
- SyllaScan wordmark
- Links to Home, Dashboard, Settings when available
- Auth controls preserved
- Mobile menu preserved
- CTA points to the upload workflow
- Hover states use translate/lift and solid color changes

### B. Hero: The Working First Screen

Build a first viewport that combines premium landing-page composition with immediate product utility.

Content:

- Eyebrow: `// ACADEMIC CALENDAR INTELLIGENCE`
- Headline: `Turn syllabi into calendar plans.`
- Supporting copy: `Upload a syllabus, let AI extract the deadlines, then review and send clean events to Google Calendar.`
- Primary CTA: `Upload a syllabus`
- Secondary CTA: `View dashboard` or `See calendar`

Functional requirement:

- The upload workflow must be visible in or immediately below the hero.
- The user should understand and start the core workflow without scrolling through marketing-only content.

Visual requirements:

- Solid background sections
- Noise overlay at low opacity
- Product UI preview or actual upload panel
- No decorative gradient background

### C. Features: Functional Artifacts

Adapt the Gemini "Interactive Functional Artifacts" section to SyllaScan.

Card 1: Document Intake

- Show a mini upload queue or document preview artifact.
- Communicate supported PDFs/images and batch upload.
- Use solid cards, border states, and file-status indicators.

Card 2: Extraction Feed

- Use a monospace typewriter/log feed showing detected academic events.
- Example feed:

```text
> detected: Midterm Exam / Oct 14 / 9:30 AM
> detected: Project Proposal Due / Nov 02
> detected: Final Review Session / Dec 04 / Room 210
```

Card 3: Calendar Commit

- Show a weekly grid or event checklist artifact.
- Animate selecting events and committing them to Google Calendar.
- Keep the animation lightweight and accessible.

### D. Philosophy: Academic Clarity Manifesto

Use the Gemini manifesto section structure, adapted to SyllaScan.

Suggested copy:

- `Most academic tools leave dates buried in documents.`
- `SyllaScan turns them into plans you can act on.`

Support message:

`Less manual copying. Fewer missed deadlines. More control before anything reaches your calendar.`

Use strong typographic contrast and solid color sectioning. Do not use the Rubik's Cube manifesto language.

### E. Protocol: Workflow Archive

Adapt Gemini's sticky/process section to SyllaScan's actual workflow.

Three steps:

1. **Upload** — Add a syllabus, schedule, PDF, or image and preview the file before processing.
2. **Extract** — AI identifies deadlines, exams, meetings, assignments, and class events.
3. **Review And Sync** — Edit event details, select what matters, and add everything to Google Calendar.

If using GSAP ScrollTrigger, follow Gemini's animation lifecycle:

- Use `gsap.context()` inside `useEffect`
- Return `ctx.revert()` in cleanup
- Use `power3.out` for entrances
- Use `power2.inOut` for transitions
- Respect reduced motion preferences

### F. CTA And Footer

Create a final solid section with:

- CTA: `Upload a syllabus`
- Short promise: `From document chaos to a calendar you trust.`
- Links to Privacy Policy and Terms of Service
- Status indicator: `Calendar sync ready`

Keep footer content product-focused and public-safe.

## Micro-Interactions

Follow Gemini's interaction quality, adapted to this app:

- Buttons scale to `1.03` on hover with a smooth cubic-bezier transition.
- Links lift by `translateY(-1px)` on hover.
- Focus states are visible and accessible.
- Tabs, upload zones, file thumbnails, event cards, and calendar actions must feel responsive.
- Avoid decorative interactions that interfere with upload, editing, auth, or calendar behavior.

## Animation Rules

Animations are allowed only if they improve clarity and polish.

Use:

- Staggered reveal for hero text and cards
- Lightweight log/typewriter effect for feature artifacts
- Subtle section reveal on scroll
- Solid scanline or cursor motion only if it does not distract from the real workflow

Do not use:

- Heavy 3D requirements from the Rubik's Cube prompt
- Decorative floating cubes
- Military HUD motifs
- Red scanlines
- Binary rain
- Gradient glows

## Implementation Guardrails

- Preserve user data flow and backend API calls.
- Keep existing auth providers and context providers.
- Do not delete working components just to simplify the landing page.
- Do not introduce package dependencies unless they are required for a specific implemented animation.
- Prefer existing libraries already installed, especially `lucide-react` for new icons.
- Keep responsive behavior first-class.
- Make text fit on mobile and desktop.
- Avoid nested cards and overdecorated SaaS layouts.
- Avoid generic AI copy.

## Verification Checklist

After implementation, verify:

- Home page loads.
- Upload tab works.
- PDF/image preview still works.
- Extract Events still calls the existing extraction endpoint.
- Events tab appears after extraction.
- Event editing still works.
- Calendar auth wrapper still works.
- Live Calendar and Embedded Calendar tabs still work.
- Dashboard, Settings, Privacy Policy, and Terms links still work.
- Mobile navigation works.
- No visual gradients remain in source:

```bash
rg "linear-gradient|radial-gradient|conic-gradient|bg-gradient|from-|via-|to-" src
```

Any remaining match must be a non-visual false positive or removed.

## Execution Directive

Do not build a generic landing page. Build a polished SyllaScan product surface that follows the Gemini cinematic landing page builder as the source of truth, uses the Rubik's Cube prompt only as quality reference, keeps the existing Next.js app intact, removes all gradient styling, and preserves every core workflow.
