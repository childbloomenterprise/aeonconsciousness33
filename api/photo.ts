import { photoInput } from "../shared/contracts.js";
import { handler, body, consent, quota, ApiError } from "../server/http.js";
import { allowSensitiveAI, describePhoto } from "../server/ai.js";
export default handler(["POST"], async (ctx) => {
  const input = photoInput.parse(body(ctx.req));
  if (!(await consent(ctx.db, ctx.user.id, "external_ai")))
    throw new ApiError(
      403,
      "AI_CONSENT_REQUIRED",
      "Enable external AI processing before describing a photo.",
    );
  allowSensitiveAI();
  await quota(ctx, "ai");
  return describePhoto(input.image, input.mime);
});
