# AI connection

For local text chat, set `OPENROUTER_API_KEY` in ignored `.env.local`, run `npm run dev`, and visit `/chat?preview=1`. The local API binds to loopback and accepts preview requests only from the 127.0.0.1 browser origin. Use `LOCAL_API_PORT` if another project occupies port 3001; Vite reads the same setting.

Preview conversations are tab-local and model responses do not save journey events. Health responses remain curated; sensitive input is not routed to OpenRouter. Voice uses server-side Groq Whisper when GROQ_API_KEY is configured. Otherwise Gemini voice requires configured privacy processing. Photos and private event extraction retain the Gemini privacy setting. Production retains session authentication, consent and quota checks; the development preview endpoint is not deployed.

Set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` in the hosting environment to enable production text fallback. Never prefix a private key with `VITE_`, commit it, or include it in the browser bundle.

Adapter follows [OpenRouter's API reference](https://openrouter.ai/docs/api_reference/overview), uses structured JSON output, requires provider parameter support and denies provider data collection. All model output remains validated against the application's schema.


## Provider update — 21 October 2026

Production uses server-only GROQ_API_KEY for Whisper Large V3 transcription and GEMINI_API_KEY with GEMINI_MODEL=gemini-3.1-flash-lite for structured text/photo processing. Secrets are kept outside source archives and browser bundles. Supabase remains the existing authentication and storage backend.

Groq returns the original transcript and detected language. Non-English recordings receive an additional English translation call. The UI reviews the result before submission. Authentication, external AI consent, daily quotas, file validation and journey-scoped saving still apply. Groq failures do not forward recordings to another provider. Status exposes voice_ai separately from Gemini private_ai.

The supplied Gemini key accepted model-listing requests, but gemini-2.5-flash generation returned HTTP 404 (unavailable to new users). Both gemini-3.1-flash-lite and gemini-3.8-flash generation succeeded; the lighter model is configured for this app.

Verification: 142 tests passed, production build, server ESM checks and browser secret scan passed. A synthetic English recording was correctly transcribed by the real Groq API. Signed-in browser capture and saving with an actual user remain pending. No API key values are included in this report.

Production release: dpl_B3utZz4ayJKm5XFcCebHNqf8yihj reached READY at https://linc-33.vercel.app. Live status returned auth=true, ai=true, voice_ai=true, private_ai=true. Unauthenticated voice/photo routes returned SIGN_IN_REQUIRED as expected. Gemini photo testing initially encountered HTTP 503 high demand; retry with the application's prompt and constrained response schema returned HTTP 200 and valid text/uncertainty fields for the sample food photo.

An optional upload of compiled runtime fixtures to a temporary Vercel test sandbox was rejected by automatic approval review as an opaque source/data export. It was not retried or bypassed. Local compilation/tests and direct provider checks completed; full signed-in browser capture and saving are still unverified.
