export const mealPeriods = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealPeriod = (typeof mealPeriods)[number];
/** Which meal period a plain local hour (0-23) falls into, for home-page recommendations. */
export function mealPeriodForHour(hour: number): MealPeriod {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 21) return "dinner";
  return "snack";
}
/**
 * One-tap South Indian meal suggestions for the log-feeding flow. These are
 * dish names only (not menus or nutrition data) so a tap can log an entry
 * without typing.
 */
export const mealSuggestions = [
  {
    id: "idli-sambar",
    label: "Idli & sambar",
    period: "breakfast",
    diet: "vegetarian",
  },
  {
    id: "dosa-chutney",
    label: "Dosa & chutney",
    period: "breakfast",
    diet: "vegetarian",
  },
  {
    id: "puttu-kadala",
    label: "Puttu & kadala curry",
    period: "breakfast",
    diet: "vegetarian",
  },
  {
    id: "appam-egg",
    label: "Appam & egg curry",
    period: "breakfast",
    diet: "nonvegetarian",
  },
  { id: "uttapam", label: "Uttapam", period: "breakfast", diet: "vegetarian" },
  {
    id: "parotta-kurma-am",
    label: "Parotta & kurma",
    period: "breakfast",
    diet: "vegetarian",
  },
  {
    id: "idiyappam-stew",
    label: "Idiyappam & stew",
    period: "breakfast",
    diet: "vegetarian",
  },
  {
    id: "meals",
    label: "Meals (rice, sambar, rasam, poriyal)",
    period: "lunch",
    diet: "vegetarian",
  },
  {
    id: "chicken-biryani",
    label: "Chicken biryani",
    period: "lunch",
    diet: "nonvegetarian",
  },
  {
    id: "fish-curry-rice",
    label: "Fish curry & rice",
    period: "lunch",
    diet: "nonvegetarian",
  },
  {
    id: "parotta-chilli-chicken",
    label: "Parotta & chilli chicken",
    period: "lunch",
    diet: "nonvegetarian",
  },
  {
    id: "chapati-paneer-butter",
    label: "Chapati & paneer butter masala",
    period: "lunch",
    diet: "vegetarian",
  },
  { id: "curd-rice", label: "Curd rice", period: "lunch", diet: "vegetarian" },
  {
    id: "lemon-rice",
    label: "Lemon rice",
    period: "lunch",
    diet: "vegetarian",
  },
  {
    id: "dosa-sambar-pm",
    label: "Dosa & sambar",
    period: "dinner",
    diet: "vegetarian",
  },
  {
    id: "chapati-chicken-curry",
    label: "Chapati & chicken curry",
    period: "dinner",
    diet: "nonvegetarian",
  },
  {
    id: "chicken-65",
    label: "Chicken 65",
    period: "dinner",
    diet: "nonvegetarian",
  },
  {
    id: "parotta-paneer-kurma",
    label: "Parotta & paneer kurma",
    period: "dinner",
    diet: "vegetarian",
  },
  {
    id: "veg-biryani",
    label: "Veg biryani",
    period: "dinner",
    diet: "vegetarian",
  },
  {
    id: "egg-curry-rice",
    label: "Egg curry & rice",
    period: "dinner",
    diet: "nonvegetarian",
  },
  {
    id: "vada-chutney",
    label: "Vada & chutney",
    period: "snack",
    diet: "vegetarian",
  },
  {
    id: "banana-chips",
    label: "Banana chips",
    period: "snack",
    diet: "vegetarian",
  },
  { id: "bonda", label: "Bonda", period: "snack", diet: "vegetarian" },
] as const;
export const dishes = [
  {
    id: "appam",
    name: "Appam & vegetable stew",
    subtitle: "Soft, lacy & comforting",
    image: "/images/appam.webp",
    diet: "vegetarian",
    period: "breakfast",
    ingredients:
      "Rice, coconut milk, vegetables and mild spices. Some recipes include dairy.",
    note: "Typical ingredients only. Confirm ingredients and preparation with the restaurant.",
  },
  {
    id: "fish",
    name: "Kerala fish curry",
    subtitle: "A taste of the Malabar coast",
    image: "/images/fish-curry.webp",
    diet: "nonvegetarian",
    period: "lunch",
    ingredients:
      "Fish, chili, tamarind or kudampuli and spices. Some versions use coconut.",
    note: "Contains fish. Other ingredients and cross-contact are unverified.",
  },
  {
    id: "puttu",
    name: "Puttu & kadala",
    subtitle: "A classic Kerala morning",
    image: "/images/puttu.webp",
    diet: "vegetarian",
    period: "breakfast",
    ingredients: "Rice flour, coconut, black chickpeas and spices.",
    note: "Typical ingredients only. Restaurant recipe and allergy safety are unverified.",
  },
  {
    id: "idli-sambar",
    name: "Idli & sambar",
    subtitle: "Steamed, light, everyday breakfast",
    image: null,
    diet: "vegetarian",
    period: "breakfast",
    ingredients: "Steamed rice & lentil cakes, lentil-vegetable sambar.",
    note: "Typical ingredients only. Confirm with the restaurant for allergies.",
  },
  {
    id: "dosa",
    name: "Dosa & chutney",
    subtitle: "Crisp fermented rice crepe",
    image: null,
    diet: "vegetarian",
    period: "breakfast",
    ingredients: "Fermented rice & lentil batter, coconut or tomato chutney.",
    note: "Typical ingredients only. Potato fillings (masala dosa) may add dairy.",
  },
  {
    id: "meals",
    name: "Kerala sadya-style meals",
    subtitle: "Rice, sambar, rasam & poriyal",
    image: null,
    diet: "vegetarian",
    period: "lunch",
    ingredients: "Rice with lentil curries, vegetable stir-fries and pickles.",
    note: "Typical ingredients only. Many versions are served on a banana leaf.",
  },
  {
    id: "biryani",
    name: "Malabar biryani",
    subtitle: "Fragrant rice, slow-cooked spices",
    image: null,
    diet: "nonvegetarian",
    period: "lunch",
    ingredients:
      "Basmati or khyma rice, chicken or mutton, fried onions, spices.",
    note: "Contains meat. Vegetable versions exist — ask before ordering.",
  },
  {
    id: "fish-moilee",
    name: "Fish moilee",
    subtitle: "Gentle coconut milk fish stew",
    image: null,
    diet: "nonvegetarian",
    period: "lunch",
    ingredients: "Fish, coconut milk, curry leaves, green chili, turmeric.",
    note: "Contains fish and coconut. Mild compared to most Kerala curries.",
  },
  {
    id: "parotta",
    name: "Parotta & kurma",
    subtitle: "Flaky layered flatbread",
    image: null,
    diet: "vegetarian",
    period: "dinner",
    ingredients: "Maida flour, oil, vegetable or egg kurma.",
    note: "Typical ingredients only. Non-vegetarian versions are common too.",
  },
  {
    id: "payasam",
    name: "Payasam",
    subtitle: "Sweet finish to a Kerala meal",
    image: null,
    diet: "vegetarian",
    period: "snack",
    ingredients: "Rice or vermicelli, jaggery or sugar, coconut milk, nuts.",
    note: "Often contains nuts and dairy — ask if you have allergies.",
  },
  {
    id: "vada",
    name: "Vada & chutney",
    subtitle: "Crisp lentil fritters",
    image: null,
    diet: "vegetarian",
    period: "snack",
    ingredients: "Lentil batter, curry leaves, coconut chutney.",
    note: "Typical ingredients only. Fried in oil shared across the kitchen.",
  },
] as const;
