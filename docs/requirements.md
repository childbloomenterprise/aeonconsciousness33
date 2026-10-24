# Requirement tracker

Status date: October 11, 2026. **Implemented** means code and applicable local checks exist; it does not imply a credentialed cloud integration passed. **Blocked** names external setup; **Simplified** describes an explicit reduction; **Deferred** belongs to the agreed follow-up scope. The user's approved LINC-33 plan supersedes conflicting CYOX brief instructions.

## Approved MVP coverage

| Requirement | Status | Evidence / remaining dependency |
|---|---|---|
| LINC-33 identity, premium reference adaptation | Implemented | Responsive shell, generated photography, six experiences |
| Separate app; synced sources unchanged | Implemented | All app work in `linc-33/` |
| React/TS/Vite/Tailwind/Router/Query/Zod/Lucide | Implemented | Locked packages, production build |
| shadcn + Motion presentation | Simplified | Local Radix/shadcn-style controls; CSS transitions/reduced motion; no unnecessary animation runtime |
| Auth login, invitations, recovery, session handling | Implemented + Blocked | Auth UI/client; Supabase and SMTP configuration required |
| Closed signup; adult-only, up to25 invitations | Blocked | Admin must disable signup, configure email and invite adults; UI declaration implemented |
| Optional profile and emergency contact | Implemented + Blocked | Forms, transactional save/delete, RLS; cloud migration required |
| Separate private-storage/external-AI consent | Implemented | RPC/UI; denial and revocation tests |
| One active journey; previous journeys | Implemented | SQL uniqueness/activation tests; previous-journey selector |
| Optional journey dates | Simplified | Start defaults to today and remains editable; optional end |
| All six event categories, edit/delete/undo | Implemented | Shared contract, API, timeline, edit forms, chat undo |
| Nine core database tables + operational tables | Implemented + Blocked | Two SQL migrations; embedded PostgreSQL pass; cloud unapplied |
| RLS, composite ownership and two-user isolation | Implemented | Actual embedded PostgreSQL denial tests; live two-account check pending |
| Gemini travel/logging adapter, selected model | Implemented + Blocked | Official SDK, structured output; key/project model access needed |
| Source-first health; no model medical reply | Implemented | Shared curated module; optional factual-only extraction; urgent model bypass |
| Private AI billed-project gate | Implemented + Blocked | Off by default; operator must complete provider privacy setup |
| Automatic confirmed facts; ambiguous confirmation | Implemented + Blocked | Confidence/pending flow and atomic RPC; live model extraction unverified |
| Truthful save acknowledgements; stable retry IDs | Implemented | Transaction/failed-save/duplicate tests |
| Time expressions, occurrence, creation, timezone | Implemented | Duration resolver, uncertainty-preserving timeline; ambiguous-time tests |
| Previous-day / 72-hour health memory | Implemented | Occurrence-based query with undated fallback; query and SQL tests |
| Older episode lookup | Simplified | Up to10 earlier user-owned symptoms on explicit history request; no semantic matching |
| Conversation saving/resume/delete | Implemented + Blocked | API/UI/atomic RPC; cloud persistence check pending |
| Bounded summaries | Simplified | Last8 non-sensitive messages for travel context; original records authoritative; generated summaries deferred |
| Voice recorder, levels, timer, cancel/stop | Implemented | MediaRecorder/Web Audio; idle UI and denial/unsupported checks |
| 30 sec / 3 MB / MIME negotiation | Implemented | Client stop, server byte/MIME checks, tests; hardware/browser recording pending |
| Transcription → editable text → common chat | Implemented + Blocked | SDK adapter/unit tests; real audio provider requires credentials |
| Food diary voice mode on Profile and Home | Implemented + Blocked | Meal-specific recording prompts, editable foods transcript, text fallback and common saving pipeline; live speech awaits credentials |
| Curated initial health topics | Implemented | Seven source entries; hydration, foodborne symptoms, diarrhea, allergy, food safety and seeking help |
| WHO sources not silently accepted | Blocked | Fetch verification pending; excluded from app retrieval |
| Source dates/licensing/review register | Implemented | Migration fields + register; clinical/legal review deferred |
| Independent warning rules and immediate access | Implemented | Negation/history/typographic apostrophe tests; browser emergency check |
| India112 / Kerala108 only after jurisdiction choice | Implemented | Government links and dialer URLs; no dispatch or test calls |
| On-demand GPS, accuracy/time, denial fallback | Implemented | Nearby UI; synthetic permission-denial test |
| Real Places categories and field masks | Implemented + Blocked | All five categories; provider key/billing required |
| Attribution, no persistent place caching | Implemented | Official logo, provider links, uncached requests; live visual attribution pending |
| Lazy Google map, selected card, list fallback | Implemented + Blocked | Maps key needed; no synthetic map results |
| Real directions / available phone only | Implemented | Constructed Google links; no invented times or contact details |
| Regional food catalog + dietary filters | Simplified | Three initial Kerala dishes; typical ingredients, unverified recipes; separate restaurant search |
| Delete event/conversation/journey/profile/account | Implemented + Blocked | API/UI + cascades; account admin key required |
| No sensitive logs / provider profile exclusion | Implemented | Sanitized-log tests and bounded AI payload |
| PWA shell, offline banner, no upload queue | Implemented | Static-only worker; authenticated/API/third-party cache exclusion test |
| Shared quotas, bounds, timeouts, explicit retry | Implemented | SQL counters, configured lower caps, provider/client timeout code |
| Shared Zod requests/responses | Implemented | Contracts, model/schema/URL rejection tests |
| Loading/empty/error/success states | Implemented | All primary screens; actual provider failure paths pending live check |
| Desktop/tablet/mobile visual acceptance | In progress | Saved screenshots; see visual QA record |
| Build, automated critical tests, secret scan | Implemented | See verification record |
| Vercel deployment and deployed smoke checks | In progress | Connected team; deployment record updated after actual result |
| Full credentialed acceptance scenario | Blocked | Supabase, SMTP, Gemini, Maps/Places credentials needed |
| Public launch review and hardening | Deferred | Clinical, legal, abuse, accessibility audit and operations |

## Original brief, sections 01–70

| Brief section | Classification / coverage |
|---|---|
| 01 complete engineering delivery | Implemented independently; live integrations blocked |
| 02 travel-health companion | Implemented product scope; no booking/finance features |
| 03 functional visual philosophy | Implemented real controls; unavailable services explicit |
| 04 setup checklist | Implemented; keys deferred by user; README configuration |
| 05 twenty deliverables | Tracked individually above; live verification blocked |
| 06 stack | Implemented; component/motion breadth simplified |
| 07 architecture | Implemented modular services and shared contracts |
| 08 maintainable structure | Implemented separate app and formatted modules |
| 09 environment contract | Implemented placeholders/ignore rules/server boundary |
| 10 real deployment conditions | Implemented functions, routing, headers; deployment smoke check pending |
| 11 approved visual direction | Implemented LINC-33 adaptation |
| 12 consumer interaction principles | Implemented forms, direct navigation and explicit results |
| 13 tokens | Implemented palette, Inter, rounded cards, focus states |
| 14 fluid behavior | Simplified restrained CSS motion; reduced motion supported |
| 15 responsive interface | Implemented; three-width QA record |
| 16 minimal navigation | Implemented four destinations |
| 17 onboarding | Simplified invitation flow and optional profile |
| 18 health information | Implemented optional fields, no health predictions |
| 19 authentication | Implemented adapter/UI; configuration blocked |
| 20 journey creation | Implemented manual destination/title/dates |
| 21 home | Implemented actual logged summaries; weather/steps/notifications deferred per plan |
| 22 core voice | Implemented recorder; real provider validation blocked |
| 23 voice states | Implemented idle/recording/processing/review/error |
| 24 audio pipeline | Implemented bounded upload, transcript and common send flow |
| 25 voice in/text out | Implemented; speech output deferred |
| 26 companion personality | Implemented calm travel prompt and curated health wording |
| 27 orchestration | Implemented source-first override of brief's broader medical AI |
| 28 structured extraction | Implemented SDK schema + validation; real model results blocked |
| 29 time references | Implemented supported durations; ambiguous expressions preserved |
| 30 conversational saving | Implemented atomic auto-save/confirmation/undo |
| 31 longitudinal memory | Simplified bounded recent/older records |
| 32 conversation persistence | Implemented; summaries simplified; cloud acceptance blocked |
| 33 authorized tools | Simplified fixed UI actions and direct owned service endpoints; arbitrary model tools excluded |
| 34 authoritative research | Implemented CDC/NHS; WHO pending excluded |
| 35 knowledge base | Implemented seven sources and review metadata |
| 36 medical reasoning policy | Source-first plan override: no diagnosis/personalized treatment |
| 37 independent screening | Implemented informational rules and failure path tests |
| 38 grounded guidance | Implemented original linked general summaries |
| 39 food safety | Implemented no safety guarantees/causal claims |
| 40 location handling | Implemented request-on-use, accuracy/time, manual fallback |
| 41 Places | Implemented adapter/field masks/attribution; real API blocked |
| 42 nearby interface | Implemented five filters, list/map and failure states |
| 43 directions | Implemented provider-identity links |
| 44 regional food | Simplified three Kerala dishes; broader regions deferred |
| 45 timeline | Implemented six categories, history/edit/delete/undo; filters deferred |
| 46 complete data model | Implemented all nine tables, columns, FKs, indexes |
| 47 protection | Implemented RLS, scope, server keys, no sensitive logs |
| 48 privacy | Implemented consent/deletion/notices; legal review deferred |
| 49 APIs | Implemented nine function routes |
| 50 response structure | Implemented shared typed/Zod contracts |
| 51 errors | Implemented sanitized errors and explicit retry/unavailable states |
| 52 SOS | Implemented independent shell and jurisdictional dialer actions |
| 53 limited offline | Implemented shell only; private offline storage deferred |
| 54 complete states | Implemented primary states; live failure checks pending |
| 55 accessibility | Implemented focus/labels/dialogs/text alternatives/reduced motion; full audit deferred |
| 56 performance | Implemented compressed assets, font subset, page/map lazy loading |
| 57 costs | Implemented shared ceilings, fields, bounds and timeouts; billing activation blocked |
| 58 critical tests | Implemented deterministic and embedded PostgreSQL tests |
| 59 complete live journey | Blocked by credentials; instructions prepared |
| 60 separate emergency test | Implemented synthetic automated and browser test |
| 61 twelve-hour sequence | Used as engineering target; waiting excluded |
| 62 reductions | Explicitly recorded above, preserving core invariants |
| 63 polish | Implemented; QA corrections recorded |
| 64 deployment | Implemented; production https://linc-33.vercel.app verified |
| 65 production validation | Routing/assets/unauthenticated API smoke passed; credentialed scenarios blocked |
| 66 handoff | README, tracker, registers, checks and screenshots |
| 67 prohibited failures | No production fixtures or fabricated provider results; limits stated |
| 68 quality standard | Independent functionality checked; operational integrations unverified |
| 69 autonomous execution | Implemented independent work despite credential deferral |
| 70 integrated vision | Architecture implemented; live connected demonstration blocked |

## Explicit follow-up backlog

Weather; device steps; notifications; broad cuisine; rich search/filters; Hindi/Malayalam; international emergency coverage; speech output; live voice; native apps; advanced offline; personalized health AI under separate review; public-launch clinical/legal/privacy/abuse/operational hardening.
