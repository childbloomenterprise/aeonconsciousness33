import {
  cuisineRegion,
  destinationMenus,
  foodRegions,
} from "../../shared/destinationCuisine";
import { useEffect, useState } from "react";
import { MapPin, ArrowUpRight, Soup, Search } from "lucide-react";
import { dishes } from "../../shared/cuisine";
import "./cuisine.css";

type Dish = {
  id: string;
  name: string;
  subtitle: string;
  diet: string;
  period: string;
  ingredients: string;
  image: string | null;
  region: string;
};
const extra: [string, string, string, string, string, string][] = [
  [
    "idiyappam",
    "Idiyappam & vegetable stew",
    "Delicate rice noodles",
    "vegetarian",
    "breakfast",
    "Rice flour, coconut milk and vegetables",
  ],
  [
    "avial",
    "Avial",
    "A colorful coconut vegetable curry",
    "vegetarian",
    "lunch",
    "Mixed vegetables, coconut, yogurt and curry leaves",
  ],
  [
    "olan",
    "Olan",
    "A mellow sadya favorite",
    "vegetarian",
    "lunch",
    "Ash gourd, cowpeas and coconut milk",
  ],
  [
    "erissery",
    "Erissery",
    "Pumpkin with toasted coconut",
    "vegetarian",
    "lunch",
    "Pumpkin, beans, coconut and spices",
  ],
  [
    "thoran",
    "Thoran",
    "Everyday vegetables, Kerala style",
    "vegetarian",
    "lunch",
    "Seasonal vegetables, coconut and mustard seeds",
  ],
  [
    "theeyal",
    "Theeyal",
    "Roasted coconut and tamarind",
    "vegetarian",
    "lunch",
    "Shallots, coconut, tamarind and spices",
  ],
  [
    "kappa",
    "Kappa & fish curry",
    "Tapioca meets coastal spice",
    "nonvegetarian",
    "lunch",
    "Tapioca, fish, chili and kudampuli",
  ],
  [
    "karimeen",
    "Karimeen pollichathu",
    "Fish cooked in a banana leaf",
    "nonvegetarian",
    "dinner",
    "Pearl spot fish, shallots and spices",
  ],
  [
    "prawns",
    "Chemmeen curry",
    "Kerala prawn curry",
    "nonvegetarian",
    "dinner",
    "Prawns, coconut and spices",
  ],
  [
    "chicken",
    "Nadan kozhi curry",
    "Homestyle chicken curry",
    "nonvegetarian",
    "dinner",
    "Chicken, coconut, onions and spices",
  ],
  [
    "beef",
    "Beef ularthiyathu",
    "Slow-roasted with warm spices",
    "nonvegetarian",
    "dinner",
    "Beef, coconut pieces and spices",
  ],
  [
    "pathiri",
    "Pathiri",
    "Soft Malabar rice flatbread",
    "vegetarian",
    "dinner",
    "Rice flour, water and salt",
  ],
  [
    "pazham",
    "Pazham pori",
    "Golden banana fritters",
    "vegetarian",
    "snack",
    "Ripe banana, wheat flour and sugar",
  ],
  [
    "chips",
    "Banana chips",
    "Crisp, salty Kerala favorite",
    "vegetarian",
    "snack",
    "Raw banana, oil and salt",
  ],
  [
    "unnakaya",
    "Unnakaya",
    "Sweet stuffed plantain",
    "vegetarian",
    "snack",
    "Plantain, coconut, sugar and nuts; some recipes use egg",
  ],
  [
    "vattayappam",
    "Vattayappam",
    "Steamed coconut rice cake",
    "vegetarian",
    "snack",
    "Rice, coconut, sugar and yeast",
  ],
];
const expand = (rows: typeof extra, region: string): Dish[] =>
  rows.map(([id, name, subtitle, diet, period, ingredients]) => ({
    id,
    name,
    subtitle,
    diet,
    period,
    ingredients,
    image: null,
    region,
  }));
const catalog: Dish[] = [
  ...dishes.map((d) => ({ ...d, region: "Kerala" })),
  ...expand(extra, "Kerala"),
  ...Object.entries(destinationMenus).flatMap(([region, rows]) =>
    rows.map((d) => ({
      ...d,
      name: d.label,
      subtitle: `Explore ${region} through food`,
      ingredients: "Recipes vary; ask the restaurant",
      image: null,
      region,
    })),
  ),
];

export function CuisineExplorer({
  destination = "Munnar, Kerala",
}: {
  destination?: string;
}) {
  const [region, setRegion] = useState(cuisineRegion(destination) || "");
  const [search, setSearch] = useState("");
  const [diet, setDiet] = useState("all");
  const [period, setPeriod] = useState("all");
  const [location, setLocation] = useState(destination);
  const [selected, setSelected] = useState<Dish | null>(null);
  useEffect(() => {
    setRegion(cuisineRegion(destination) || "");
    setLocation(destination);
    setSelected(null);
    setSearch("");
  }, [destination]);
  const visible = catalog.filter(
    (d) =>
      d.region === region &&
      (diet === "all" || d.diet === diet) &&
      (period === "all" || d.period === period) &&
      `${d.name} ${d.subtitle} ${d.ingredients}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  const query = `${selected?.name || region || "local"} restaurants ${location.trim() || destination}`;
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  return (
    <section
      className="panel cuisine-explorer"
      aria-labelledby="cuisine-heading"
    >
      <div className="cuisine-heading">
        <div>
          <span className="eyebrow">EXPLORE THROUGH FOOD</span>
          <h2 id="cuisine-heading">Local cuisine, a little closer.</h2>
          <p>Discover regional favorites, then find places to try them.</p>
        </div>
        <MapPin size={28} aria-hidden="true" />
      </div>
      <div className="cuisine-controls">
        <label>
          Cuisine region
          <select
            aria-label="Cuisine region"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setSelected(null);
              setSearch("");
            }}
          >
            <option value="">Choose a cuisine region</option>
            {foodRegions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Search dishes
          <div className="cuisine-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search dishes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dish, ingredient or flavor"
            />
          </div>
        </label>
        <label>
          Food preference
          <select value={diet} onChange={(e) => setDiet(e.target.value)}>
            <option value="all">All flavors</option>
            <option value="vegetarian">Vegetarian recipes</option>
            <option value="nonvegetarian">Meat, fish & egg</option>
          </select>
        </label>
        <label>
          Meal time
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">Any time</option>
            {["breakfast", "lunch", "dinner", "snack"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="cuisine-layout">
        <div>
          <p className="small muted" role="status">
            {visible.length} regional favorites
          </p>
          <div className="cuisine-grid">
            {visible.map((d) => (
              <article
                className={`cuisine-card ${selected?.id === d.id ? "cuisine-selected" : ""}`}
                key={d.id}
              >
                {d.image ? (
                  <img src={d.image} alt={d.name} loading="lazy" />
                ) : (
                  <div className="cuisine-art" aria-hidden="true">
                    <Soup size={30} />
                  </div>
                )}
                <div className="cuisine-card-body">
                  <span className="eyebrow">
                    {d.period} ·{" "}
                    {d.diet === "vegetarian" ? "Vegetarian" : "Nonvegetarian"}
                  </span>
                  <h3>{d.name}</h3>
                  <p>{d.subtitle}</p>
                  <p className="small muted">
                    Typical ingredients: {d.ingredients}.
                  </p>
                  <button
                    type="button"
                    className="text-link"
                    aria-label={`Find ${d.name} on map`}
                    onClick={() => setSelected(d)}
                  >
                    <MapPin size={15} />
                    Find on map
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {visible.length === 0 && (
            <p>No dishes match. Try another search or filter.</p>
          )}
        </div>
        <aside className="cuisine-map">
          <span className="eyebrow">GOOGLE MAPS</span>
          <h3>{selected ? `Try ${selected.name}` : "Find local flavors"}</h3>
          <label>
            Search around
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={160}
              placeholder="City or neighborhood"
            />
          </label>
          <iframe
            title="Google Maps restaurant search"
            src={mapUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            Open Google Maps
            <ArrowUpRight size={16} />
          </a>
          <p className="small muted">
            Map results are searches, not verified menus. Check availability,
            hours and ingredients with the restaurant.
          </p>
        </aside>
      </div>
      <p className="small muted">
        Regional highlights, not an exhaustive menu. Recipes vary; confirm
        vegetarian ingredients and allergy cross-contact before ordering.
      </p>
      <p className="small muted">
        Explore more:{" "}
        <a
          href="https://www.keralatourism.org/responsible-tourism/ethnic-cuisine/dishes"
          target="_blank"
          rel="noopener noreferrer"
        >
          Kerala Tourism cuisine directory
        </a>{" "}
        ·{" "}
        <a
          href="https://www.visitdubai.com/things-to-do/eat-and-drink/discover-emirati-cuisine-in-dubai"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit Dubai Emirati cuisine
        </a>
      </p>
    </section>
  );
}
