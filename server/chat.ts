import { z } from "zod";
import {
  chatInput,
  eventDraft,
  type ChatResult,
  type EventDraft,
} from "../shared/contracts.js";
import {
  isHealthText,
  isCareSearch,
  isSensitiveText,
  screenSafety,
} from "../shared/safety.js";
import { sourceReply as sourceInformation } from "../shared/health.js";
import { resolveReportedTime } from "../shared/time.js";
import {
  extractAndReply,
  extractReportedEvents,
  allowSensitiveAI,
} from "./ai.js";
import {
  consent,
  ownership,
  quota,
  dbCheck,
  body,
  ApiError,
  type Context,
} from "./http.js";

export function sourceReply(text: string): ChatResult {
  return sourceInformation(text, true);
}
export function confirmedSymptom(text: string, zone: string): EventDraft[] {
  text = text.replace(/[‘’]/g, "'");
  if (
    !/\b(?:i am|i'm|i feel|i have|my (?:stomach|belly|head)|i can't|i cannot)\b/i.test(
      text,
    )
  )
    return [];
  if (
    /\b(?:no|not|never|what if|yesterday|last year|last month|used to)\b/i.test(
      text,
    )
  )
    return [];
  return [
    eventDraft.parse({
      event_type: "symptom",
      title: text.slice(0, 150),
      description: text,
      timezone: zone,
      confidence: 1,
    }),
  ];
}
export async function processChat(ctx: Context) {
  const input = chatInput.parse(body(ctx.req));
  const emergency = screenSafety(input.text);
  const health =
    isHealthText(input.text) ||
    isCareSearch(input.text) ||
    emergency.urgency !== "none";
  // Emergency guidance is returned even if all storage / provider operations fail.
  const urgent = emergency.urgency !== "none" ? sourceReply(input.text) : null;
  try {
    return await processWithStorage(ctx, input, health);
  } catch (error) {
    if (urgent)
      return {
        ...urgent,
        persistence_error:
          "Urgent information is available, but this message could not be saved.",
      };
    throw error;
  }
}
async function processWithStorage(
  ctx: Context,
  input: z.infer<typeof chatInput>,
  health: boolean,
): Promise<ChatResult> {
  if (input.journey_id)
    await ownership(ctx.db, "journeys", input.journey_id, ctx.user.id);
  if (input.conversation_id) {
    await ownership(
      ctx.db,
      "conversations",
      input.conversation_id,
      ctx.user.id,
    );
    const { data: conversation, error } = await ctx.db
      .from("conversations")
      .select("journey_id")
      .eq("id", input.conversation_id)
      .eq("user_id", ctx.user.id)
      .single();
    dbCheck(error);
    if ((conversation?.journey_id ?? null) !== (input.journey_id ?? null))
      throw new ApiError(
        400,
        "JOURNEY_MISMATCH",
        "Open this conversation from its own journey.",
      );
  }
  const { data: old, error: oldError } = await ctx.db
    .from("request_records")
    .select("result")
    .eq("user_id", ctx.user.id)
    .eq("request_id", input.request_id)
    .maybeSingle();
  dbCheck(oldError);
  if (old?.result) return old.result as ChatResult;
  const sensitive = isSensitiveText(input.text);
  const storage = await consent(ctx.db, ctx.user.id, "sensitive_storage");
  let result: ChatResult;
  let drafts: EventDraft[] = [];
  if (health) {
    result = sourceReply(input.text);
    if (storage) drafts = confirmedSymptom(input.text, input.timezone);
    if (
      storage &&
      screenSafety(input.text).urgency === "none" &&
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_SENSITIVE_PROCESSING_ENABLED === "true" &&
      (await consent(ctx.db, ctx.user.id, "external_ai"))
    ) {
      try {
        await quota(ctx, "ai");
        drafts = await extractReportedEvents(input.text, input.timezone);
      } catch {
        result.reply +=
          "\n\nAutomatic entry extraction is unavailable. You can add a moment manually.";
      }
    }
  } else {
    const external = await consent(ctx.db, ctx.user.id, "external_ai");
    if (!external)
      throw new ApiError(
        403,
        "AI_CONSENT_REQUIRED",
        "Enable external AI processing in your privacy settings, or add an entry manually.",
      );
    if (sensitive) allowSensitiveAI();
    await quota(ctx, "ai");
    let destination: string | null = null;
    let journey: {
      title: string;
      started_at: string;
      ended_at: string | null;
    } | null = null;
    let recent: unknown[] = [];
    if (input.journey_id) {
      const { data, error } = await ctx.db
        .from("journeys")
        .select("title,destination_name,started_at,ended_at")
        .eq("id", input.journey_id)
        .eq("user_id", ctx.user.id)
        .single();
      dbCheck(error);
      destination = data?.destination_name || null;
      journey = data
        ? {
            title: data.title,
            started_at: data.started_at,
            ended_at: data.ended_at,
          }
        : null;
      // Only non-sensitive event types travel to the external AI as journey context.
      const { data: events, error: eventsError } = await ctx.db
        .from("journey_events")
        .select("event_type,title,description,time_text,occurred_at")
        .eq("user_id", ctx.user.id)
        .eq("journey_id", input.journey_id)
        .in("event_type", ["meal", "activity", "hydration", "note"])
        .order("occurred_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(12);
      dbCheck(eventsError);
      recent = (events || []).filter(
        (e) =>
          !isSensitiveText([e.title, e.description].filter(Boolean).join(" ")),
      );
    }
    let messages: unknown[] = [];
    if (input.conversation_id) {
      const { data, error } = await ctx.db
        .from("messages")
        .select("role,content")
        .eq("conversation_id", input.conversation_id)
        .eq("user_id", ctx.user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      dbCheck(error);
      // Never transmit stored health conversations as travel context.
      messages = (data || [])
        .filter((x) => !isSensitiveText(x.content))
        .reverse();
    }
    const preferencesQuery = await ctx.db
      .from("profiles")
      .select("dietary_preference,interests")
      .eq("id", ctx.user.id)
      .maybeSingle();
    dbCheck(preferencesQuery.error);
    const ai = await extractAndReply(input.text, {
      destination,
      journey,
      timezone: input.timezone,
      now: new Date().toISOString(),
      recent,
      messages,
      preferences: {
        dietary_preference: preferencesQuery.data?.dietary_preference || null,
        interests: Array.isArray(preferencesQuery.data?.interests)
          ? preferencesQuery.data.interests
          : [],
      },
    });
    result =
      ai.intent === "health" ||
      isHealthText([ai.reply, ...Object.values(ai.guidance || {})].join(" "))
        ? sourceReply(input.text)
        : {
            reply: ai.reply,
            guidance: ai.guidance,
            intent: ai.intent,
            conversation_id: null,
            events: [],
            medical_context: {
              contains_health_guidance: false,
              urgency: "none",
              source_ids: [],
            },
            actions: ai.actions,
          };
    drafts = storage ? ai.events : [];
  }
  drafts = drafts.map((event) => {
    const resolved = resolveReportedTime(event.time_text, new Date());
    return {
      ...event,
      occurred_at: resolved.occurred_at,
      metadata_json: {
        ...event.metadata_json,
        approximate: resolved.approximate,
      },
    };
  });
  if (health && storage && input.journey_id) {
    const cutoff = new Date(Date.now() - 72 * 3600000).toISOString();
    const recentQuery = ctx.db
      .from("journey_events")
      .select("*")
      .eq("user_id", ctx.user.id);
    if (input.journey_id) recentQuery.eq("journey_id", input.journey_id);
    const { data, error } = await recentQuery
      .or(
        `occurred_at.gte.${cutoff},and(occurred_at.is.null,created_at.gte.${cutoff})`,
      )
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .limit(30);
    dbCheck(error);
    result.recent_events = data || [];
    if (
      /\b(?:before|previous|last time|earlier|history|again)\b/i.test(
        input.text,
      )
    ) {
      const historyQuery = ctx.db
        .from("journey_events")
        .select("*")
        .eq("user_id", ctx.user.id);
      if (input.journey_id) historyQuery.eq("journey_id", input.journey_id);
      const history = await historyQuery
        .eq("event_type", "symptom")
        .or(
          `occurred_at.lt.${cutoff},and(occurred_at.is.null,created_at.lt.${cutoff})`,
        )
        .order("created_at", { ascending: false })
        .limit(10);
      dbCheck(history.error);
      result.historical_events = history.data || [];
    }
  }
  const pending = drafts;
  const save: EventDraft[] = [];
  result.events = pending.map((event) => ({ status: "pending", event }));
  if (drafts.length && !input.journey_id)
    result.actions.push({
      type: "start_journey",
      label: "Start a journey to save entries",
    });
  // No sensitive turn is persisted without storage consent.
  if (!storage)
    return {
      ...result,
      reply: `${result.reply}\n\nThis message was not saved because private storage is disabled.`,
    };
  const { data, error } = await ctx.db.rpc("persist_chat_turn", {
    p_request_id: input.request_id,
    p_conversation_id: input.conversation_id,
    p_journey_id: input.journey_id,
    p_text: input.text,
    p_result: result,
    p_events: save,
  });
  dbCheck(error);
  if (!data)
    throw new ApiError(
      503,
      "STORAGE_FAILED",
      "That message could not be saved. Please retry.",
    );
  return data as ChatResult;
}
