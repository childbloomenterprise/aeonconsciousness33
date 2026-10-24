import { healthInput } from "../shared/contracts.js";
import { handler, body, dbCheck, consent, ApiError } from "../server/http.js";
export default handler(["GET", "PATCH", "DELETE"], async (ctx) => {
  if (ctx.req.method === "DELETE") {
    const { data, error } = await ctx.db.rpc("delete_health_profile");
    dbCheck(error);
    return data;
  }
  if (ctx.req.method === "GET") {
    const [profile, health, contacts, consents] = await Promise.all([
      ctx.db.from("profiles").select("*").eq("id", ctx.user.id).maybeSingle(),
      ctx.db
        .from("health_profiles")
        .select("*")
        .eq("user_id", ctx.user.id)
        .maybeSingle(),
      ctx.db
        .from("emergency_contacts")
        .select("*")
        .eq("user_id", ctx.user.id)
        .limit(1),
      ctx.db
        .from("consent_records")
        .select("consent_type")
        .eq("user_id", ctx.user.id)
        .is("revoked_at", null),
    ]);
    [profile, health, contacts, consents].forEach((x) => dbCheck(x.error));
    return {
      display_name: profile.data?.display_name || "",
      // Questionnaire answers are account facts, so they stay readable even
      // when private-storage consent is declined.
      signup: {
        date_of_birth: profile.data?.date_of_birth ?? null,
        sex: profile.data?.sex ?? null,
        interests: profile.data?.interests ?? [],
        dietary_preference: profile.data?.dietary_preference ?? null,
        onboarded: !!profile.data?.onboarded_at,
      },
      profile: health.data
        ? {
            ...health.data,
            display_name: profile.data?.display_name || "",
            emergency_contact: contacts.data?.[0] || null,
          }
        : null,
      consents: {
        sensitive_storage:
          consents.data?.some((x) => x.consent_type === "sensitive_storage") ||
          false,
        external_ai:
          consents.data?.some((x) => x.consent_type === "external_ai") || false,
      },
    };
  }
  const input = healthInput.parse(body(ctx.req));
  if (!(await consent(ctx.db, ctx.user.id, "sensitive_storage")))
    throw new ApiError(
      403,
      "STORAGE_CONSENT_REQUIRED",
      "Enable private storage before saving a health profile.",
    );
  const { data, error } = await ctx.db.rpc("save_health_profile", {
    p_profile: input,
  });
  dbCheck(error);
  return data;
});
