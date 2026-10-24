# LINC-33 journey experience rework

Implemented 18 October 2026. This report distinguishes source checks, browser checks with development fixtures, and live account/provider checks. A passing fixture is not evidence of a successful live account operation.

## Product flow

Choose a destination → optional dates → sign in to save → optional preferences → journey feed → type, photo or voice → review and correct → explicitly save → receive relevant companion guidance.

Feed, Companion, Journeys, Nearby and Profile now have permanent navigation locations. Creating a journey opens the feed. Legacy login URLs return to the same destination-first entry point.

## What changed

- The feed composer opens a real entry review form instead of redirecting every report to chat. Saving a typed entry does not require an AI provider.
- Food, water, activity and feelings have direct capture controls. Entries can be corrected from the feed.
- Entry writes target the selected journey, including a completed trip while another trip is active.
- Voice and photo descriptions pass into editable review. Voice conversation transcripts become drafts rather than being sent automatically. Text fallback is available immediately when recording is unavailable.
- Dish suggestions populate the form for review instead of saving immediately.
- Chat extractions remain pending until the user reviews and explicitly confirms them. Confirmation request IDs are stable across conversation remounts to prevent duplicate saves on retry.
- Failed entry saves retain corrections and reuse the same request ID. With private-storage consent, unfinished review drafts stay in session storage, scoped to the account and journey. Explicit sign-out clears these drafts. Without consent, drafts remain in memory only.
- Destination, title and dates survive refresh and the authentication transition. A pending trip resumes after sign-in and optional preferences.
- Preferences can be skipped. Private storage can be explicitly enabled while saving the first entry; external AI consent stays separate.
- The returning feed replaces the large welcome hero with destination, date, composer and recent moments. Statistics and food inspiration stay secondary.
- Companion answers lead with the useful answer. Supporting context is expandable. Nearby care links appear for health concerns rather than on every travel response.
- Health history queries require a journey ID so general chat cannot pool events from unrelated trips.
- Nearby asks for location only when the user presses its location control. Production results reject demonstration places when Google Places is unconfigured.
- Shared contrast, focus, disabled states, touch targets, reduced motion, mobile navigation and safe-area rules were improved. Added a skip-to-content link.

## Route and integration inventory

| Route / integration | Status | Evidence / limit |
| --- | --- | --- |
| `/` first use | Working in browser | Destination selection and refresh restoration verified |
| `/` journey feed | Working in fixture browser | Capture, save confirmation, correction and trip switching verified |
| `/journey` | Working in fixture browser | Created Dubai; Munnar records remained separate; selected Munnar with Dubai active |
| `/chat` | UI and server contracts checked | Dubai destination heading verified; real AI response not exercised in this run |
| `/nearby` | Partially available | Manual search and denial handling covered by tests; live Places provider is unconfigured |
| `/profile` | Source and tests inspected | Consent controls and deletion API exist; live account updates/deletion not exercised |
| `/login`, `/login-review` | Unified entry route | Redirect to destination-first home |
| `/auth` | Implemented, live flow untested | Existing Supabase callback retained; destination pending state resumes after sign-in |
| `/privacy`, `/terms` | Existing routes retained | No policy text was rewritten |
| Authentication/recovery | Configured, live flow untested | Production `/api/status` reports auth available; this does not prove email delivery |
| Journey/event database | Regression coverage + fixture browser | Ownership, persistence and isolation tests pass; no real customer records were modified |
| Photo analysis | Implemented, live input untested | Editable description and provider-error fallback retained; images are processed, not stored |
| Voice transcription | Implemented, live microphone untested | Consent, unavailable browser and editable fallback tests pass |
| AI context | Server regression coverage | Journey ID, destination, dated recent entries and preferences remain scoped |
| Nearby services | Unavailable live | Production status reports `nearby: false`; no provider key was created or changed |
| Account deletion | Configured, not exercised | Production status reports capability; no account was deleted |
| Usage limits / secret isolation | Checked | Existing server quota handling retained; browser-bundle secret check passes |

## Verification

- 116 automated tests across 12 files passed, including six new capture/onboarding regression tests.
- TypeScript and production build passed.
- Compiled Node ESM API routes load and return uncached access/setup responses.
- Browser bundle check found no private provider configuration, server AI SDK or development fixture records.
- Browser review used a development fixture account only. No live user record was changed.
- Responsive checks used requested 390 × 844 and 1440 × 960 viewports. No horizontal overflow was observed on the phone layout.

### Browser task results

1. **Choose Dubai before sign-in — passed.** Reopening the form after refresh retained Dubai.
2. **Review and save lunch — passed with fixture.** The entry appeared in Munnar with a saved confirmation.
3. **Create Dubai — passed with fixture.** Dubai started with an empty timeline.
4. **Open Companion — passed for context heading.** The heading and suggested destination changed to Dubai. Live generation remains untested.
5. **Select the earlier Munnar trip — passed with fixture.** Munnar entries remained available separately from Dubai.
6. **Add water while another trip is active — passed with fixture.** The new entry stayed with selected Munnar.
7. **Correct a saved entry — passed with fixture.** The corrected text appeared in the feed.

Screenshots are local QA evidence in `docs/screenshots/rework-*.png`. They are excluded from the downloadable source archive.

## Plan completion and remaining gates

| Plan stage | Result |
| --- | --- |
| 1. Starting point | Routes/APIs inventoried; recoverable source snapshot and prior deployment recorded |
| 2. Product hierarchy | Five permanent destinations; feed capture is primary |
| 3. First use | Destination-first setup, authentication continuation and skip implemented; live sign-in needs verification |
| 4. Visual system | Shared interaction and palette rules improved; legacy CSS outside migrated surfaces still needs consolidation |
| 5. Feed | Compact returning view, composer, recent entries and correction implemented |
| 6. Capture | Unified reviewed text flow; real photo/microphone checks remain |
| 7. Personalisation | Journey isolation fixed and regression checked; live account return/provider output remains to verify |
| 8. Answers | Direct answer, optional supporting detail and context-specific care links implemented |
| 9. Navigation | Stable Companion tab and five consistent names implemented |
| 10. Failure states | Existing API failures retained; retry/draft and honest nearby failures improved; real offline/device checks remain |
| 11. Accessibility/devices | Focus, labels, motion and phone/desktop layout checked; physical keyboard/reader/device matrix remains |
| 12. Operations | Build, route loading, bundle isolation and regression checks pass; live provider/account checks remain |
| 13. People | Testing protocol prepared below; no participants or results are fabricated |
| 14. Release | Staging verified; production release recorded below; remaining live account/provider/user checks are explicit |

## First-time user test protocol

Recruit five people who have not seen the application. Give no navigation coaching. Use a test account and fictional health details.

Ask each participant to create a trip, record lunch, correct its description, request a suitable food suggestion, switch to another trip, find a pharmacy and return after closing the app.

Record task completion without help, time to first saved entry, failed-save count, wrong turns, lost input and the participant's description of what happens next. Capture provider configuration separately so a missing Google Places key is not misclassified as a usability failure.

| Participant | Tasks completed / 7 | First saved entry time | Save failures | Lost input | Observed hesitation |
| --- | --- | --- | --- | --- | --- |
| 1 | Not run | — | — | — | — |
| 2 | Not run | — | — | — | — |
| 3 | Not run | — | — | — | — |
| 4 | Not run | — | — | — | — |
| 5 | Not run | — | — | — | — |

Set numerical improvement targets after collecting this baseline. Before calling the entire plan complete, verify real sign-in/recovery, account isolation with two accounts, photo/voice processing, session expiry, Google Places configuration, physical mobile keyboard behaviour and first-time participant completion.

## Recovery and release

- Pre-change source archive: `../LINC33_before_rework_20261018.zip`.
- Prior production deployment: `dpl_71hUjXi7Gc6iDrFWEsXRsfoid5tm`.
- Prior production URL: `https://linc-33-qs2jimmta-childbloomenterprises-projects.vercel.app`.
- Initial staging deployment: `dpl_8nUKAAg5XeqTYHQAKS2nPgGa4dXc`.
- No database migration or credential changes are required by this rework.
- Release smoke checks should cover public routes, `/api/status`, protected API access rejection, cache headers and the rendered destination-first entry screen.
- Monitor failed saves and provider failures after release. Existing provider quotas remain in place; no external monitoring subscription was added.

## Release record

- Production deployment: `dpl_4Va9rHdYBht1PSsRhLzKW7eT5GSZ`.
- Release URL: `https://linc-33-2syfeddj0-childbloomenterprises-projects.vercel.app`.
- Canonical URL: `https://linc-33.vercel.app`.
- Staging route smoke: Feed, login, Journeys, Companion, Nearby and Profile returned HTTP 200. Status returned HTTP 200 with no-store. Protected events returned HTTP 401 with no-store.
- The final production version additionally returns users to Feed after journey creation and reports demonstration nearby data as disabled.

### Final production checks

Production deployment is READY and assigned to linc-33.vercel.app. Public Feed, login, Journeys, Companion, Nearby, Profile, Privacy and Terms routes returned HTTP 200. Status returned 200/no-store with authentication, AI, private AI and account deletion configured; nearby and nearby_demo were both false. Signed-out events, journeys and conversations returned 401/no-store.

The deployment-scoped error/fatal runtime-log query returned no records during this short verification window. This is not evidence of a complete authenticated workload or ongoing monitoring.

Final regression run: 116 tests across 12 files passed. See rework-production-smoke.json for machine-readable route results.
## Vibrant travel palette — 18 October 2026

The theme uses 60/30/10 as a visual hierarchy, rather than a literal pixel count:

| Share | Role | Colour |
| --- | --- | --- |
| 60% | Warm sand foundations and quiet surfaces | #FFF5E6 |
| 30% | Ocean teal navigation, capture panels and supporting structure | #006E73 |
| 10% | Sunset coral primary actions and selected navigation | #CF452D, brighter #FF7957 for dark text |

Seafoam (#D8F2EC) is a light ocean tint for supporting panels. Deep ocean text (#173D43) keeps the warm surfaces readable. Photography is destination content, separate from the interface colour proportions.

The shared travel-theme.css layer covers the shell, landing page, feed, chat, buttons, fields, modals, navigation and selected states. A bundled backwaters photograph replaces the empty signed-out hero. Browser/PWA theme colours now match ocean teal and sand.

Contrast checks: white on coral 4.62:1, white on ocean 6.04:1, body text on sand 10.90:1, dark text on bright sunset 4.57:1. These checks cover key colour pairs and do not constitute a complete accessibility certification.

Production build passed. Landing and sample feed visually inspected. This is a styling update; no authentication or data-saving behaviour changed.

Theme release: dpl_9nbhaDGkVCrucG2dbKJDTFHNc3nz. Prior production rollback: dpl_4Va9rHdYBht1PSsRhLzKW7eT5GSZ.

## Marigold refinement

At the user's request, the 10% coral accent is replaced by marigold yellow (#F2C84B), with sunlight yellow (#F8D66D) for selected navigation and photo edging. Primary action text uses deep teal (#173D43) for contrast. The 60% warm sand and 30% ocean teal foundations are retained. Hover uses richer golden yellow (#E5B62C).
## Motion and interaction polish — 18 October 2026

A shared motion system now coordinates all routes and the existing sand/ocean/marigold palette.

| Surface | Feedback |
| --- | --- |
| Route / selected journey changes | Short page entrance and fresh header settle |
| Landing page | Staggered copy, postcard-like photo arrival and action settle |
| Buttons and navigation | Press compression, contained pointer ripple, icon response and active-state settle |
| Keyboard and forms | Visible focus, composer focus halo, field and label transitions |
| Destination picker | Hover lift, image zoom, selected confirmation and preview entrance |
| Feed | Scroll-visible entry arrivals, entry-symbol response, correction hover and new-entry arrival |
| Companion | Message arrival, prompt feedback, composer focus and supporting-answer disclosure |
| Modal dialogs | Backdrop fade, spring-like opening, short closing and close-icon response |
| Profile and Nearby | Shared card/reveal, selection, switch and result feedback |
| Capture and media | Photo preview, editable section entrance, recording-control response and loading state |
| Saving and errors | Save toast arrival and icon settle; short error-state entrance |
| Calendar / progress / history | Selected-state response, progress transitions, panel entrance and history-row feedback |

Timing: 120ms press response, 220ms state transitions, approximately 380ms route entrances, up to 650ms for the initial destination photograph. No input or network request waits for an animation. Hover effects only apply to fine-pointer devices. Reveals never gate visibility or depend on an observer to make content accessible.

Reduced motion: CSS disables decorative animations and transitions, the delegated ripple/reveal layer is removed, and progressive text display resolves immediately. Existing scenery pause remains available. No new animation dependency, sound or device vibration was introduced.

Implementation: one passive delegated pointer listener, one batched mutation observer and an intersection observer. Observers and transient ripple elements are cleaned up on unmount and motion-preference changes. Form submissions and focus handling are not intercepted.

Validation: production build and TypeScript pass; 119 tests across 13 files pass, including new tests for preserving clicks, reduced-motion feedback and observer/listener cleanup. Browser inspection confirmed scene-enter and dialog-in animation names, a real press-feedback surface, destination selection, modal closing, navigation into Companion, and a sample water-entry save plus confirmation. Browser error log inspection returned no errors during these sample interactions. Live media/provider checks remain outside this styling task.

Motion release rollback target: dpl_WDmaWjH9gFKbLTKopDi7AnRsALSm.
Final motion pass: dialog labels/descriptions now use readable theme text colours. Dialogs explicitly restore focus to their opening control on close. Added a focus-restoration regression test; all 10 focused motion/capture/focus tests pass after the earlier 119-test full regression pass. The final production build also passes.
