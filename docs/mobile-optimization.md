# Mobile optimization — 19 October 2026

The mobile flow is destination selection → journey feed → review and save an entry → companion, with Journeys, Nearby, Profile and SOS kept accessible.

## Changes

- One navigation breakpoint at 900px, with five equal-width bottom tabs and safe-area spacing. Desktop retains its side rail.
- Visible mobile brand and SOS controls; touch controls are at least 44px on the primary surfaces.
- Readable feed typography, responsive destination names and photos, stacked journey/profile/nearby layouts, wrapping controls and single-column forms.
- Text fields use 16px mobile text to avoid automatic iOS input zoom while preserving user pinch zoom.
- Chat uses a flexible message scroll region with its composer in normal layout, replacing conflicting fixed composer offsets. The visible viewport is tracked for keyboard changes, with navigation hidden when a keyboard is detected.
- Phone dialogs fit the visible area and scroll internally. Calendars expand within layout rather than extending beyond the phone. Existing motion preferences and palette are retained.

## Validation

- Production build and TypeScript passed after the changes.
- Existing regression suite: 120 tests across 13 files passed.
- Two additional viewport tests passed: keyboard/blur handling, pinch zoom preservation and listener cleanup.
- The React review confirmed an unconditional hook, one coalesced animation-frame update, listener cleanup, and no new dependency or network request.

## Production release and browser verification

Released after explicit deployment authorization on 19 October 2026:

- Final deployment: `dpl_7uJz21DpH4hSgP398pk5uPj4LVsx`, READY, assigned to https://linc-33.vercel.app.
- Unique release URL: https://linc-33-8f2lbl8tz-childbloomenterprises-projects.vercel.app.
- Original rollback release: `dpl_FRV1kZKotQfLSbHD8yeg6Ti1sFJN`.
- Browser chat checks at 320×568, 360×800, 390×844, 430×932, 768×1024, 900×700, 1280×800 and 844×390. The document width matched the viewport; the composer stayed inside the viewport and clear of mobile navigation. Desktop used the side rail.
- Feed, Journeys, Nearby and Profile rendered at 320px without document overflow. Destination selection, destination photo preview, calendar, sign-in dialog and SOS dialog rendered and opened correctly. The 390px destination dialog fit within the visible area and had no internal horizontal overflow.
- A guest message opened the sign-in dialog, as designed; no credentials were entered or account records changed.
- Browser testing found hidden SOS text and an unnamed mobile profile button. Fixed the text visibility and accessible names, rebuilt successfully, and verified the final production header at 320px.
- Browser error log returned no errors during the sampled public interactions. The initial mobile deployment's error/fatal runtime query returned no records during the short verification window.
- `/api/status` returned auth=true, ai=true, private_ai=true, nearby=false, nearby_demo=false and account_deletion=true. `/api/events` returned SIGN_IN_REQUIRED for the signed-out session.

## Limits

Authenticated journey saving and live AI replies were not exercised because the browser had no signed-in account. Nearby real-place search is not configured in the deployed environment. Physical iOS/Android keyboards, camera/microphone permissions and real-device performance remain unverified. The Windows terminal's HTTP smoke script could not resolve external DNS; browser checks above provide the live evidence instead. Do not describe these checks as full authenticated end-to-end or physical-device certification.
