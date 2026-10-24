import { useEffect, useRef, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import type { Place, Location } from "../../shared/contracts";
type MapAPI = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => { fitBounds: (bounds: unknown) => void };
    Marker: new (options: Record<string, unknown>) => {
      addListener: (type: string, fn: () => void) => void;
      setMap: (map: null) => void;
    };
    LatLngBounds: new () => {
      extend: (position: { lat: number; lng: number }) => void;
    };
  };
};
let mapLoader: Promise<MapAPI> | null = null;
function loadMap(): Promise<MapAPI> {
  const existing = (window as unknown as { google?: MapAPI }).google;
  if (mapLoader) return mapLoader;
  if (existing?.maps?.Map) return Promise.resolve(existing);
  const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
  if (!key)
    return Promise.reject(
      new Error(
        "Map display is not connected yet. Verified results remain available as a list.",
      ),
    );
  mapLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const global = window as unknown as {
      google?: MapAPI;
      __lincMapsReady?: () => void;
      gm_authFailure?: () => void;
    };
    const fail = () => {
      clearTimeout(timeout);
      delete global.__lincMapsReady;
      script.remove();
      mapLoader = null;
      reject(new Error("Map could not load. Use the list instead."));
    };
    const timeout = window.setTimeout(fail, 15000);
    global.gm_authFailure = () => {
      window.dispatchEvent(new Event("linc-map-auth-failure"));
      fail();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__lincMapsReady`;
    script.async = true;
    global.__lincMapsReady = () => {
      clearTimeout(timeout);
      delete global.__lincMapsReady;
      const api = global.google;
      api ? resolve(api) : fail();
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return mapLoader;
}
export function PlaceMap({
  places,
  location,
  onSelect,
}: {
  places: Place[];
  location: Location | null;
  onSelect: (place: Place) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const markers: Array<{ setMap: (m: null) => void }> = [];
    setError("");
    const authFailure = () =>
      setError(
        "Map display is unavailable. Addresses, calling and directions remain available below.",
      );
    window.addEventListener("linc-map-auth-failure", authFailure);
    loadMap()
      .then((api) => {
        if (cancelled || !ref.current) return;
        const map = new api.maps.Map(ref.current, {
          center: places.length
            ? { lat: places[0].lat, lng: places[0].lng }
            : location || { lat: 10.0889, lng: 77.0595 },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeId: "roadmap",
        });
        const bounds = new api.maps.LatLngBounds();
        places.forEach((p) => {
          const marker = new api.maps.Marker({
            map,
            position: { lat: p.lat, lng: p.lng },
            title: p.name,
          });
          marker.addListener("click", () => onSelect(p));
          markers.push(marker);
          bounds.extend({ lat: p.lat, lng: p.lng });
        });
        if (places.length > 1) map.fitBounds(bounds);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
      window.removeEventListener("linc-map-auth-failure", authFailure);
      markers.forEach((m) => m.setMap(null));
    };
  }, [places, location]);
  return error ? (
    <div className="map-unavailable">
      <MapIcon size={32} />
      <p>{error}</p>
    </div>
  ) : (
    <div
      ref={ref}
      className="live-map"
      aria-label="Map of verified nearby places"
    />
  );
}
