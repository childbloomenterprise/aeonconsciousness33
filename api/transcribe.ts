import { z } from "zod";
import { handler, body, consent, quota, ApiError } from "../server/http.js";
import { transcribe, allowVoiceAI } from "../server/ai.js";
const input = z
  .object({ data: z.string().max(4200000), mime: z.string().max(100) })
  .strict();
export default handler(["POST"], async (ctx) => {
  const value = input.parse(body(ctx.req));
  if (!(await consent(ctx.db, ctx.user.id, "external_ai")))
    throw new ApiError(
      403,
      "AI_CONSENT_REQUIRED",
      "Enable external AI processing before recording. Text and emergency access remain available.",
    );
  allowVoiceAI();
  await quota(ctx, "audio");
  // `text` is always English, whichever language was spoken.
  const result = await transcribe(value.data, value.mime);
  return {
    text: result.text,
    original: result.original,
    language: result.language,
  };
});
