# Repo Organization Checklist

Use this checklist when updating docs, moving files, or reviewing whether the repo is still understandable for beginners and non-coders.

## Canonical Entry Points

- [ ] The repo root `README.md` is the main onboarding document.
- [ ] Subfolder READMEs only add local context and do not replace the root README.
- [ ] The active frontend is clearly labeled as `frontend/`.
- [ ] The legacy prototype is clearly labeled as `frontend-legacy/` reference-only work.

## Folder Clarity

- [ ] `frontend/` is the current frontend source of truth.
- [ ] `backend/` is the current local API and solver orchestration source of truth.
- [ ] `api/` is only the production/serverless adapter layer.
- [ ] `docs/` contains project-level explanation that should not be hidden inside app folders.
- [ ] Backup or archival material is labeled clearly so it is not mistaken for active runtime code.

## Beginner Readability

A new teammate should be able to answer these quickly:

- [ ] Where do I start reading?
- [ ] Which frontend folder is the real one?
- [ ] Where does cube state change?
- [ ] Where do simulator actions like scramble and solve live?
- [ ] Where do backend requests get handled?

## Documentation Drift

- [ ] Local dev ports in the docs match the actual config.
- [ ] The architecture doc reflects the current repo, not an old sprint snapshot.
- [ ] The README still matches the real scripts in `package.json`.
- [ ] Active and legacy folders are described consistently everywhere.

## Comments

Good comments in this repo should explain:

- why a face orientation needs to be flipped
- why drag direction maps to a specific move
- why a queue or fallback path exists
- why backend code imports shared frontend cube modules

Avoid comments that only restate obvious code.

Best places for comments:

- `frontend/src/pages/simulator/`
- `frontend/src/cube/`
- `backend/api/src/`
- `backend/src/cube/`

## Generated Files

- [ ] `node_modules/`, `dist/`, and build output stay out of the documented source-of-truth path.
- [ ] Docs point people to source files, not generated folders.

## Review Standard

Before calling the repo well-organized, make sure:

- [ ] a beginner can find the active app without guessing
- [ ] docs match the current runtime
- [ ] there is one clear onboarding path
- [ ] complex files have intent-level comments where needed
