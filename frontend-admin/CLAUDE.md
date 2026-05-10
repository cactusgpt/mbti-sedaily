@AGENTS.md

# frontend-admin/

Admin console targeting `mbti-admin.sedaily.ai`. The Admin track (Backend Admin Lambda / Feature Flags / Thresholds / Prompts / Secrets / Admin Frontend Admin-4 / Admin-5 deployment) is documented in [`../docs/admin-stack.md`](../docs/admin-stack.md) — read that first for any cross-cutting changes.

## Stack

Next.js 16.2.4 + React 19.2.4 + Tailwind v4 + TS, separate `package.json` and lockfile from `frontend-next/`. Static export (`output: "export"` in `next.config.ts`).

Build outputs **8 routes** under `out/`: `/`, `/login`, `/cost`, `/drivers`, `/prompts`, `/prompts/edit`, `/settings`, `/_not-found`.

## Conventions

- **Tailwind v4 is config-less** — no `tailwind.config.{js,ts}`. Theme lives in `src/app/globals.css` via `@import "tailwindcss"` + `@theme inline { ... }`. PostCSS pipeline is one plugin (`@tailwindcss/postcss`); v4 bundles `autoprefixer` and `postcss-import` internally.
- **Auth = localStorage JWT, NOT Cognito** — `src/lib/auth.ts` saves/clears `admin_jwt` + `admin_jwt_expires` (8h TTL). `src/components/AuthGuard.tsx` is a client-side gate placed in `src/app/(authenticated)/layout.tsx`. 401 from any admin endpoint → `clearAuth()` + redirect to `/login`.
- **API client** — single fetch wrapper in `src/lib/adminClient.ts` (`adminApi.login` / `getDrivers` / `updatePrompt` / `getCost` / `getAudit` 등 9 endpoints). `AdminApiError` carries the HTTP status. Base URL from `NEXT_PUBLIC_ADMIN_API_BASE_URL` env var.
- **Routing — query params, not dynamic segments** — `/prompts/edit?id=<category>/<name>` instead of `/prompts/[category]/[name]`. Reason: `output: "export"` requires `generateStaticParams` for dynamic routes; query params keep the route count fixed at 8 and stay static-export friendly. Wrap any `useSearchParams` page in `<Suspense>` (see `prompts/edit/page.tsx`).
- **Zero-new-dependency policy** — only what `create-next-app --tailwind --typescript --eslint` brought in. Custom impl preferred over deps unless saved code > ~100 lines (e.g. `ToastProvider` is 30 lines, diff preview is line-by-line).
- **`set-state-in-effect` exemptions** — `AuthGuard.tsx` (mount-detection flag) + `drivers/page.tsx` (initial async fetch) only. Both annotated. Don't add new exemptions without justifying.

## Deploy

```bash
cd frontend-admin
./deploy-admin.sh   # npm build → S3 sync → CloudFront /* invalidation
```

Live infra (Admin-5 provisioning result):
- S3 `sedaily-mbti-admin-frontend-dev` (us-east-1, OAC-only) → CloudFront `E1MITYI58DB9UW` → `mbti-admin.sedaily.ai`.
- 403/404 → `/index.html` (200) for SPA fallback on hard reload.
