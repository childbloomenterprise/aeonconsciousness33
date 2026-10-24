# Verification record

Status: October 11, 2026 (Asia/Calcutta).

## Production

- URL: https://linc-33.vercel.app
- Vercel project: `linc-33` (`prj_5LyDjdnfWfcmckVZpC1YOSmT2sh5`)
- Verified deployment: `dpl_Dnxhu6fW7huNmSMo6wdCJFKeMA1S`, state `READY`, no alias error.
- Production shell, deep links, privacy/terms, PWA files, icons and generated photography return 200.
- All nine Node function entry points load. GET/POST probes return deliberate 401/405 JSON where authentication is required; `/api/status` returns 200. Every API probe uses `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- Result detail: `deployment-smoke.json` (20 production probes). Re-run with `node scripts/smoke-deployment.mjs https://linc-33.vercel.app`.

No Supabase, Gemini, Google Maps/Places, SMTP or administration credentials were added. `/api/status` truthfully reports those capabilities unavailable. This verifies deployment structure and safe failure behavior, not the credentialed acceptance scenario.

## Automated checks

| Check | Result |
|---|---|
| Vitest | 76 passed across 7 files |
| Embedded PostgreSQL | RLS, ownership, isolation, transaction rollback, idempotency, quota, consent and auth-cascade cases passed |
| TypeScript | Client/shared/server compile passed |
| Compiled server runtime | All 9 Node ESM entry points imported and returned expected uncached responses |
| Production build | Passed; lazy route chunks, optimized images and build-bound service-worker cache |
| Browser-secret scan | No private provider configuration, server AI SDK or preview fixture records in browser bundle |
| Dependency audit | 0 vulnerabilities at `high` threshold; npm reported 0 total |
| Production smoke | 20/20 passed |

Machine-readable test results: `test-results.json`. The CI workflow repeats install, tests, build, compiled-server check, bundle scan and audit after a repository remote is connected.

## Browser checks

Manually exercised using the running UI, with screenshots in `docs/screenshots/`:

- Home, voice, cited source-first chat, nearby, journey and health profile at 390, 768 and 1440 CSS-pixel widths.
- Dedicated food-diary voice entry from Home and Profile, including meal prompts and editable text fallback.
- Mobile bottom navigation, tablet/desktop sidebar, modal focus, keyboard labels and exact-width overflow checks.
- Manual meal save/edit/delete controls and uncertain-time display in the development preview.
- Places missing-key state: no sample hospital appears; retry and manual destination remain available.
- Emergency text with a typographic apostrophe raised immediate warning before provider/storage work. SOS displayed jurisdiction selection and 112/108 actions; no emergency call was placed.
- First chat message remained visible under React Strict Mode after identity-state correction.
- Browser console reviewed during the final local flow; no remaining application errors recorded.

The explicitly labeled `?preview=1` mode uses tab-memory synthetic records only in development. It is stripped from production JavaScript and does not simulate AI, places or saved cloud data.

## Unverified until credentials arrive

1. Invite delivery, email verification/recovery and session expiry through configured Supabase + custom SMTP.
2. Apply both migrations to the target Supabase project, then repeat two-real-user isolation and deletion.
3. Confirm the selected Gemini model is enabled for the billed project; run typed travel extraction and real 30-second microphone transcription.
4. Review provider privacy terms, then explicitly set `GEMINI_SENSITIVE_PROCESSING_ENABLED=true` if approved.
5. Configure restricted Maps browser/server keys; test real Places attribution, phone/hours unknown handling and Google directions.
6. Configure the server-only Supabase administration key and test account deletion on disposable accounts.
7. Set production `APP_BASE_URL`, enable closed invitations, verify no open signup, and perform the README acceptance scenario.

These items remain **blocked**, not passed. Public launch also requires operator identity/contact copy, clinical-content review, privacy/legal review, abuse testing and operational monitoring.
