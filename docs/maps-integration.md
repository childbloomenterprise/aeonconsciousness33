# Google Maps integration - 19 October 2026

The supplied key is configured locally for Google Places server requests and Maps JavaScript rendering. Real credentials are excluded from the source archive.

Nearby categories: hospitals, clinics, pharmacies, restaurants, hotels, petrol, sports, attractions, parks, supermarkets. Coordinate searches use Google's DISTANCE ranking within 10 km; destination searches use Text Search. Directions retain the Google place ID. Rapid category changes cannot overwrite newer results with an older request. The map waits for Google's async initialization callback and times out visibly after 15 seconds.

Verification:
- Google Places Text Search returned HTTP 200 and two Kochi hotels.
- All ten category types returned HTTP 200 and two real listings each, using the application field mask and coordinate search shape.
- Maps JavaScript returned HTTP 200 with map code. Browser rendering, referrer enforcement and an authenticated end-to-end nearby search are not yet verified.
- 128 regression tests across 14 files passed; production build, server ESM runtime checks and browser bundle checks passed.
- Current production /api/status reports nearby=false; other service configuration flags are true. Flags alone do not verify those services.

Release is blocked: automatic approval review rejected uploading the key to the linc-33 Vercel project across production, preview and development because that exact destination and environment scope were not explicitly authorized. No hosted key change or deployment occurred. Request approval for production-only configuration and release. Browser Maps configuration is public by design; use a separately referrer-restricted browser key for production if available.
