import { z } from "zod";
import type { Place } from "../shared/contracts.js";
import { demoDistance, demoPlacesFor } from "../shared/demoPlaces.js";
import { ApiError } from "./http.js";

export const nearbyInput = z
  .object({
    category: z.enum([
      "hospitals",
      "clinics",
      "pharmacies",
      "restaurants",
      "hotels",
      "petrol",
      "sports",
      "attractions",
      "parks",
      "supermarkets",
    ]),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    location: z.string().trim().min(2).max(160).optional(),
  })
  .refine(
    (x) => (x.lat !== undefined && x.lng !== undefined) || !!x.location,
    "Choose your location or enter a destination.",
  );
const types = {
  hospitals: "hospital",
  clinics: "doctor",
  pharmacies: "pharmacy",
  restaurants: "restaurant",
  hotels: "lodging",
  petrol: "gas_station",
  sports: "sports_complex",
  attractions: "tourist_attraction",
  parks: "park",
  supermarkets: "supermarket",
};
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad;
  const value =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
export function navigationURL(id: string, lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}&destination_place_id=${encodeURIComponent(id)}`;
}
/**
 * Labelled Munnar sample points, used only while no Places key is configured
 * and the operator explicitly enabled the demonstration map. Each result is
 * marked `demo`, so the interface can label it and no caller can mistake it for
 * a real provider result.
 */
export function demoSearch(input: z.infer<typeof nearbyInput>): Place[] {
  const origin =
    input.lat !== undefined && input.lng !== undefined
      ? { lat: input.lat, lng: input.lng }
      : null;
  return demoPlacesFor(input.category)
    .map((place) => ({
      ...place,
      distance_km: demoDistance(origin, place),
    }))
    .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
}
export async function searchPlaces(
  input: z.infer<typeof nearbyInput>,
): Promise<Place[]> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    if (process.env.PLACES_DEMO_ENABLED === "true") return demoSearch(input);
    throw new ApiError(
      503,
      "PLACES_UNAVAILABLE",
      "Nearby search is not connected yet. Emergency calling is still available.",
    );
  }
  const nearby = input.lat !== undefined && input.lng !== undefined;
  const response = await fetch(
    `https://places.googleapis.com/v1/places:${nearby ? "searchNearby" : "searchText"}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.currentOpeningHours.openNow,places.attributions",
      },
      body: JSON.stringify(
        nearby
          ? {
              includedTypes: [types[input.category]],
              maxResultCount: 12,
              rankPreference: "DISTANCE",
              locationRestriction: {
                circle: {
                  center: { latitude: input.lat, longitude: input.lng },
                  radius: 10000,
                },
              },
            }
          : {
              textQuery: `${input.category === "sports" ? "sports facilities" : types[input.category].replaceAll("_", " ")} near ${input.location}`,
              pageSize: 12,
            },
      ),
    },
  );
  if (!response.ok)
    throw new ApiError(
      response.status === 429 ? 429 : 502,
      "PLACES_FAILED",
      "Nearby search is unavailable right now. Please retry or use emergency calling.",
    );
  const raw = (await response.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      nationalPhoneNumber?: string;
      currentOpeningHours?: { openNow?: boolean };
      attributions?: Array<{ provider: string; providerUri: string }>;
    }>;
  };
  return (raw.places || [])
    .filter((p) => p.id && p.location && p.displayName?.text)
    .map((p) => ({
      id: p.id,
      name: p.displayName!.text,
      address: p.formattedAddress || "Address unavailable",
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      phone: p.nationalPhoneNumber,
      open_now: p.currentOpeningHours?.openNow,
      distance_km: nearby
        ? distanceKm(
            { lat: input.lat!, lng: input.lng! },
            { lat: p.location!.latitude, lng: p.location!.longitude },
          )
        : undefined,
      maps_url: navigationURL(
        p.id,
        p.location!.latitude,
        p.location!.longitude,
      ),
      attribution: p.attributions?.map((a) => a.provider).join(", "),
      attributions: p.attributions?.map((a) => ({
        provider: a.provider,
        uri: a.providerUri?.startsWith("https://") ? a.providerUri : undefined,
      })),
    }))
    .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
}
