# In-chat care update — 20 October 2026

Deployed after explicit user approval to linc-33 Vercel production. Deployment dpl_Hq75N3bCUjdoFsC2yJD4k9Lvtx2s is READY and assigned to https://linc-33.vercel.app. Deployment URL: https://linc-33-8fswmzo8b-childbloomenterprises-projects.vercel.app. Prior production rollback target: dpl_CFQu1aQzJVDWzK2PjLVapZenJWPf.

## User flow

A health concern or explicit hospital/pharmacy request opens one care panel within the current chat. Emergency text immediately reveals emergency access even if a previous request is still in progress. The user chooses current location or confirms a town. Signed-in searches call the existing authenticated, quota-controlled Nearby endpoint twice, once for hospitals and once for pharmacies. No symptoms, conversation, profile, or journey history is sent to Google Places.

The panel shows up to three results per category: name, address, reported opening status, optional straight-line distance, phone call, Google Maps directions with place ID, and an expandable map inside the chat. Location is kept only in component memory and cleared on new conversation, account change, or journey change. The trip destination only pre-fills a field; it is never assumed to be the user's current position. Location is never requested in the background.

Emergency calling options do not require sign-in. Signed-out users receive local health information and Google Maps search links; embedded provider listings require sign-in. No authentication or provider quotas were removed. A hospital listing does not verify emergency department availability. A pharmacy listing does not verify medicine stock or recommend treatment.

## Failure handling

- Hospital and pharmacy requests settle independently, retaining useful results when the other request fails.
- Older search and location callbacks cannot overwrite a newer chosen area.
- Permission denial leaves manual search and Google Maps alternatives available.
- Demonstration places are rejected outside the explicit development preview.
- Shared map loader supports async initialization, visible loading failure and authentication error fallbacks. Address, call and directions controls remain available without the embedded map.
- Plain pharmacy and hospital requests can use the local care reply without external AI processing.

## Verification

- 138 tests across 15 files passed, including ten new care tests covering inline results, directions/calling, map disclosure, independent provider failure, stale results, permission denial, request data minimization, signed-out access, demo rejection, plain pharmacy intent and emergency access while a reply is pending.
- Production TypeScript/Vite build passed.
- Compiled Node ESM API route checks passed.
- Browser bundle check passed: no server provider configuration or development fixtures.
- Local browser preview could not connect. Live production browser verification succeeded after deployment: a guest pharmacy request revealed the inline care panel with manual/current-location controls and Google Maps fallbacks; a synthetic breathing emergency immediately revealed the warning banner and hospital-priority panel; the in-chat emergency button opened the jurisdiction-aware emergency calling dialog. No actual phone call or location permission was triggered.
- Live status returned HTTP 200 with auth=true, ai=true, private_ai=true, nearby=true and nearby_demo=false. The deployment-specific error/fatal log check returned no records during the short post-release window.
- The live browser session was signed out. Real signed-in search, provider listings, map tiles, device dialing and geolocation remain unverified for this new panel.
- No clinical triage validation or claim of complete emergency recognition is made by these software checks.

## Changed application files

src/components/CareFinder.tsx, src/components/care-finder.css, src/components/PlaceMap.tsx, src/components/AssistantReply.tsx, src/pages/Chat.tsx, src/pages/Nearby.tsx, shared/safety.ts, shared/health.ts and server/chat.ts. Tests are in tests/care.test.tsx.

## Release

The allowlisted source was uploaded and deployed using the existing production environment. No new credentials, database migration, or third-party account was required. The live guest emergency/pharmacy flow is verified. A signed-in session is still required to verify real hospital/pharmacy results, permissions, map pins, directions and calling.
