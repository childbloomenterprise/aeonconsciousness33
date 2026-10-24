# LINC-33

Responsive travel-health companion for an adult pilot in India. Built from the approved midnight/slate/cyan reference with original generated destination and food imagery. English voice input, text output, a dedicated food-diary voice mode, journeys, reported events, source-first health information and real nearby-service adapters.

Live pilot shell: https://linc-33.vercel.app

**Current boundary:** production reports account and AI configuration present; this does not prove working credentials. Local credentials are separate. Google Maps/Places keys are absent, and the existing deployment labels sample Nearby results explicitly. SMTP, authenticated persistence, provider calls and live isolation still require acceptance testing. The deployment record is in [verification](docs/verification.md).

## Run locally

Node.js 24 recommended; Node 22 also supported by the current dependencies.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:5173`. This starts Vite and a local adapter for the same Vercel API functions. Use `http://127.0.0.1:5173/?preview=1` for explicitly labeled synthetic visual fixtures. Preview records remain in tab memory and reset on refresh; no real AI or Places results are simulated. Production excludes the fixture module.

```powershell
npm test
npm run build
npm run check:server
npm run check:secrets
npm audit --audit-level=high
```

## Configuration checklist

Configure secrets in `.env.local` and Vercel Project Settings → Environment Variables; never send private keys in chat or commit them. Redeploy after changes to `VITE_` variables, because Vite embeds public configuration at build time.

| Variable / service | Purpose |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser account configuration |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server equivalents; server can fall back to the public values |
| `SUPABASE_SECRET_KEY` | Server-only own-account deletion; optional until that capability is activated |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Server-only Gemini configuration; defaults to `gemini-2.5-flash` |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Optional server-only fallback for non-sensitive text; defaults to `google/gemini-2.5-flash`. Private text extraction and audio retain Gemini privacy gates |
| `GEMINI_SENSITIVE_PROCESSING_ENABLED` | Defaults `false`. Enable only after billed-project/provider privacy setup and pilot review; required for audio and private event extraction |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Public, HTTP-referrer-restricted key; Maps JavaScript API |
| `GOOGLE_MAPS_SERVER_KEY` | Private key restricted to Places API (New); configure Google billing separately |
| `APP_BASE_URL` | Exact app origin for write-request origin checks; local example `http://127.0.0.1:5173` |
| `APP_ENV` | Deployment context label |
| `AI_DAILY_LIMIT`, `AUDIO_DAILY_LIMIT`, `PLACES_DAILY_LIMIT` | Lower pilot quotas; defaults 30, 10, 20 per user/day; database hard ceilings match these defaults |
| Supabase custom SMTP | Host, port, username/password, verified sender; configure in Supabase, not browser environment |
| Vercel / GitHub | Vercel project access is connected; GitHub repository/remote connection not yet supplied |

Provider setup references: [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key), [Gemini terms](https://ai.google.dev/gemini-api/terms), [Supabase API keys](https://supabase.com/docs/guides/api/api-keys), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Google Maps API security](https://developers.google.com/maps/api-security-best-practices).

## Supabase setup

Apply these migrations in order to a fresh dedicated Supabase project, through migration access or the SQL editor:

1. `supabase/migrations/202610100001_foundation.sql`
2. `supabase/migrations/202610110002_knowledge.sql`

The first migration creates all nine brief tables plus request-id and usage-counter storage. RLS and composite ownership foreign keys protect user records. Transactional RPCs perform consent, journey activation, turn saving, manual saving, profile saving and deletion. The second seeds additional verified source summaries. Cloud migration state must be checked against the target project; local tests apply both migrations to embedded PostgreSQL.

In Supabase Auth:

- Enable **Allow new users to sign up** for the current self-service pilot. The UI supports password signup and magic-link account creation. For invitation-only access, change both the UI and the Supabase setting together.
- Set Site URL to your production origin. Add exact local and production `/auth` redirect URLs.
- Configure custom SMTP and invitation/recovery templates before inviting external pilot users. Default Supabase mail cannot serve arbitrary external addresses.
- Limit enrollment to the intended adult pilot testers. The UI asks for an adult declaration; onboarding validates date of birth in the API and database.
- Apply secure password/session policies suitable for your pilot. Invitation and recovery links open the password-setting screen; choose a password with at least 12 characters.
- Use two separate test accounts to run live isolation checks after migration.

Do not configure real participant data until operator/privacy review and provider configuration are complete. Public `/privacy` and `/terms` pages document the current pilot behavior and Google service links; replace provisional operator/contact language before real enrollment.

## Architecture and behavior

- React 19, TypeScript, Vite, Tailwind, accessible Radix dialog primitives/shadcn-style local controls, Lucide, React Router, TanStack Query and Zod.
- Vercel Node functions; official Google Gen AI SDK; Supabase Auth/PostgreSQL.
- Ordinary travel/logging: one bounded structured call, validated facts, stable request ID, atomic persistence, then a saved acknowledgement.
- Health: shared curated reply logic. Optional configured AI call extracts **facts only**, with no model-authored health response. Urgent turns skip model extraction. Health profiles never enter model context.
- Recent reported history: occurrence-based 72 hours, fallback to recorded time only where occurrence is unknown. A request mentioning earlier episodes retrieves up to ten earlier user-owned symptom records; no causal inference or semantic similarity claim.
- Unknown clock times remain original `time_text`, not invented timestamps. Explicit durations can resolve in code. Unknown occurrence is grouped separately in the timeline.
- Voice: negotiated MediaRecorder format, live input-level display, timer, 30-second stop, 3 MB limit, editable transcript, consent/provider checks before microphone access. No speech output or retained audio files.
- Nearby: fresh Places requests, explicit field mask, no persistent place cache, official attribution and provider links, Google map on demand, directions and phone only when returned.
- PWA: static app shell and non-sensitive emergency UI only. Private responses and records are never cached. Lazy pages not previously loaded may need a connection; emergency access remains in the shell. No background upload queue.

API routes: `/api/chat`, `/api/transcribe`, `/api/journeys`, `/api/events`, `/api/health-context`, `/api/nearby`, `/api/conversations`, `/api/privacy`, `/api/status`. Protected routes validate bearer sessions and ownership. Shared schemas validate requests, model data and successful browser responses. Operational logs omit message contents and provider secrets.

## Acceptance scenario after configuration

1. Open an adult pilot invitation, set a password, sign in; optional profile can be skipped.
2. Enable private storage and external AI processing separately. Start a Munnar journey.
3. Speak breakfast and lunch reports; review each transcript and send. Confirm database-saved timeline entries.
4. Report stomach discomfort. Check recent reported meals and linked general information; no diagnosis or meal attribution should appear.
5. Search a real nearby hospital, open returned directions and inspect attribution.
6. Refresh/reopen the journey and conversation. Verify records remain.
7. With synthetic text, verify an urgent warning still appears during AI/Places/storage failure. Inspect dialer links without placing test emergency calls.
8. Run consent revocation, two-user isolation and deletion on disposable test accounts.

See [requirement tracker](docs/requirements.md), [source and licensing register](docs/sources-and-assets.md), [architecture](docs/architecture.md), [verification](docs/verification.md) and [visual QA](docs/design-qa.md).

## Known reductions and follow-up

Bounded recent-message context replaces generated conversation summaries; history lookup uses date/type bounds. Onboarding is compact rather than a wizard. Journey start defaults to today and is editable; end date is optional. Regional food catalog contains three Kerala dishes. Local controls follow shadcn/Radix conventions rather than importing a broad component library.

Deferred: live weather, device steps, notifications, Hindi/Malayalam, international emergency rules, speech output, live voice, native apps, broad cuisine/search, personalized health AI, advanced offline support and public-launch clinical/legal/abuse/operational review. No payments or infrastructure purchases were added.

## Login and verification repair — 2026-10-16

`/login` and `/login-review` now use real authentication followed by database-backed onboarding. The longer optional-question design exploration remains a component prototype. Guest chats stay in memory; older device history remains removable and is never uploaded automatically. Consent defaults are off. Journey timestamps are compared chronologically across offsets. Missing APP_BASE_URL falls back to same-host origin checks. Test workers use threads to avoid sandbox child-process temp-file failures.
