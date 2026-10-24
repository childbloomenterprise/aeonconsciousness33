# Journey feed rework — 2026-10-16

The existing LINC-33 app now opens on a journey-scoped feed. The selected journey determines its diary, assistant context and conversation history. Navigation stays secondary on desktop and mobile.

## Supplied component integration

- Pasted text.txt: polaroid-line-carousel.tsx → journey chooser.
- Pasted text (2).txt: calendar.tsx → date picker and feed date filter.
- Pasted text (3).txt: activity-heatmap.tsx → My rhythm, using real entry counts.
- Pasted text (4).txt and Pasted text (5).txt: duplicate vertical-stepper package → the assistant's five visible response sections.
- Motion imports use the project's existing motion/react package; icons use Lucide. Added the heatmap's missing CSS and motion tokens. Components live in src/components/ui/.

## Behavior

The feed offers food, water, movement and symptom filters. Text opens an editable draft in the selected journey's chat. Voice retains transcript review. Photos are limited to JPEG/PNG/WebP under 3 MB, require explicit AI consent and configured sensitive processing, and return an editable description. A separate checkbox confirms whether the user actually ate the pictured meal. No photo is stored; only reviewed text can enter the normal consent-protected conversation flow.

Journey creation selects the new journey. Optional travel specifications are saved as a journey note only with private-storage consent; a failed note save is reported separately from successful journey creation.

A journey's latest conversation resumes on entry. Server-side validation rejects conversation/journey mismatches. Recent and historical health queries are scoped to the selected journey. Travel context contains its destination, dates, reported non-sensitive events, dietary preference and interests. Health profiles are not sent as travel context.

Responses use Reason; Cause / what we know; Personalised support; Nearby help; Immediate suggestion. Health causes remain unestablished unless independently confirmed; a diary does not prove causation. WHO food-safety and diarrhoeal-disease references were checked and linked. The product does not claim WHO endorsement or a personalised diagnosis.

## Verification and remaining limits

110 automated tests pass at this checkpoint. The production build, compiled API checks and browser secret-marker scan pass. Chrome checks confirmed feed filtering, the heatmap, journey carousel, structured response sections and WHO references. Mobile (390px) and desktop (1440px) were inspected; no horizontal overflow was found. Fixed a desktop sidebar conflict discovered during visual inspection.

Real Google Maps/Places keys remain absent. Existing sample Nearby results stay labelled and are not real provider acceptance. Live account email delivery, authenticated persistence and real photo/voice provider calls still require account-based acceptance. Configuration flags alone do not prove these services work.

No database schema migration was introduced by this rework.
