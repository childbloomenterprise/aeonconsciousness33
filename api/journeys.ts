import { z } from "zod";
import { journeyInput, uuid } from "../shared/contracts.js";
import { handler, body, query, dbCheck, ownership } from "../server/http.js";
export default handler(["GET", "POST", "PATCH", "DELETE"], async (ctx) => {
  const method = ctx.req.method;
  if (method === "GET") {
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(1000000)
      .parse(query(ctx.req, "offset") || 0);
    const { data, error } = await ctx.db
      .from("journeys")
      .select("*")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + 99);
    dbCheck(error);
    return data;
  }
  if (method === "POST") {
    const input = journeyInput.parse(body(ctx.req));
    const { data, error } = await ctx.db.rpc("start_journey", {
      p_title: input.title,
      p_destination: input.destination_name,
      p_started: input.started_at,
      p_ended: input.ended_at,
    });
    dbCheck(error);
    return data;
  }
  const id = uuid.parse(
    method === "DELETE" ? query(ctx.req, "id") : body(ctx.req).id,
  );
  await ownership(ctx.db, "journeys", id, ctx.user.id);
  if (method === "DELETE") {
    const { error } = await ctx.db
      .from("journeys")
      .delete()
      .eq("id", id)
      .eq("user_id", ctx.user.id);
    dbCheck(error);
    return { success: true };
  }
  const value = z
    .object({ id: uuid, status: z.enum(["active", "completed"]) })
    .strict()
    .parse(body(ctx.req));
  const { data, error } = await ctx.db.rpc("set_journey_status", {
    p_id: value.id,
    p_status: value.status,
  });
  dbCheck(error);
  return data;
});
