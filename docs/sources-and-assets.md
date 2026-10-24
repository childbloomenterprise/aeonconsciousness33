# Sources and asset register

Verification: October 10–11, 2026. Content consists of original, short paraphrases of the linked guidance. Source verification does not constitute clinical review, legal clearance or validation of the app's screening rules. No health-provider branding, article images, complete articles or treatment regimens are reproduced.

## Health information

| App topic                            | Source                                                                                                           | Verification / review                                   | Reuse assessment                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Foodborne symptoms and warning signs | [CDC](https://www.cdc.gov/food-safety/signs-symptoms/index.html)                                                 | Page fetched; original summary; not clinically reviewed | Paraphrased US federal guidance with attribution; no third-party media copied |
| Hydration during travel              | [CDC Yellow Book](https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/travelers-diarrhea.html) | Page fetched; limited to general fluids/context         | Original summary; antibiotic/treatment recommendations excluded               |
| Travelers' diarrhea                  | [CDC Yellow Book](https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/travelers-diarrhea.html) | Page fetched; same source, separate topic               | Original summary, linked attribution                                          |
| Dehydration                          | [NHS](https://www.nhs.uk/conditions/dehydration/)                                                                | Page fetched; page review date May 1, 2026              | Original paraphrase; linked source; no NHS endorsement claimed                |
| Food allergy                         | [NHS](https://www.nhs.uk/conditions/food-allergy/)                                                               | Page fetched; page review date August 20, 2026          | Original paraphrase; ingredients require local confirmation                   |
| Anaphylaxis / urgent help            | [NHS](https://www.nhs.uk/conditions/anaphylaxis/)                                                                | Page fetched; not clinically reviewed                   | Short original warning-sign summary; no personalized treatment                |
| Food safety                          | [CDC](https://www.cdc.gov/food-safety/foods/safer-food-choices.html)                                             | Page fetched; source date January 31, 2025              | Original summary; no assurance that a dish/vendor is safe                     |

These seven entries live in `shared/knowledge.ts` and the SQL migrations, with verified/source dates, warning signs, original summaries, licensing notes and review status. Runtime responses cite only registered source IDs. A date is left unknown where the source does not supply a reliable one.

WHO food-handling guidance could not be fetched reliably during setup: **pending**, excluded from retrieval. Headache-specific, heat-illness and broader travel-preparation sources require review before expansion. Before a public health launch, review accuracy, currentness, Indian applicability and permitted reuse, including [NHS terms](https://www.nhs.uk/our-policies/terms-and-conditions/).

## Emergency and cuisine references

- India 112: [Ministry of Home Affairs ERSS](https://www.mha.gov.in/en/commoncontent/emergency-response-support-system-erss). Dialer opens only after explicit jurisdiction choice. No dispatch claim or test call.
- Kerala 108: [Kerala Medical Services Corporation ambulance service](https://kmscl.kerala.gov.in/KMSCL/index.php/ckmscl/menucontentview/50). Offered only when Kerala confirmed.
- Regional cuisine: [Kerala Tourism ethnic cuisine](https://www.keralatourism.org/responsible-tourism/ethnic-cuisine/dishes) and [Incredible India Kerala cuisine](https://www.incredibleindia.gov.in/en/kerala/thiruvananthapuram/what-to-eat-and-where-to-eat-in-thiruvananthapuram). Catalog describes typical appam/stew, fish curry and puttu/kadala ingredients, not verified menus or allergy guarantees.

## Original imagery

Five images generated October 10–11, 2026 using the built-in Image Gen tool, without reference-image inputs. Raw outputs preserved in `design/raw/`; optimized display files in `public/images/`. The user's reference screenshot remains outside the app and is used for layout comparison only.

| Display file             | Generation brief                                                                                                                                                                     | Processing               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| `munnar.webp`            | Editorial Munnar tea plantations; layered Western Ghats; mist; peach dawn; realistic foliage; wide panorama; darker lower-left for interface text; no people/buildings/text/logos/UI | 1600px, WebP quality82   |
| `appam.webp`             | Kerala lacy white appam with coconut vegetable stew, carrots/beans; matte ceramic plate, wood table, banana-leaf accent; angled overhead natural morning light; no text/people/UI    | 640px, WebP              |
| `fish-curry.webp`        | Chunky fish in red-orange curry, curry leaves, earthenware bowl, wood/banana-leaf styling; close-up natural light; no text/people/UI                                                 | 640px, WebP              |
| `puttu.webp`             | Two white rice/coconut cylinders, black-chickpea kadala curry, banana leaf, rustic bowl; natural editorial close-up; no text/people/UI                                               | 640px, WebP              |
| `kerala-backwaters.webp` | Bright Kerala lagoon with coconut palms and one traditional houseboat; spacious left side for readable mobile welcome copy; natural editorial light; no text/people/UI               | 1200×800, WebP quality82 |

Images are illustrative generated assets, not verified photographs of a particular vendor, meal or present-day location. No third-party stock license required for these generated outputs; operator should review applicable image-generation service terms and publication suitability. Rebuild optimized assets with `npm run assets`. Original generated-output paths are recorded in `design/generation.json`.

Icons: Lucide, ISC license, including the mountain-based LINC-33 mark and generated PWA icons. Inter: bundled Fontsource Inter, SIL Open Font License. UI primitives: Radix, MIT license. Full dependency licenses remain in installed packages/lockfile; this register does not replace dependency-license review.

## Maps attribution and provider terms

`google-maps-attribution.svg` is the unmodified official white Google Maps attribution logo obtained from [Google's attribution assets](https://developers.google.com/static/maps/documentation/images/Google_Maps_Attribution_Assets.zip). Used only with Places content, at prescribed size/clearance. Third-party attribution links from Places are retained. Provider responses are not persistently cached. [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) require public terms/privacy and correct attribution; `/terms` and `/privacy` supply provisional pilot disclosures pending operator review.

Provider configuration references: [Gemini terms](https://ai.google.dev/gemini-api/terms), [audio input](https://ai.google.dev/gemini-api/docs/audio), [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Gemini processes travel conversation, transcription and optional factual event extraction only. Saved health profile never enters Gemini context. Sensitive AI gate defaults off until billed-project/privacy configuration reviewed.
