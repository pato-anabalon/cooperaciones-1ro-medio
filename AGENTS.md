<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

- Preserve the canonical 45-item inventory in `PROJECT_CONTEXT.md` and `src/lib/cooperations.ts`.
- Keep the event wording exactly: `Convivencia 1° Medio` and `Día del Profesor · lunes 19 de octubre`.
- Student names are intentionally public after confirmation; reservation tokens and admin secrets are always private.
- Never replace the SQL reservation functions with client-side availability checks. Database row locking is the concurrency guarantee.
- Keep direct anonymous writes disabled. Public mutations must use the narrowly scoped RPC functions.
- Maintain mobile usability, keyboard focus states, reduced-motion support, and `noindex` metadata.
- Update `README.md` and `PROJECT_CONTEXT.md` when behavior or setup changes.
