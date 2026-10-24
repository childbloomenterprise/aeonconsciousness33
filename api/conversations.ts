import { z } from "zod";
import { uuid } from "../shared/contracts.js";
import {
  handler,
  query,
  dbCheck,
  ownership,
  ApiError,
} from "../server/http.js";
export default handler(["GET", "DELETE"], async (ctx) => {
  const id = query(ctx.req, "id");
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .max(1000000)
    .parse(query(ctx.req, "offset") || 0);
  if (!id) {
    if (ctx.req.method === "DELETE")
      throw new ApiError(
        400,
        "ID_REQUIRED",
        "Choose a conversation to delete.",
      );
    const journeyId = query(ctx.req, "journey_id");
    const listing = ctx.db
      .from("conversations")
      .select("*")
      .eq("user_id", ctx.user.id);
    if (journeyId) {
      uuid.parse(journeyId);
      await ownership(ctx.db, "journeys", journeyId, ctx.user.id);
      listing.eq("journey_id", journeyId);
    }
    const { data, error } = await listing
      .order("updated_at", { ascending: false })
      .range(offset, offset + 29);
    dbCheck(error);
    return data;
  }
  const validId = uuid.parse(id);
  await ownership(ctx.db, "conversations", validId, ctx.user.id);
  if (ctx.req.method === "DELETE") {
    const { error } = await ctx.db
      .from("conversations")
      .delete()
      .eq("id", validId)
      .eq("user_id", ctx.user.id);
    dbCheck(error);
    return { success: true };
  }
  const { data, error } = await ctx.db
    .from("messages")
    .select("*")
    .eq("conversation_id", validId)
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: true })
    .range(offset, offset + 99);
  dbCheck(error);
  return data;
});
