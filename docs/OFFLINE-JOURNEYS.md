# Prepare for this journey

Open a journey in Feed or Journeys while connected and signed in, then choose **Prepare for this journey**. Private-storage consent must already be enabled in Profile. Wait for **Your journey, ready offline** before leaving the connection.

The bundle includes journey details, the latest 200 text entries returned by the existing events API, and the application files required to open its pages. Multiple journeys can be prepared. Copies are stored in IndexedDB under the account ID on the current browser/device; the shared service-worker cache contains only public application assets, never authenticated API responses.

While offline, read prepared journeys and save reviewed text entries. New entries and corrections display **Saved on device / Waiting to sync**. The outbox survives reloads. It retries when the signed-in app is open and the connection returns, with a manual **Sync now** option. It checks server consent and account identity before replay. A stable request ID uses the existing database create_manual_event idempotency mechanism for new-entry retries.

Corrections carry the original updated_at timestamp. The API conditionally updates the matching version and returns 409 on a conflict. Conflicting text stays on the device. The traveller can explicitly use the account version or preserve the device text as a separate entry. Pending entries cannot be edited or deleted again until reconciled. Prepared bundles cannot be removed while unsynced entries remain.

Signing out removes prepared copies and unsynced entries from this device. The preparation panel tells the traveller this before enabling offline storage. Turning off private-storage consent clears local bundles when the server change or next consent check is observed. Browser storage can be cleared by the browser or device; persistent storage is requested when available but cannot be guaranteed.

AI replies, nearby search, live maps, new journeys, uploads, photo analysis and voice transcription require connectivity. This application does not currently have a general document/attachment store, so documents, photographs and original audio are not included in this bundle. Photos/voice already reviewed into text can be saved as text entries.

## Implementation

- Native IndexedDB transactions, account-specific bundle and outbox records.
- React Query networkMode=always on offline-capable reads, so its connectivity manager cannot pause local reads during an offline reload.
- Build-generated precache list covering public JS/CSS/font assets, local destination images and lazy page chunks.
- Download readiness acknowledgement from the service worker; failed/incomplete downloads do not report success.
- No new dependency, database migration, or third-party repository code copied.

## Verification

The automated suites cover persisted-queue reconstruction, account isolation, cold account restoration, stale account markers on signout, consent, duplicate request IDs, interrupted-response retry, expired-auth/server errors, conflicts, signout during an in-flight sync, storage failure, preparation UI, offline provider reads, API version filtering and service-worker navigation/download failures. Queue tests use an in-memory persistence adapter; provider/UI tests use jsdom and simulated connectivity. Existing database tests exercise the actual foundation migration and idempotency RPC in embedded PostgreSQL.

Production build and Node ESM route compilation/runtime checks pass. The server compilation check used the existing parent dependency directory for Node type definitions in this workspace.

A real browser check using native IndexedDB and a stopped local server was attempted, but browser automation failed with a browser-session error before reaching the test page. Real device airplane-mode reload, native IndexedDB durability, multi-tab behavior and signed-in production reconnect remain unverified. A fictional-data browser harness is provided at tests/browser/offline-check.html for local Vite use; it is not part of the production build.
