import { afterEach, describe, expect, it, vi } from "vitest";
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser } }),
}));
import { authenticate, handler } from "../server/http";
import type { VercelRequest, VercelResponse } from "../server/types";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const req = (extra: unknown = {}) =>
  ({
    method: "POST",
    headers: {},
    query: {},
    url: "/api/chat",
    ...(extra as object),
  }) as VercelRequest;
describe("API authorization and sanitized failures", () => {
  it.each([
    ["https://other.example", 403],
    ["null", 403],
    ["https://app.example", 200],
  ])(
    "checks origin %s against the served host without APP_BASE_URL",
    async (origin, expected) => {
      vi.stubEnv("APP_BASE_URL", "");
      vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
      vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-only");
      getUser.mockResolvedValue({
        data: { user: { id: "user" } },
        error: null,
      });
      let status = 0;
      const response = {
        setHeader: vi.fn(),
        status(n: number) {
          status = n;
          return this;
        },
        json: vi.fn(),
      };
      await handler(["POST"], async () => ({ success: true }))(
        req({
          headers: {
            origin,
            host: "app.example",
            authorization: "Bearer good",
          },
        }),
        response as unknown as VercelResponse,
      );
      expect(status).toBe(expected);
    },
  );
  it("rejects unauthenticated requests before reading configuration", async () =>
    await expect(authenticate(req())).rejects.toMatchObject({ status: 401 }));
  it("rejects expired sessions", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-only");
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "expired" },
    });
    await expect(
      authenticate(req({ headers: { authorization: "Bearer expired" } })),
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });
  it("does not expose secrets in operational errors", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-only");
    getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let code = 0;
    let payload: any;
    const res = {
      setHeader: vi.fn(),
      status: (n: number) => {
        code = n;
        return res;
      },
      json: (v: unknown) => {
        payload = v;
        return res;
      },
    } as unknown as VercelResponse;
    await handler(["POST"], async () => {
      throw new Error("PRIVATE medical record + secret");
    })(req({ headers: { authorization: "Bearer good" } }), res);
    expect(code).toBe(500);
    expect(JSON.stringify(payload)).not.toContain("PRIVATE");
    expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});
