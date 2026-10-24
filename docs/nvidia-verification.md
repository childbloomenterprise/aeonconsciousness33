# NVIDIA integration - 21 October 2026

NVIDIA is the primary provider for non-sensitive travel text when NVIDIA_API_KEY is configured. The selected model is nvidia/nemotron-3.5-super-vl-120b-a12b, with reasoning disabled, structured JSON output, temperature zero, a 900-token output cap and a 10-second request deadline. Failed, malformed or truncated responses fall back to the existing Gemini/OpenRouter path. The key is backend-only and excluded from source archives and browser assets.

## Scope

Groq continues to handle voice. Gemini continues to handle images and sensitive diary/health extraction. Existing authentication, AI consent, daily quotas, journey ownership and curated health responses remain in place. NVIDIA was also tested directly with synthetic meal and health questions to assess behavior; these tests do not enable those routes in production. A model supporting vision does not imply that this integration processes photos through it.

## Live questions

Ten distinct synthetic questions covered Dubai vegetarian breakfasts, Munnar itineraries, Alleppey rain, Mumbai snacks, a reported walk, a future plan, journey recall, prompt injection, meal extraction and a health boundary.

The initial Lightning model produced 9/10 HTTP 200 responses with valid application schemas; one health test timed out. It also recreated a historical event on a recall question and suggested unverified named attractions. Lightning was not selected for production.

Added a deterministic guard that removes newly proposed events on questions or planning requests, with a regression test based on the observed duplicate. Tightened grounding instructions and selected Nemotron Super after two focused checks passed. The full Super batch returned 9/10 HTTP 200 responses, all passing the actual application Zod schema; the recall request hit the 10-second timeout, though it had succeeded in the focused check. Timeout fallback is tested separately. Responses are suggestions, not verified live place information; use the Google Maps search for real venues.

Raw questions, responses, timings and errors are in nvidia-results.json. These are small-sample integration observations, not a reliability benchmark or proof of medical/factual accuracy. Full signed-in browser-to-database testing remains pending.

Local validation: the full suite passed 150 tests before the final timeout case was added. The final NVIDIA adapter test file passed 9 tests, including timeout fallback. The build, server ESM checks and browser secret scan passed. The selected model and final prompt were rechecked with TypeScript and the adapter tests.
