import { handler, query, quota, ApiError } from "../server/http.js";
import { nearbyInput, searchPlaces } from "../server/places.js";
export default handler(["GET"], async (ctx) => {
  const input = nearbyInput.parse({
    category: query(ctx.req, "category"),
    lat: query(ctx.req, "lat"),
    lng: query(ctx.req, "lng"),
    location: query(ctx.req, "location"),
  });
  await quota(ctx, "places");
  const places = await searchPlaces(input);
  if (places.some((place) => place.demo))
    throw new ApiError(
      503,
      "NEARBY_UNAVAILABLE",
      "Verified nearby search is not connected yet. Search Google Maps directly or try again later.",
    );
  return places;
});
