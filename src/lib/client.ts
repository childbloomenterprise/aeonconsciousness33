import { createClient } from "@supabase/supabase-js";
import { responseSchema } from "../../shared/contracts";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
function accountClient() {
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}
export const supabase = accountClient();
export class ClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
const inflight = new Map<string, Promise<unknown>>();

export async function request<T>(
  route: string,
  method = "GET",
  body?: unknown,
  expectedUserId?: string,
): Promise<T> {
  const { data } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  if (expectedUserId && data.session?.user.id !== expectedUserId)
    throw new ClientError(
      "SESSION_CHANGED",
      "Sign in to sync this account's entries.",
      401,
    );
  // Share concurrent reads only; never retain private responses after completion.
  const key =
    method === "GET"
      ? JSON.stringify([route, data.session?.access_token || "guest"])
      : null;
  if (key && inflight.has(key)) return inflight.get(key) as Promise<T>;
  const execute = async (): Promise<T> => {
    const res = await fetch(`/api/${route}`, {
      method,
      signal: AbortSignal.timeout(
        route.split("?")[0] === "events" || method === "GET" ? 10000 : 45000,
      ),
      headers: {
        "Content-Type": "application/json",
        ...(data.session
          ? { Authorization: `Bearer ${data.session.access_token}` }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let value;
    try {
      value = await res.json();
    } catch {
      throw new ClientError(
        "SERVICE_UNAVAILABLE",
        "Could not reach the service. Please retry.",
        res.status,
      );
    }
    if (!res.ok)
      throw new ClientError(
        value.error?.code || "REQUEST_FAILED",
        value.error?.message || "This action could not be completed.",
        res.status,
      );
    const schema = responseSchema(route, method);
    if (schema) {
      const checked = schema.safeParse(value);
      if (!checked.success)
        throw new ClientError(
          "INVALID_RESPONSE",
          "The service returned incomplete information. Please retry.",
          502,
        );
      return checked.data as T;
    }
    return value as T;
  };
  const pending = execute();
  if (!key) return pending;
  inflight.set(key, pending);
  try {
    return await pending;
  } finally {
    if (inflight.get(key) === pending) inflight.delete(key);
  }
}
