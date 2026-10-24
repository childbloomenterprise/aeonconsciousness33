import { z } from "zod";
import { eventDraft, uuid } from "../shared/contracts.js";
import {
  handler,
  body,
  query,
  dbCheck,
  ownership,
  consent,
  ApiError,
} from "../server/http.js";
export default handler(["GET", "POST", "PATCH", "DELETE"], async (ctx) => {
  if (ctx.req.method === "GET") {
    const journeyId = uuid.parse(query(ctx.req, "journey_id"));
    await ownership(ctx.db, "journeys", journeyId, ctx.user.id);
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(1000000)
      .parse(query(ctx.req, "offset") || 0);
    const { data, error } = await ctx.db
      .from("journey_events")
      .select("*")
      .eq("user_id", ctx.user.id)
      .eq("journey_id", journeyId)
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + 199);
    dbCheck(error);
    return data;
  }
  if (ctx.req.method === "DELETE") {
    const id = uuid.parse(query(ctx.req, "id"));
    await ownership(ctx.db, "journey_events", id, ctx.user.id);
    const { error } = await ctx.db
      .from("journey_events")
      .delete()
      .eq("id", id)
      .eq("user_id", ctx.user.id);
    dbCheck(error);
    const { error: requestError } = await ctx.db
      .from("request_records")
      .delete()
      .eq("user_id", ctx.user.id);
    dbCheck(requestError);
    return { success: true };
  }
  if (!(await consent(ctx.db, ctx.user.id, "sensitive_storage")))
    throw new ApiError(
      403,
      "STORAGE_CONSENT_REQUIRED",
      "Enable private storage before saving journey entries.",
    );
  const input = z
    .object({
      id: uuid.optional(),
      request_id: uuid.optional(),
      journey_id: uuid,
      event: eventDraft,
      expected_updated_at: z.iso.datetime({ offset: true }).optional(),
    })
    .strict()
    .parse(body(ctx.req));
  await ownership(ctx.db, "journeys", input.journey_id, ctx.user.id);
  if (ctx.req.method === "PATCH") {
    const id = uuid.parse(input.id);
    await ownership(ctx.db, "journey_events", id, ctx.user.id);
    let update = ctx.db
      .from("journey_events")
      .update({ ...input.event, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", ctx.user.id)
      .eq("journey_id", input.journey_id);
    if (input.expected_updated_at)
      update = update.eq("updated_at", input.expected_updated_at);
    const { data, error } = await update.select().maybeSingle();
    dbCheck(error);
    if (!data)
      throw new ApiError(
        input.expected_updated_at ? 409 : 404,
        input.expected_updated_at ? "ENTRY_CONFLICT" : "NOT_FOUND",
        input.expected_updated_at
          ? "This entry changed on another device. Review both versions before saving."
          : "This entry is no longer available.",
      );
    return data;
  }
  const requestId = uuid.parse(input.request_id);
  const { data, error } = await ctx.db.rpc("create_manual_event", {
    p_request_id: requestId,
    p_journey_id: input.journey_id,
    p_event: input.event,
  });
  dbCheck(error);
  return data;
});
