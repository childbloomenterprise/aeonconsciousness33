# Local home-screen app — automatic storage

Implemented and verified on 24 October 2026. This replaces the manual per-journey preparation flow.

## User experience

Add LINC-33 to the phone's home screen. Sign in while connected and enable private storage once in Profile. App files save automatically, and signed-in account data downloads automatically while the app is open. There is no separate download or prepare-this-journey button.

Navigation opens the locally stored application shell, including while online. Profile, journeys, entries and available conversation history read from the local database first. Automatic background updates run after sign-in, reconnection, return to the app, and periodically while open. Journeys never opened on this phone are included. Paginated API reads include records beyond the original first-page limits.

Text logs save to IndexedDB first, then the existing idempotent queue syncs them when online with a valid account session. Pending entries survive reloads and background account updates. Conflicting corrections retain the existing explicit resolution choices.

## Connectivity boundaries

Initial sign-in and download need internet. AI responses, voice transcription, photo analysis, live maps, nearby search, new journey creation, and account changes still use online services. This is a home-screen website with a local runtime and automatic account copies, not a native APK or an on-device AI model.

Private storage remains an explicit one-time consent choice. Sign-out or consent revocation removes local private copies and unsynced entries. Browser/device storage can be cleared or evicted. The app requests persistent storage where supported. General app files contain no private API responses or authentication secrets.

## Verification

- 199 automated tests passed across 24 files.
- Production build, server runtime checks and browser bundle secret scan passed.
- Isolated Chromium mobile browser with fictional API data: two journeys automatically stored, including a trip never opened in the UI; 205 entries downloaded across API pages; conversation history available offline; a text log saved through the real UI survived reload.
- 12 page/viewport combinations checked at 390x844, 844x390 and 320x568. No horizontal overflow or chat composer overlap with mobile navigation.
- Offline reopening confirms the saved app is ready without making another download request. A late-finishing first download updates its status automatically when the service worker activates.
- Account-switch cancellation, consent revocation, interrupted updates, pending text preservation and deleted-conversation cleanup covered by tests.

Real-account reconnect/sync and physical iOS home-screen installation were not exercised in this session.

## Release status

Deployed to the existing linc-33 production project after explicit user approval. Vercel reports READY, with linc-33.vercel.app assigned to deployment dpl_DcYTVQiaWi5xAJeNBYz32V8Yn1ZL. The live installation panel shows automatic local setup and no per-journey preparation controls.

Live installation-panel verification: app files saved on this device automatically; no per-journey preparation button.
