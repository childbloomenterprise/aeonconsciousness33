import type { ChatResult } from "./contracts.js";
import { isHealthText, isCareSearch, screenSafety } from "./safety.js";
import { retrieveSources } from "./knowledge.js";
export function sourceReply(text: string, forceHealth = false): ChatResult {
  const safety = screenSafety(text);
  const refs = retrieveSources(text);
  const careOnly =
    isCareSearch(text) && !isHealthText(text) && safety.urgency === "none";
  const health =
    forceHealth ||
    isHealthText(text) ||
    isCareSearch(text) ||
    safety.urgency !== "none";
  return {
    guidance: careOnly
      ? undefined
      : {
          reason:
            safety.message ||
            "Your reported symptoms deserve attention. The journey feed can provide a timeline, but cannot diagnose a condition.",
          cause:
            "No cause has been established. A meal occurring before symptoms does not prove that it caused them.",
          personalised_support:
            "Review the meals, drinks and symptoms you reported for this journey. Share that timeline with a healthcare professional; missing entries are unknown, not evidence of absence.",
          immediate_suggestion:
            safety.message ||
            "If symptoms persist, worsen, or concern you, contact a healthcare professional. Use nearby help to find a hospital or pharmacy; do not choose medication from this chat.",
        },
    reply:
      (careOnly
        ? "Choose your current location in the care panel below to find hospitals and pharmacies, see addresses, and open directions without leaving this conversation."
        : null) ||
      safety.message ||
      (refs.length
        ? "I can show your recent records alongside general health information. Timing alone cannot establish what caused your symptoms. Open the sources below for their guidance, and contact a healthcare professional for advice specific to you."
        : "I cannot assess or diagnose this concern. A healthcare professional can give advice specific to you. You can review your records or find nearby help."),
    intent: health ? "health" : "travel",
    conversation_id: null,
    events: [],
    medical_context: {
      contains_health_guidance: health,
      urgency: safety.urgency === "none" && health ? "routine" : safety.urgency,
      source_ids: refs.map((x) => x.id),
    },
    actions: health
      ? [
          {
            type: safety.urgency === "emergency" ? "sos" : "nearby",
            label:
              safety.urgency === "emergency"
                ? "Emergency assistance"
                : "Find nearby help",
          },
        ]
      : [],
  };
}
