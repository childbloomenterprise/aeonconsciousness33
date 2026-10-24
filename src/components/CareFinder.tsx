import { useEffect, useMemo, useRef, useState } from "react";
import {
  Hospital,
  Pill,
  MapPin,
  Navigation,
  Phone,
  LocateFixed,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import type { Place, Urgency } from "../../shared/contracts";
import { useLinc } from "../state";
import { Button } from "./ui";
import { PlaceMap } from "./PlaceMap";
import "./care-finder.css";

type Category = "hospitals" | "pharmacies";
type SearchArea = {
  label: string;
  lat?: number;
  lng?: number;
  capturedAt: number;
};
type Group = { places: Place[]; error: string };
const emptyGroups = (): Record<Category, Group> => ({
  hospitals: { places: [], error: "" },
  pharmacies: { places: [], error: "" },
});

export function CareFinder({
  destination,
  urgency,
  onSOS,
}: {
  destination?: string;
  urgency: Urgency;
  onSOS: () => void;
}) {
  const { call, signedIn, preview, setAuthOpen } = useLinc();
  const [town, setTown] = useState(destination || "");
  const [area, setArea] = useState<SearchArea | null>(null);
  const [groups, setGroups] = useState(emptyGroups);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Place | null>(null);
  const mapPlaces = useMemo(() => (selected ? [selected] : []), [selected]);
  const [copied, setCopied] = useState(false);
  const version = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      version.current++;
    };
  }, []);

  // No symptom text, profile or conversation is included in a Places request.
  async function search(next: SearchArea) {
    if (!signedIn) {
      setAuthOpen(true);
      return;
    }
    const current = ++version.current;
    setArea(next);
    setSelected(null);
    setGroups(emptyGroups());
    setError("");
    setLoading(true);
    await Promise.all(
      (["hospitals", "pharmacies"] as Category[]).map(async (category) => {
        try {
          const params = new URLSearchParams({ category });
          if (next.lat !== undefined && next.lng !== undefined) {
            params.set("lat", String(next.lat));
            params.set("lng", String(next.lng));
          } else params.set("location", next.label);
          const places = await call<Place[]>(`nearby?${params}`);
          if (!alive.current || current !== version.current) return;
          // Fixtures are permitted only in the explicitly labelled development preview.
          const real = places.filter((p) => preview || !p.demo).slice(0, 3);
          setGroups((previous) => ({
            ...previous,
            [category]: { places: real, error: "" },
          }));
        } catch (failure) {
          if (!alive.current || current !== version.current) return;
          setGroups((previous) => ({
            ...previous,
            [category]: {
              places: [],
              error:
                (failure as Error).message ||
                "Listings could not load. Try Google Maps below.",
            },
          }));
        }
      }),
    );
    if (alive.current && current === version.current) setLoading(false);
  }
  function locate() {
    if (!signedIn) {
      setAuthOpen(true);
      return;
    }
    if (!navigator.geolocation) {
      setError("Location is unavailable. Enter your current town instead.");
      return;
    }
    const current = ++version.current;
    setGroups(emptyGroups());
    setArea(null);
    setSelected(null);
    setLoading(false);
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!alive.current || current !== version.current) return;
        setLocating(false);
        void search({
          label: "Your shared location",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          capturedAt: position.timestamp,
        });
      },
      () => {
        if (!alive.current || current !== version.current) return;
        setLocating(false);
        setError(
          "Location was not shared. Enter your current town or use Google Maps below.",
        );
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false },
    );
  }
  function mapsSearch(category: Category) {
    const near =
      area?.lat !== undefined ? `${area.lat},${area.lng}` : town.trim();
    return (
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(`${category} ${near ? "near " + near : "near me"}`)
    );
  }
  async function copyLocation() {
    if (!area) return;
    try {
      await navigator.clipboard.writeText(
        area.lat !== undefined
          ? `https://www.google.com/maps/search/?api=1&query=${area.lat},${area.lng}`
          : area.label,
      );
      if (alive.current) setCopied(true);
    } catch {
      setError("Could not copy. You can share the location using Google Maps.");
    }
  }
  const order: Category[] =
    urgency === "emergency" || urgency === "seek_care"
      ? ["hospitals", "pharmacies"]
      : ["pharmacies", "hospitals"];
  return (
    <section
      className={`care-finder ${urgency === "emergency" ? "care-urgent" : ""}`}
      aria-label="Care near you"
    >
      <header className="care-heading">
        <span className="care-symbol">
          <Hospital size={21} />
        </span>
        <div>
          <strong>
            {urgency === "emergency"
              ? "Find hospital care now"
              : "Care, right here in your chat"}
          </strong>
          <p>Hospitals and pharmacies around the location you choose.</p>
        </div>
      </header>
      {urgency === "emergency" && (
        <div className="care-emergency">
          <p>
            Contact emergency services now. Do not wait for a map or these
            listings.
          </p>
          <Button variant="danger" onClick={onSOS}>
            Emergency calling options
          </Button>
        </div>
      )}
      <div className="care-location-controls">
        <Button variant="secondary" onClick={locate} disabled={locating}>
          <LocateFixed size={16} />
          {locating ? "Getting location…" : "Use my current location"}
        </Button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (town.trim().length < 2) {
              setError("Enter your current town or area.");
              return;
            }
            version.current++;
            setLocating(false);
            setCopied(false);
            void search({ label: town.trim(), capturedAt: Date.now() });
          }}
        >
          <label className="sr-only" htmlFor="care-town">
            Current town or area
          </label>
          <input
            id="care-town"
            value={town}
            onChange={(event) => setTown(event.target.value)}
            maxLength={160}
            placeholder="Current town or area"
            autoComplete="off"
          />
          <Button type="submit" disabled={town.trim().length < 2}>
            Find care
          </Button>
        </form>
      </div>
      <p className="care-note">
        {destination && !area
          ? `Trip destination: ${destination}. Confirm where you are now before searching. `
          : ""}
        Only your chosen location and place category go to Google. Location is
        used for this chat session; background tracking stays off.
      </p>
      {!signedIn && (
        <p className="care-note">
          Sign in for listings inside this chat. Google Maps searches and
          emergency calling remain available below.
        </p>
      )}
      {error && (
        <p role="alert" className="care-error">
          {error}
        </p>
      )}
      {area && (
        <div className="care-area">
          <MapPin size={15} />
          <span>
            {area.label} · checked{" "}
            {new Date(area.capturedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <button
            type="button"
            onClick={() => void copyLocation()}
            aria-label="Copy search location"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copied" : "Copy location"}
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className="care-note">
          Finding hospitals and pharmacies…
        </p>
      )}
      {area && (
        <div className="care-groups">
          {order.map((category) => (
            <div key={category}>
              <h3>
                {category === "hospitals" ? (
                  <Hospital size={17} />
                ) : (
                  <Pill size={17} />
                )}
                {category === "hospitals" ? "Hospitals" : "Pharmacies"}
              </h3>
              {groups[category].error && (
                <p role="alert" className="care-error">
                  {groups[category].error}
                </p>
              )}
              {!loading &&
                !groups[category].error &&
                !groups[category].places.length && (
                  <p className="care-note">
                    No {category} returned for this area. Try a larger town or
                    Google Maps.
                  </p>
                )}
              {groups[category].places.map((place) => (
                <article className="care-place" key={place.id}>
                  <strong>{place.name}</strong>
                  <p>{place.address}</p>
                  <div className="care-place-meta">
                    {place.demo && <span>Development sample</span>}
                    {place.distance_km !== undefined && (
                      <span>
                        {place.distance_km.toFixed(1)} km · straight-line
                        distance
                      </span>
                    )}
                    <span>
                      {place.open_now === true
                        ? "Reported open"
                        : place.open_now === false
                          ? "Reported closed"
                          : "Hours unavailable"}
                    </span>
                  </div>
                  <div className="care-place-actions">
                    <a
                      href={place.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation size={15} />
                      Directions
                    </a>
                    {place.phone && /^\+?[\d ()-]{7,25}$/.test(place.phone) && (
                      <a href={`tel:${place.phone.replace(/[^+\d]/g, "")}`}>
                        <Phone size={15} />
                        Call
                      </a>
                    )}
                    {!place.demo && (
                      <button
                        type="button"
                        aria-pressed={selected?.id === place.id}
                        onClick={() =>
                          setSelected(selected?.id === place.id ? null : place)
                        }
                      >
                        <MapPin size={15} />
                        {selected?.id === place.id
                          ? "Hide map"
                          : "Show map here"}
                      </button>
                    )}
                  </div>
                  {place.attributions?.map((a, index) => (
                    <small key={`${a.provider}-${index}`}>
                      {a.uri ? (
                        <a
                          href={a.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {a.provider}
                        </a>
                      ) : (
                        a.provider
                      )}
                    </small>
                  ))}
                </article>
              ))}
            </div>
          ))}
        </div>
      )}
      {selected && (
        <div className="care-map">
          <PlaceMap places={mapPlaces} location={null} onSelect={setSelected} />
        </div>
      )}
      <div className="care-fallbacks">
        <a
          href={mapsSearch("hospitals")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Hospital search in Google Maps
          <ExternalLink size={14} />
        </a>
        <a
          href={mapsSearch("pharmacies")}
          target="_blank"
          rel="noopener noreferrer"
        >
          Pharmacy search in Google Maps
          <ExternalLink size={14} />
        </a>
      </div>
      <p className="care-note care-attribution">
        Place listings from Google Maps. Confirm hours and services directly; a
        hospital listing does not confirm emergency department availability. A
        pharmacy listing does not confirm stock or recommend a medicine.
      </p>
    </section>
  );
}
