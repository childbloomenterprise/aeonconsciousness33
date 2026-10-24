import type { Urgency } from "./contracts.js";

// Conservative informational prompts. These rules are not validated clinical triage.
const emergency = [
  /(?:can't|cannot|can not|unable to|struggling to) breathe/i,
  /(?:difficulty|trouble) breathing/i,
  /(?:tongue|throat|lips?) (?:is |are )?(?:swelling|swollen)/i,
  /(?:passed out|fainted|lost consciousness|unconscious)/i,
  /(?:severe|crushing) chest pain/i,
  /(?:sudden|new) (?:confusion|one.sided weakness)/i,
  /vomit(?:ing|ed)? blood|blood in (?:my )?vomit/i,
];
const seekCare = [
  /blood(?:y)? (?:in (?:my )?)?stool|bloody diarrh[oe]+a/i,
  /(?:severe|unbearable|rapidly worsening) (?:abdominal|stomach|belly) pain/i,
  /(?:can't|cannot|unable to) (?:keep|hold) (?:any )?(?:water|fluids?|liquids?) down/i,
  /(?:haven't|have not|not) (?:urinated|peed) (?:for|in) (?:\d+|many|several) hours/i,
  /(?:severe|significant) dehydration/i,
];
function currentStatements(text: string) {
  return text.split(/[.!?;\n]|\bbut\b/i).filter((part) => {
    if (
      /\b(?:last year|last month|used to|years? ago|previous trip)\b/i.test(
        part,
      )
    )
      return false;
    if (
      /\b(?:what if|what does|what are|what is|if someone|how to recognize|how do i recognize)\b/i.test(
        part,
      )
    )
      return false;
    return true;
  });
}
function affirmed(part: string, pattern: RegExp) {
  const match = pattern.exec(part);
  if (!match) return false;
  const prefix = part.slice(Math.max(0, match.index - 55), match.index);
  return !/\b(?:no|not|never|without|deny|denies|don't have|do not have)\s+(?:(?:any|currently|experiencing|having|have|longer|a|the|signs of)\s+)*$/i.test(
    prefix,
  );
}
export function screenSafety(text: string): {
  urgency: Urgency;
  message: string | null;
} {
  const parts = currentStatements(text.replace(/[‘’]/g, "'"));
  if (parts.some((p) => emergency.some((rule) => affirmed(p, rule))))
    return {
      urgency: "emergency",
      message:
        "You described a warning sign that may need emergency attention. Contact emergency services now. Do not wait for this app or a nearby search.",
    };
  if (parts.some((p) => seekCare.some((rule) => affirmed(p, rule))))
    return {
      urgency: "seek_care",
      message:
        "You described a warning sign listed in health guidance. Seek prompt professional medical attention. If symptoms are severe or rapidly worsening, contact emergency services.",
    };
  return { urgency: "none", message: null };
}
export function isHealthText(text: string) {
  return (
    /\b(symptom|nausea|nauseous|sick|vomit|diarrh|stomach|abdominal|headache|dehydrat|allerg|breath|pain|fever|dizz|faint|medicat|illness|health|rash|swollen|food poisoning)\w*/i.test(
      text,
    ) || /\b(?:safe|safety|hygien|contamin|foodborne|rehydrat)\w*/i.test(text)
  );
}
export function isCareSearch(text: string) {
  return /\b(?:hospitals?|pharmac(?:y|ies|eutical\w*)|chemist(?:s)?|clinics?)\b/i.test(
    text,
  );
}
export function isSensitiveText(text: string) {
  return (
    isHealthText(text) ||
    isCareSearch(text) ||
    /\b(ate|eaten|had .{0,30}(?:breakfast|lunch|dinner)|meal|drank|taken|took|medicine|tablet|pill)\b/i.test(
      text,
    )
  );
}
export function inKerala(destination: string | null | undefined) {
  return (
    !!destination &&
    /\b(kerala|munnar|kochi|thiruvananthapuram|trivandrum|alappuzha|wayanad|kozhikode)\b/i.test(
      destination,
    )
  );
}
export function inIndia(destination: string | null | undefined) {
  return (
    inKerala(destination) ||
    (!!destination &&
      /\b(india|delhi|mumbai|bengaluru|bangalore|chennai|hyderabad|goa|kolkata|jaipur|pune)\b/i.test(
        destination,
      ))
  );
}
