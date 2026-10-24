import type { VercelRequest, VercelResponse } from "./types.js";
import { ZodError } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export type Context = {
  user: { id: string; email?: string };
  db: SupabaseClient;
  req: VercelRequest;
};
export function configuration() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let validURL = false;
  try {
    validURL = !!url && ["https:", "http:"].includes(new URL(url).protocol);
  } catch {
    /* Invalid deployment configuration. */
  }
  if (!validURL || !url || !key)
    throw new ApiError(
      503,
      "SETUP_REQUIRED",
      "Account services are not connected yet. Please try again after setup.",
    );
  return { url, key };
}
export async function authenticate(req: VercelRequest): Promise<Context> {
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization || "")?.[1];
  if (!token)
    throw new ApiError(401, "SIGN_IN_REQUIRED", "Sign in to continue.");
  const { url, key } = configuration();
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "Your session expired. Please sign in again.",
    );
  return { user: data.user, db, req };
}
export function dbCheck(error: { message?: string } | null) {
  if (error)
    throw new ApiError(
      503,
      "STORAGE_FAILED",
      "Could not save or retrieve your information. Please retry.",
    );
}
export function body(req: VercelRequest) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new ApiError(400, "INVALID_JSON", "The request could not be read.");
    }
  }
  return req.body;
}
export function query(req: VercelRequest, name: string) {
  const value = req.query[name];
  return typeof value === "string" ? value : undefined;
}
export function handler(
  methods: string[],
  fn: (context: Context) => Promise<unknown>,
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!methods.includes(req.method || "")) {
      res.setHeader("Allow", methods.join(", "));
      return res.status(405).json({
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "This action is unavailable.",
        },
      });
    }
    try {
      const origin = req.headers.origin;
      const host = req.headers.host;
      let sameHost = false;
      if (origin) {
        try {
          const parsed = new URL(origin);
          sameHost =
            ["http:", "https:"].includes(parsed.protocol) &&
            typeof host === "string" &&
            parsed.host === host;
        } catch {
          throw new ApiError(
            403,
            "ORIGIN_REJECTED",
            "This request came from an unsupported origin.",
          );
        }
      }
      const configuredOrigin = process.env.APP_BASE_URL
        ? new URL(process.env.APP_BASE_URL).origin
        : null;
      if (
        origin &&
        !(configuredOrigin ? origin === configuredOrigin : sameHost)
      ) {
        throw new ApiError(
          403,
          "ORIGIN_REJECTED",
          "This request came from an unsupported origin.",
        );
      }
      const context = await authenticate(req);
      const result = await fn(context);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof ZodError)
        return res.status(400).json({
          error: {
            code: "INVALID_INPUT",
            message: error.issues[0]?.message || "Check your input.",
          },
        });
      if (error instanceof ApiError)
        return res
          .status(error.status)
          .json({ error: { code: error.code, message: error.message } });
      // Intentionally exclude exception messages and request contents.
      console.error(
        JSON.stringify({
          event: "api_failure",
          route: req.url?.split("?")[0],
          name: error instanceof Error ? error.name : "Unknown",
        }),
      );
      return res.status(500).json({
        error: {
          code: "UNEXPECTED_ERROR",
          message: "Something went wrong. Please retry.",
        },
      });
    }
  };
}
export async function ownership(
  db: SupabaseClient,
  table: "journeys" | "conversations" | "journey_events",
  id: string,
  userId: string,
) {
  const { data, error } = await db
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  dbCheck(error);
  if (!data)
    throw new ApiError(404, "NOT_FOUND", "This record is not available.");
}
export async function consent(
  db: SupabaseClient,
  userId: string,
  type: "sensitive_storage" | "external_ai",
) {
  const { data, error } = await db
    .from("consent_records")
    .select("id")
    .eq("user_id", userId)
    .eq("consent_type", type)
    .is("revoked_at", null)
    .limit(1);
  dbCheck(error);
  return !!data?.length;
}
export async function quota(ctx: Context, kind: "ai" | "audio" | "places") {
  const defaults = { ai: 30, audio: 10, places: 20 };
  const variable = {
    ai: "AI_DAILY_LIMIT",
    audio: "AUDIO_DAILY_LIMIT",
    places: "PLACES_DAILY_LIMIT",
  };
  const parsed = Number(process.env[variable[kind]] || defaults[kind]);
  const limit = Number.isFinite(parsed)
    ? Math.min(1000, Math.max(1, Math.floor(parsed)))
    : defaults[kind];
  const { data, error } = await ctx.db.rpc("consume_usage", {
    p_kind: kind,
    p_daily_limit: limit,
  });
  dbCheck(error);
  if (!data)
    throw new ApiError(
      429,
      "USAGE_LIMIT",
      "Your usage limit has been reached. Please try again later. Emergency information remains available.",
    );
}
