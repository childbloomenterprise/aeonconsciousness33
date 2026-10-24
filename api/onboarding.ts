import { signupInput } from "../shared/contracts.js";
import { handler, body, dbCheck } from "../server/http.js";
/**
 * Persists the self-serve signup questionnaire. The RPC writes account facts
 * unconditionally and only stores allergies or an emergency contact when the
 * caller also granted private-storage consent, so this route never has to
 * decide the consent question itself.
 */
export default handler(["POST"], async (ctx) => {
  const input = signupInput.parse(body(ctx.req));
  const { data, error } = await ctx.db.rpc("save_signup_profile", {
    p_profile: input,
  });
  dbCheck(error);
  return data;
});
