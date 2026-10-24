import type { Place } from "./contracts.js";
/**
 * Illustrative map data for Munnar, used only while Google Places is not
 * configured. Every point is explicitly named and labelled as a sample, carries
 * no phone number and no opening hours, and is never described as a real
 * business. Real provider results replace this entirely once a key is present.
 */
export const MUNNAR = { lat: 10.0889, lng: 77.0595, label: "Munnar, Kerala" };
export const demoNotice =
  "Demonstration map · Sample points around Munnar. These are not real listings, and no provider data is used.";
type Category =
  | "hospitals"
  | "clinics"
  | "pharmacies"
  | "restaurants"
  | "hotels"
  | "petrol"
  | "sports"
  | "attractions"
  | "parks"
  | "supermarkets";
const noun: Record<Category, string> = {
  hospitals: "Sample Hospital",
  clinics: "Sample Clinic",
  pharmacies: "Sample Pharmacy",
  restaurants: "Sample Eatery",
  hotels: "Sample Stay",
  petrol: "Sample Fuel Point",
  sports: "Sample Sports Facility",
  attractions: "Sample Attraction",
  parks: "Sample Park",
  supermarkets: "Sample Supermarket",
};
/** Six spread-out points per category, all inside the Munnar area. */
const coords: Record<Category, Array<[number, number]>> = {
  sports: [[10.088, 77.06]],
  attractions: [[10.089, 77.061]],
  parks: [[10.09, 77.062]],
  supermarkets: [[10.091, 77.063]],
  hospitals: [
    [10.102, 77.065],
    [10.0742, 77.0412],
    [10.1184, 77.0288],
    [10.0521, 77.079],
    [10.0955, 77.0902],
    [10.1301, 77.0512],
  ],
  clinics: [
    [10.0881, 77.0551],
    [10.0812, 77.0688],
    [10.109, 77.042],
    [10.066, 77.0602],
    [10.123, 77.0704],
    [10.043, 77.031],
  ],
  pharmacies: [
    [10.0902, 77.0601],
    [10.0855, 77.0722],
    [10.101, 77.033],
    [10.072, 77.048],
    [10.115, 77.062],
    [10.058, 76.999],
  ],
  restaurants: [
    [10.094, 77.048],
    [10.0862, 77.0665],
    [10.108, 77.0312],
    [10.064, 77.0551],
    [10.121, 77.045],
    [10.047, 77.07],
  ],
  hotels: [
    [10.0898, 77.0598],
    [10.0834, 77.0455],
    [10.1012, 77.0712],
    [10.0689, 77.0501],
    [10.1145, 77.0387],
    [10.0512, 77.0633],
  ],
  petrol: [
    [10.0752, 77.0701],
    [10.0968, 77.0562],
    [10.063, 77.0388],
    [10.1122, 77.077],
    [10.0455, 77.052],
    [10.129, 77.032],
  ],
};
export const demoCategories = Object.keys(coords) as Category[];
export function demoPlacesFor(category: string): Place[] {
  const key = (
    demoCategories.includes(category as Category) ? category : "hospitals"
  ) as Category;
  return coords[key].map(([lat, lng], index) => ({
    id: `demo-${key}-${index + 1}`,
    name: `${noun[key]} ${index + 1}`,
    address: "Illustrative point · Munnar, Kerala · not a real listing",
    lat,
    lng,
    maps_url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    demo: true,
  }));
}
/** Straight-line distance in km, mirroring the real adapter's maths. */
export function demoDistance(
  origin: { lat: number; lng: number } | null,
  point: { lat: number; lng: number },
) {
  if (!origin) return undefined;
  const rad = Math.PI / 180;
  const dlat = (point.lat - origin.lat) * rad;
  const dlng = (point.lng - origin.lng) * rad;
  const value =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(origin.lat * rad) *
      Math.cos(point.lat * rad) *
      Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
/**
 * Places a point on a 0–100 box for the schematic map. Returns null when there
 * is nothing to project.
 */
export function projectToBox(
  points: Array<{ lat: number; lng: number }>,
  point: { lat: number; lng: number },
) {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // Enough inset that a pill label stays inside the frame at the extremes.
  const pad = 17;
  const window = 100 - pad * 2;
  const x =
    maxLng === minLng
      ? 50
      : pad + ((point.lng - minLng) / (maxLng - minLng)) * window;
  const y =
    maxLat === minLat
      ? 50
      : pad + ((maxLat - point.lat) / (maxLat - minLat)) * window;
  return { x, y };
}
