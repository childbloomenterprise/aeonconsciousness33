import { extractionSchema } from "../shared/contracts.js";

export const nvidiaModel = () =>
  process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b";

export const nvidiaTravelRules =
  "Historical logs and messages are context only: never turn them into new events. Questions recalling earlier activity must have events=[]. For activity recommendations, suggest activity types rather than named venues, museums, attractions or businesses unless the specific place appears in the supplied journey context. Use nearby search to verify real places. Do not claim dietary suitability of venues, routes, museums or gardens. Mention dietary preferences only for food questions. Do not claim ingredients, nutritional equivalence, gluten-free status or allergy suitability are verified.";

/** Travel text only. The caller retains sensitive-input and consent boundaries. */
export async function nvidiaTravelText(
  systemInstruction: unknown,
  contents: unknown,
  schema: unknown,
  maxTokens = 900,
) {
  const response = await fetch(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        model: nvidiaModel(),
        messages: [
          {
            role: "system",
            content: `${systemInstruction}\n${nvidiaTravelRules}`,
          },
          { role: "user", content: contents },
        ],
        temperature: 0,
        stream: false,
        max_tokens: maxTokens,
        reasoning_effort: "none",
        response_format: {
          type: "json_schema",
          json_schema: { name: "travel_reply", schema },
        },
      }),
    },
  );
  if (!response.ok) throw new Error("NVIDIA request failed");
  const result = await response.json();
  const choice = result.choices?.[0];
  if (
    choice?.finish_reason === "length" ||
    typeof choice?.message?.content !== "string"
  )
    throw new Error("NVIDIA returned an incomplete response");
  // A malformed result must trigger fallback before it reaches the caller.
  const parsed = extractionSchema.parse(JSON.parse(choice.message.content));
  const message = JSON.parse(String(contents)).message;
  if (
    typeof message === "string" &&
    /^\s*(?:(?:what|which|when|where|how|why|can|could|would|suggest|recommend)\b|i (?:plan|am planning)\b)/i.test(
      message,
    )
  )
    parsed.events = [];
  return { text: JSON.stringify(parsed) };
}
