import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: generate };
  },
}));
import { extractAndReply } from "../server/ai";
import { nvidiaTravelText } from "../server/nvidia";
const context = {
  destination: "Dubai",
  journey: null,
  timezone: "Asia/Dubai",
  now: "2026-10-21T09:00:00Z",
  recent: [],
  messages: [],
};
const valid = {
  reply: "Try a vegetable wrap.",
  intent: "travel",
  events: [],
  actions: [],
};
beforeEach(() => {
  vi.stubEnv("NVIDIA_API_KEY", "test-nvidia-secret");
  vi.stubEnv("GEMINI_API_KEY", "test-gemini-secret");
  vi.stubEnv("OPENROUTER_API_KEY", "");
  generate.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("does not recreate historical events when the user only asks for recall", async () => {
  const event = {
    event_type: "activity",
    title: "Walk along Dubai Creek",
    description: "Walked for 30 minutes.",
    occurred_at: null,
    time_text: "earlier",
    timezone: "Asia/Dubai",
    location_name: null,
    confidence: 1,
    metadata_json: {},
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify({ ...valid, events: [event] }),
              },
            },
          ],
        }),
      ),
    ),
  );
  const result = await nvidiaTravelText(
    "Travel assistant",
    JSON.stringify({
      message: "What activity did I report earlier?",
      context: { recent: [event] },
    }),
    {},
  );
  expect(JSON.parse(result.text).events).toEqual([]);
});
it("uses NVIDIA first for travel with a constrained JSON schema", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(valid) },
          },
        ],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(
    await extractAndReply("Suggest a vegetarian breakfast", context),
  ).toMatchObject(valid);
  expect(generate).not.toHaveBeenCalled();
  expect(fetcher.mock.calls[0][0]).toBe(
    "https://integrate.api.nvidia.com/v1/chat/completions",
  );
  const payload = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.response_format.type).toBe("json_schema");
  expect(payload.stream).toBe(false);
  expect(payload.reasoning_effort).toBe("none");
});
it.each([429, 503])(
  "falls back to Gemini after NVIDIA HTTP %s",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status })),
    );
    generate.mockResolvedValue({ text: JSON.stringify(valid) });
    expect(await extractAndReply("Suggest a walk", context)).toMatchObject(
      valid,
    );
    expect(generate).toHaveBeenCalledTimes(1);
  },
);
it.each(["{}", "not JSON"])(
  "falls back after unusable NVIDIA output %s",
  async (content) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content }, finish_reason: "stop" }],
          }),
        ),
      ),
    );
    generate.mockResolvedValue({ text: JSON.stringify(valid) });
    expect(await extractAndReply("Suggest a walk", context)).toMatchObject(
      valid,
    );
    expect(generate).toHaveBeenCalledTimes(1);
  },
);
it("does not send private diary input to the travel-only NVIDIA adapter", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  generate.mockResolvedValue({
    text: JSON.stringify({ ...valid, intent: "logging" }),
  });
  await extractAndReply("I ate rice for lunch today", context);
  expect(fetcher).not.toHaveBeenCalled();
  expect(generate).toHaveBeenCalledTimes(1);
});
it("falls back after a truncated NVIDIA completion", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: JSON.stringify(valid) },
              finish_reason: "length",
            },
          ],
        }),
      ),
    ),
  );
  generate.mockResolvedValue({ text: JSON.stringify(valid) });
  await extractAndReply("Suggest a walk", context);
  expect(generate).toHaveBeenCalledTimes(1);
});
it("falls back after a NVIDIA timeout", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValue(new DOMException("Request timed out", "TimeoutError")),
  );
  generate.mockResolvedValue({ text: JSON.stringify(valid) });
  expect(await extractAndReply("Suggest a walk", context)).toMatchObject(valid);
  expect(generate).toHaveBeenCalledTimes(1);
});
