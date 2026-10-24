# Design QA

Reviewed October 11, 2026 against the supplied CYOX reference screenshot. LINC-33 is an original practical adaptation: midnight/slate surfaces, cyan/teal accents, mountain-led journey card, compact sidebar, mobile bottom navigation, assistant composer, activity cards, nearby panel, regional food photography and dedicated voice view. CYOX branding, copied UI imagery and unsupported widgets were not carried over.

## Screen matrix

| Experience | 390 px | 768 px | 1440 px | Result |
|---|---:|---:|---:|---|
| Home dashboard | `home-390.png` | `home-768.png` | `home-1440.png` | Pass |
| General voice | `voice-390.png` | `voice-768.png` | `voice-1440.png` | Pass |
| Cited health chat | `chat-390.png` | `chat-768.png` | `chat-1440.png` | Pass |
| Nearby | `nearby-390.png` | `nearby-768.png` | `nearby-1440.png` | Pass; unavailable state until key |
| Journey timeline | `journey-390.png` | `journey-768.png` | `journey-1440.png` | Pass |
| Health profile | `profile-390.png` | `profile-768.png` | `profile-1440.png` | Pass |
| Food diary voice | recording view inherited from voice | profile card verified | `food-voice-1440.png` | Pass |
| Emergency warning | `emergency-390.png` | shared responsive shell | shared responsive shell | Pass |

## Findings and corrections

- Exact-width measurements show no horizontal document overflow at 390, 768 or 1440 CSS pixels.
- Phone controls use reachable 44-pixel minimum targets for primary actions, bottom navigation, dialog close and event tools. Inputs stay at 16px to avoid mobile zoom.
- Inter Latin fonts are local; destination/food WebP assets are compressed and have descriptive alternatives.
- Side navigation links and brand link have accessible names. Radix dialogs provide focus trapping, titles and descriptions. Reduced-motion preference removes transitions/animations.
- Voice shows a timer, real input-level orbit, stop/cancel/processing/review states. Food mode uses meal-specific copy, accepts editable typed fallback and routes the reviewed report through the same chat/event pipeline.
- Summary cards reflect reported entries only. No automatic steps, weather or notification fiction appears.
- Nearby renders a manual-search empty state and a clear provider-unavailable error. No fake hospital or travel time appears.
- Food cards say typical dietary characteristics; actual ingredients/menu availability remain unverified.
- Reference density was reduced on mobile to preserve hierarchy. At desktop, the journey/conversation pair and three supporting cards recreate the reference composition without using it as a background.

Known visual limit: no live Google map/place cards can be inspected until restricted keys and billing are configured. Authentication/recovery email screens can be visually exercised locally, while provider-return/error variants await Supabase configuration.
