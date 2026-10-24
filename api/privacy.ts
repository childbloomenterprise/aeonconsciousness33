import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  handler,
  body,
  dbCheck,
  configuration,
  ApiError,
} from "../server/http.js";
export default handler(["POST", "DELETE"], async (ctx) => {
  if (ctx.req.method === "DELETE") {
    const value = z
      .object({ confirm: z.literal("DELETE MY ACCOUNT") })
      .strict()
      .parse(body(ctx.req));
    if (!value.confirm)
      throw new ApiError(400, "CONFIRM_REQUIRED", "Confirm account deletion.");
    if (!process.env.SUPABASE_SECRET_KEY)
      throw new ApiError(
        503,
        "DELETE_UNAVAILABLE",
        "Account deletion is awaiting administrator setup. Please contact the pilot administrator.",
      );
    const { url } = configuration();
    const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false },
    });
    const { error } = await admin.auth.admin.deleteUser(ctx.user.id);
    dbCheck(error);
    return { success: true };
  }
  const input = z
    .object({
      consent_type: z.enum(["sensitive_storage", "external_ai"]),
      granted: z.boolean(),
    })
    .strict()
    .parse(body(ctx.req));
  const { data, error } = await ctx.db.rpc("set_consent", {
    p_type: input.consent_type,
    p_granted: input.granted,
  });
  dbCheck(error);
  return data;
});
