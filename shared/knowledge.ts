import type { Source } from "./contracts.js";

const verified = "2026-10-10";
export const sources: Source[] = [
  {
    id: "foodborne",
    topic: "Foodborne symptoms",
    title: "Food Poisoning Symptoms",
    organization: "CDC",
    url: "https://www.cdc.gov/food-safety/signs-symptoms/index.html",
    summary:
      "Foodborne illnesses can have different symptoms and onset times. Timing after a meal does not identify its cause. Bloody diarrhea, persistent vomiting, and signs of dehydration warrant professional attention.",
    verified_at: verified,
    license_status:
      "Original summary; source linked. Third-party material excluded.",
    review_status: "Source verified; not clinically reviewed",
  },
  {
    id: "hydration",
    topic: "Hydration",
    title: "Travelers’ Diarrhea — Oral rehydration",
    organization: "CDC Yellow Book",
    url: "https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/travelers-diarrhea.html",
    summary:
      "Diarrhea and vomiting can cause loss of fluids and electrolytes. General guidance discusses safe drinking water and packaged oral rehydration salts prepared according to their label. A professional can advise what is appropriate for an individual.",
    verified_at: verified,
    license_status:
      "Original summary; source linked. No medication regimens reproduced.",
    review_status: "Source verified; not clinically reviewed",
  },
  {
    id: "travel-diarrhea",
    topic: "Travelers’ diarrhea",
    title: "Travelers’ Diarrhea",
    organization: "CDC Yellow Book",
    url: "https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/travelers-diarrhea.html",
    summary:
      "Stomach symptoms during travel may have multiple causes. Food and water precautions reduce some risks but cannot guarantee prevention. This app cannot identify a pathogen or recommend prescription treatment.",
    verified_at: verified,
    license_status: "Original summary; source linked.",
    review_status: "Source verified; not clinically reviewed",
  },
  {
    id: "dehydration",
    topic: "Dehydration warning signs",
    title: "Dehydration",
    organization: "NHS",
    url: "https://www.nhs.uk/conditions/dehydration/",
    summary:
      "Dark urine, urinating less, thirst and dizziness can accompany dehydration. Confusion, unusual drowsiness or breathing difficulty need urgent professional attention. These signs do not establish a diagnosis.",
    verified_at: verified,
    license_status:
      "Original linked summary; no images, branding or treatment regimens reproduced.",
    review_status: "Source verified; not clinically reviewed",
  },
  {
    id: "allergy",
    topic: "Food allergies",
    title: "Food allergy",
    organization: "NHS",
    url: "https://www.nhs.uk/conditions/food-allergy/",
    summary:
      "Food allergies can cause a range of reactions. Swelling affecting the mouth or throat, breathing difficulty or faintness may be an emergency. Ask food providers about actual ingredients; a regional dish description cannot guarantee allergy safety.",
    verified_at: verified,
    license_status:
      "Original linked summary; no images or branding reproduced.",
    review_status: "Source verified; not clinically reviewed",
  },
  {
    id: "anaphylaxis",
    topic: "Serious allergic reactions",
    title: "Anaphylaxis",
    organization: "NHS",
    url: "https://www.nhs.uk/conditions/anaphylaxis/",
    summary:
      "A serious allergic reaction can develop quickly and affect breathing or consciousness. Contact local emergency services for these warning signs. This app cannot confirm the cause or replace emergency care.",
    verified_at: verified,
    license_status:
      "Original linked summary; no UK emergency numbers or medication instructions reproduced.",
    review_status: "Source verified; not clinically reviewed",
  },
  {
    id: "food-safety",
    topic: "Food safety",
    title: "Safer Food Choices",
    organization: "CDC",
    url: "https://www.cdc.gov/food-safety/foods/safer-food-choices.html",
    summary:
      "Safe food handling includes cleaning, separating raw foods, cooking thoroughly and chilling appropriately. Food choices and handling can reduce risk but do not guarantee that a meal or restaurant is safe.",
    verified_at: verified,
    license_status: "Original linked summary; third-party material excluded.",
    review_status: "Source verified; not clinically reviewed",
  },
];
function existingSources(text: string): Source[] {
  if (/allerg|swollen|swelling|throat|tongue|breath|faint/i.test(text))
    return [sources[4], sources[5]];
  if (/safe|hygien|cook|contamin/i.test(text)) return [sources[6], sources[0]];
  if (/hydr|water|fluid|thirst|vomit|diarrh/i.test(text))
    return [sources[1], sources[3], sources[0]];
  if (/stomach|nause|food|diarrh|sick|abdominal|poison/i.test(text))
    return [sources[0], sources[2]];
  return [];
}
export const pendingTopics = [
  "WHO food handling",
  "Broader travel precautions",
  "Headache",
  "Heat exposure",
];

const whoFood: Source = {
  id: "who-food-safety",
  topic: "Safer food while travelling",
  title: "Five keys to safer food",
  organization: "WHO",
  url: "https://www.who.int/activities/promoting-safe-food-handling/five-key-to-safer-food",
  summary:
    "WHO recommends keeping food preparation clean, keeping raw and cooked foods apart, thorough cooking, safe storage temperatures and safe water. These practices reduce risk; they do not verify a particular meal.",
  verified_at: "2026-10-16",
  license_status: "Original summary with source link.",
  review_status: "Source checked; not clinically reviewed",
};
const whoDiarrhoea: Source = {
  id: "who-diarrhoea",
  topic: "Diarrhoeal illness",
  title: "Diarrhoeal disease",
  organization: "WHO",
  url: "https://www.who.int/news-room/fact-sheets/detail/diarrhoeal-disease",
  summary:
    "WHO identifies fluid loss as an important risk in diarrhoeal illness and discusses rehydration and prevention through safe water and hygiene. Persistent diarrhoea, blood in stool or dehydration call for professional care; the app cannot identify a cause.",
  verified_at: "2026-10-16",
  license_status: "Original summary with source link; no medication regimen.",
  review_status: "Source checked; not clinically reviewed",
};
sources.push(whoFood, whoDiarrhoea);
export function retrieveSources(text: string): Source[] {
  const base = existingSources(text);
  if (/food|meal|safe|hygien|cook|contamin|stomach|nause/i.test(text))
    base.unshift(whoFood);
  if (/diarrh|vomit|dehydrat|stomach|nause/i.test(text))
    base.unshift(whoDiarrhoea);
  return base;
}
