import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { extract, gate, facts } = vi.hoisted(() => ({
  extract: vi.fn(),
  gate: vi.fn(),
  facts: vi.fn(),
}));
vi.mock("../server/ai", () => ({
  extractAndReply: extract,
  allowSensitiveAI: gate,
  extractReportedEvents: facts,
}));
import { processChat } from "../server/chat";
import type { Context } from "../server/http";
const user = "11111111-1111-4111-8111-111111111111",
  journey = "22222222-2222-4222-8222-222222222222",
  request = "33333333-3333-4333-8333-333333333333";
function context(
  options: {
    storage?: boolean;
    external?: boolean;
    broken?: boolean;
    cached?: unknown;
    failSave?: boolean;
    owns?: boolean;
    conversationJourney?: string;
  } = {},
) {
  const filters: unknown[][] = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) =>
    name === "consume_usage"
      ? { data: true, error: null }
      : options.failSave
        ? { data: null, error: { message: "PRIVATE DATABASE DETAIL" } }
        : {
            data: {
              ...(args.p_result as object),
              conversation_id: "saved-conversation",
            },
            error: null,
          },
  );
  const db = {
    rpc,
    from: (table: string) => {
      let consentType = "";
      const b: any = {};
      for (const method of [
        "select",
        "eq",
        "is",
        "in",
        "limit",
        "order",
        "or",
        "gte",
        "lt",
      ])
        b[method] = (...args: unknown[]) => {
          filters.push([table, method, ...args]);
          if (method === "eq" && args[0] === "consent_type")
            consentType = String(args[1]);
          return b;
        };
      b.maybeSingle = b.single = () => b;
      b.then = (resolve: (v: unknown) => unknown) => {
        const data =
          table === "request_records"
            ? options.cached
              ? { result: options.cached }
              : null
            : table === "consent_records"
              ? (
                  consentType === "external_ai"
                    ? options.external !== false
                    : options.storage !== false
                )
                ? [{ id: "consent" }]
                : []
              : table === "journeys"
                ? options.owns === false
                  ? null
                  : {
                      id: journey,
                      title: "Kerala trip",
                      destination_name: "Munnar",
                      started_at: "2020-01-01T00:00:00Z",
                      ended_at: null,
                    }
                : table === "conversations"
                  ? {
                      id: "conversation",
                      journey_id: options.conversationJourney || journey,
                    }
                  : [];
        return Promise.resolve({
          data,
          error: options.broken ? { message: "PRIVATE HEALTH CONTENT" } : null,
        }).then(resolve);
      };
      return b;
    },
  };
  const ctx = {
    db,
    user: { id: user },
    req: {
      body: {
        text: "I have nausea",
        request_id: request,
        journey_id: journey,
        timezone: "Asia/Kolkata",
      },
    },
  } as unknown as Context & {
    req: { body: { text: string; journey_id: string | null } };
  };
  return { ctx, rpc, filters };
}
beforeEach(() => {
  facts.mockReset();
  facts.mockResolvedValue([]);
  extract.mockReset();
  gate.mockReset();
  extract.mockResolvedValue({
    reply: "A little moment for your journey.",
    intent: "logging",
    events: [
      {
        event_type: "meal",
        title: "Dosa",
        description: null,
        time_text: "around one",
        occurred_at: "2020-01-01T00:00:00Z",
        timezone: "Asia/Kolkata",
        location_name: null,
        confidence: 1,
        metadata_json: {},
      },
    ],
    actions: [],
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("conversation persistence and safety", () => {
  it("rejects using a conversation from a different journey", async () => {
    const { ctx } = context({
      conversationJourney: "44444444-4444-4444-8444-444444444444",
    });
    ctx.req.body = {
      ...ctx.req.body,
      conversation_id: "55555555-5555-4555-8555-555555555555",
    } as any;
    await expect(processChat(ctx)).rejects.toMatchObject({
      code: "JOURNEY_MISMATCH",
    });
    expect(extract).not.toHaveBeenCalled();
  });
  it("keeps health-history queries inside the selected journey", async () => {
    const { ctx, filters } = context();
    ctx.req.body.text = "My stomach hurts again";
    await processChat(ctx);
    expect(
      filters.filter(
        (f) =>
          f[0] === "journey_events" && f[1] === "eq" && f[2] === "journey_id",
      ),
    ).toHaveLength(2);
  });
  it("mixed health reports extract facts only when configured, while responses stay curated", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only");
    vi.stubEnv("GEMINI_SENSITIVE_PROCESSING_ENABLED", "true");
    const { ctx } = context();
    ctx.req.body.text = "I ate dosa and my stomach hurts";
    facts.mockResolvedValue([
      {
        event_type: "meal",
        title: "Dosa",
        description: null,
        time_text: null,
        occurred_at: null,
        timezone: "Asia/Kolkata",
        location_name: null,
        confidence: 1,
        metadata_json: {},
      },
    ]);
    const result = await processChat(ctx);
    expect(facts).toHaveBeenCalled();
    expect(extract).not.toHaveBeenCalled();
    expect(result.medical_context.source_ids).toContain("foodborne");
  });
  it("health information never calls Gemini", async () => {
    const { ctx } = context();
    const result = await processChat(ctx);
    expect(result.medical_context.contains_health_guidance).toBe(true);
    expect(extract).not.toHaveBeenCalled();
    expect(result.medical_context.source_ids).toContain("foodborne");
  });
  it("returns emergency information despite broken storage", async () => {
    const { ctx } = context({ broken: true });
    ctx.req.body.text = "I cannot breathe";
    const result = await processChat(ctx);
    expect(result.medical_context.urgency).toBe("emergency");
    expect(result.persistence_error).toContain("could not be saved");
    expect(result.events).toEqual([]);
    expect(extract).not.toHaveBeenCalled();
  });
  it("does not call persistence when private storage is denied", async () => {
    const { ctx, rpc } = context({ storage: false });
    const result = await processChat(ctx);
    expect(result.reply).toContain("not saved");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("blocks external processing after consent denial", async () => {
    const { ctx } = context({ external: false });
    ctx.req.body.text = "What can I explore?";
    await expect(processChat(ctx)).rejects.toMatchObject({ status: 403 });
    expect(extract).not.toHaveBeenCalled();
  });
  it("returns cached result without another model call", async () => {
    const cached = { reply: "Already saved", events: [] };
    const { ctx } = context({ cached });
    expect(await processChat(ctx)).toEqual(cached);
    expect(extract).not.toHaveBeenCalled();
  });
  it("cannot acknowledge a failed save", async () => {
    const { ctx } = context({ failSave: true });
    ctx.req.body.text = "I ate dosa";
    await expect(processChat(ctx)).rejects.toMatchObject({
      code: "STORAGE_FAILED",
    });
  });
  it("sanitizes an invented exact model timestamp", async () => {
    const { ctx, rpc } = context();
    ctx.req.body.text = "I ate dosa around one";
    await processChat(ctx);
    const persist = rpc.mock.calls.find((x) => x[0] === "persist_chat_turn")!;
    expect(persist[1].p_events).toEqual([]);
    expect((persist[1].p_result as any).events[0].status).toBe("pending");
    expect((persist[1].p_result as any).events[0].event.occurred_at).toBeNull();
    expect((persist[1].p_result as any).events[0].event.time_text).toBe(
      "around one",
    );
  });
  it("requires confirmation if no journey exists", async () => {
    const { ctx, rpc } = context();
    ctx.req.body.text = "I ate dosa";
    ctx.req.body.journey_id = null;
    await processChat(ctx);
    const args = rpc.mock.calls.find((x) => x[0] === "persist_chat_turn")![1];
    expect(args.p_events).toEqual([]);
    expect((args.p_result as any).events[0].status).toBe("pending");
  });
  it("retrieves occurrence-based 72-hour history and user-scoped older symptoms", async () => {
    const { ctx, filters } = context();
    ctx.req.body.text = "I have stomach pain again, did this happen before?";
    await processChat(ctx);
    expect(
      filters.filter((x) => x[0] === "journey_events" && x[1] === "or")[0][2],
    ).toContain("occurred_at.gte.");
    expect(
      filters.filter(
        (x) => x[0] === "journey_events" && x[1] === "eq" && x[2] === "user_id",
      ),
    ).toHaveLength(2);
  });
  it("rejects a foreign journey before external processing", async () => {
    const { ctx } = context({ owns: false });
    ctx.req.body.text = "I ate dosa";
    await expect(processChat(ctx)).rejects.toMatchObject({ status: 404 });
    expect(extract).not.toHaveBeenCalled();
  });
});
