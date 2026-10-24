import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  MapPin,
  LocateFixed,
  Search,
  Hospital,
  Pill,
  Stethoscope,
  Utensils,
  BedDouble,
  Fuel,
  Navigation,
  Phone,
  List,
  Map as MapIcon,
  ExternalLink,
  ShieldCheck,
  Dumbbell,
  Camera,
  Trees,
  ShoppingBasket,
} from "lucide-react";
import type { Place, Location } from "../../shared/contracts";
import {
  MUNNAR,
  demoDistance,
  demoNotice,
  demoPlacesFor,
  projectToBox,
} from "../../shared/demoPlaces";
import { PlaceMap } from "../components/PlaceMap";
import { useLinc } from "../state";
import { Button, Empty, ErrorBox } from "../components/ui";
const categories = [
  { id: "hospitals", label: "Hospitals", icon: Hospital },
  { id: "clinics", label: "Clinics", icon: Stethoscope },
  { id: "pharmacies", label: "Pharmacies", icon: Pill },
  { id: "restaurants", label: "Restaurants", icon: Utensils },
  { id: "hotels", label: "Hotels", icon: BedDouble },
  { id: "petrol", label: "Petrol", icon: Fuel },
  { id: "sports", label: "Sports", icon: Dumbbell },
  { id: "attractions", label: "Attractions", icon: Camera },
  { id: "parks", label: "Parks", icon: Trees },
  { id: "supermarkets", label: "Groceries", icon: ShoppingBasket },
];
/**
 * Schematic map used only for the labelled Munnar demonstration points, so the
 * Nearby screen stays useful before a Places key exists. It draws no provider
 * tiles and carries no Google attribution, because none of this is provider data.
 */
function DemoMap({
  places,
  onSelect,
}: {
  places: Place[];
  onSelect: (place: Place) => void;
}) {
  const points = places.length ? places : [MUNNAR];
  return (
    <div
      className="demo-map"
      role="group"
      aria-label={`Schematic demonstration map of ${MUNNAR.label}`}
    >
      <div className="demo-map-grid" aria-hidden="true" />
      <span className="demo-map-place">{MUNNAR.label}</span>
      {places.map((place) => {
        const position = projectToBox(points, place);
        if (!position) return null;
        return (
          <button
            key={place.id}
            className="demo-pin"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            onClick={() => onSelect(place)}
            aria-label={`${place.name}, sample point`}
          >
            <MapPin size={14} />
            <span>{place.name}</span>
          </button>
        );
      })}
      <span className="demo-map-scale">SAMPLE MAP · NOT TO SCALE</span>
    </div>
  );
}
export function Nearby() {
  const {
    call,
    signedIn,
    setAuthOpen,
    preview,
    selectedJourney,
    activeJourney: currentJourney,
  } = useLinc();
  const activeJourney = selectedJourney || currentJourney;
  const route = useLocation();
  const params = new URLSearchParams(route.search);
  const [category, setCategory] = useState(
    (categories.some((c) => c.id === params.get("category"))
      ? params.get("category")
      : null) ||
      (route.state as { category?: string } | null)?.category ||
      "hospitals",
  );
  const [manual, setManual] = useState(
    params.get("location") || activeJourney?.destination_name || "",
  );
  const [location, setLocation] = useState<Location | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [map, setMap] = useState(false);
  const searchVersion = useRef(0);

  async function search(loc: Location | null = location, type = category) {
    if (!signedIn) {
      setAuthOpen(true);
      return;
    }
    const version = ++searchVersion.current;
    setBusy(true);
    setError("");
    setSelected(null);
    try {
      if (preview) {
        // Development fixture: the same labelled Munnar sample points the server
        // serves while Places is unconfigured. Nothing is presented as real.
        setPlaces(
          demoPlacesFor(type).map((p) => ({
            ...p,
            distance_km: demoDistance(loc, p),
          })),
        );
        setSearched(true);
        return;
      }
      const params = new URLSearchParams({ category: type });
      if (loc) {
        params.set("lat", String(loc.lat));
        params.set("lng", String(loc.lng));
      } else if (manual.trim()) params.set("location", manual.trim());
      else throw new Error("Use your location or enter a destination first.");
      const results = await call<Place[]>(`nearby?${params}`);
      if (version !== searchVersion.current) return;
      setPlaces(results);
      setSearched(true);
    } catch (err) {
      if (version !== searchVersion.current) return;
      setError((err as Error).message);
      setPlaces([]);
    } finally {
      if (version === searchVersion.current) setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError("Location is unavailable. Enter a destination instead.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          captured_at: new Date(position.timestamp).toISOString(),
        };
        setLocation(loc);
        void search(loc);
      },
      () => {
        setBusy(false);
        setError(
          "Location could not be shared. Enter a town or destination below.",
        );
      },
      { maximumAge: 60000, timeout: 12000, enableHighAccuracy: false },
    );
  }
  const demo = places.some((p) => p.demo);
  return (
    <div className="page nearby-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE HELP, CLOSE AT HAND</div>
          <h1>
            You’re not far from help<span className="greeting-dot">.</span>
          </h1>
          <p>Find real services around you, wherever the journey takes you.</p>
        </div>
        <Button onClick={locate} loading={busy}>
          <LocateFixed size={17} />
          Use my location
        </Button>
      </div>
      <p className="small muted location-disclosure">
        Your chosen search location is sent to Google Places. Background
        tracking stays off.
      </p>
      <div className="nearby-controls panel">
        <div className="pill-tabs">
          {categories.map((c) => (
            <button
              className={category === c.id ? "active" : ""}
              key={c.id}
              onClick={() => {
                setCategory(c.id);
                if (searched) void search(location, c.id);
              }}
            >
              <c.icon size={16} />
              {c.label}
            </button>
          ))}
        </div>
        <form
          className="nearby-search"
          onSubmit={(e) => {
            e.preventDefault();
            setLocation(null);
            void search(null);
          }}
        >
          <MapPin size={19} />
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            aria-label="Search location"
            placeholder="Or enter a town, e.g. Munnar, Kerala"
            maxLength={160}
          />
          <Button variant="secondary" type="submit" loading={busy}>
            <Search size={16} />
            Search
          </Button>
        </form>
        {location && (
          <p className="small muted">
            Location captured{" "}
            {new Date(location.captured_at).toLocaleTimeString()}
            {location.accuracy
              ? ` · accuracy approximately ${Math.round(location.accuracy)} m`
              : ""}
          </p>
        )}
      </div>
      {error && <ErrorBox message={error} retry={() => void search()} />}
      {places.length > 0 ? (
        <>
          <div className="results-header">
            <span>
              {demo
                ? `${places.length} sample points — not real places`
                : `${places.length} Google Places results`}
            </span>
            <div className="segmented">
              <button
                className={!map ? "active" : ""}
                onClick={() => setMap(false)}
              >
                <List size={16} />
                List
              </button>
              <button
                className={map ? "active" : ""}
                onClick={() => setMap(true)}
              >
                <MapIcon size={16} />
                Map
              </button>
            </div>
          </div>
          {demo && (
            <p className="demo-banner" role="status">
              <MapIcon size={16} />
              <span>
                {demoNotice} Add a Google Places key to replace them with real
                services.
              </span>
            </p>
          )}
          <div className={`nearby-results ${map ? "with-map" : ""}`}>
            <div className="places-list">
              {places.map((p) => (
                <article
                  className={`place-card panel ${selected?.id === p.id ? "selected" : ""}`}
                  key={p.id}
                >
                  <button className="place-main" onClick={() => setSelected(p)}>
                    <span className="mini-icon rose">
                      <MapPin size={22} />
                    </span>
                    <div>
                      <h3>{p.name}</h3>
                      <p>{p.address}</p>
                      <small>
                        {p.distance_km !== undefined
                          ? `${p.distance_km.toFixed(1)} km · approximate straight-line distance`
                          : ""}
                        {p.open_now !== undefined
                          ? ` · ${p.open_now ? "Open now" : "Closed now"}`
                          : ""}
                      </small>
                    </div>
                  </button>
                  <div className="place-actions">
                    <a
                      className="button button-secondary"
                      href={p.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation size={16} />
                      Directions
                      <ExternalLink size={13} />
                    </a>
                    {p.phone && (
                      <a
                        className="button button-primary"
                        href={`tel:${p.phone.replace(/[^+\d]/g, "")}`}
                      >
                        <Phone size={16} />
                        Call
                      </a>
                    )}
                  </div>
                  {p.attributions?.length ? (
                    <p className="small muted place-attributions">
                      {p.attributions.map((a, i) =>
                        a.uri ? (
                          <a
                            key={i}
                            href={a.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {a.provider}
                          </a>
                        ) : (
                          <span key={i}>{a.provider}</span>
                        ),
                      )}
                    </p>
                  ) : p.attribution ? (
                    <p className="small muted">{p.attribution}</p>
                  ) : null}
                </article>
              ))}
              {!demo && (
                <div className="google-attribution">
                  <img
                    src="/images/google-maps-attribution.svg"
                    alt="Google Maps"
                    translate="no"
                  />
                </div>
              )}
            </div>
            {map && (
              <div className="map-panel panel">
                {demo ? (
                  <DemoMap places={places} onSelect={setSelected} />
                ) : (
                  <PlaceMap
                    places={places}
                    location={location}
                    onSelect={setSelected}
                  />
                )}
                {selected && (
                  <div className="selected-map-place">
                    <h3>{selected.name}</h3>
                    <a
                      href={selected.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open directions
                      <ArrowUpRightIcon />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="nearby-empty panel">
          <div className="nearby-empty-visual">
            <div className="mini-icon rose">
              <Hospital size={34} />
            </div>
            <div className="mini-icon green">
              <Pill size={25} />
            </div>
            <div className="mini-icon blue">
              <MapPin size={28} />
            </div>
          </div>
          <Empty
            icon={<LocateFixed size={28} />}
            title={
              busy
                ? "Looking around…"
                : searched
                  ? "No places found in this search"
                  : "Good help starts with a location"
            }
          >
            {busy
              ? "Finding verified places."
              : searched
                ? "Try another category or destination."
                : "Share your location when you need it, or search a town. We don’t track your movements in the background."}
          </Empty>
          <div className="nearby-assurance">
            <ShieldCheck size={16} />
            Place listings come from Google Maps. Confirm hours before visiting.
          </div>
        </div>
      )}
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ExternalLink size={15} />;
}
