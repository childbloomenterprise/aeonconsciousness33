import { describe, expect, it } from "vitest";
import {
  screenSafety,
  isHealthText,
  isSensitiveText,
  inKerala,
} from "../shared/safety";
import {
  eventDraft,
  chatInput,
  journeyInput,
  extractionSchema,
  responseSchema,
} from "../shared/contracts";
import { resolveReportedTime } from "../shared/time";
import { retrieveSources } from "../shared/knowledge";
it("compares journey times chronologically across timezone offsets", () => {
  const base = { title: "Trip", destination_name: "Munnar" };
  expect(
    journeyInput.safeParse({
      ...base,
      started_at: "2026-10-16T10:00:00+05:30",
      ended_at: "2026-10-16T06:00:00Z",
    }).success,
  ).toBe(true);
  expect(
    journeyInput.safeParse({
      ...base,
      started_at: "2026-10-16T06:00:00Z",
      ended_at: "2026-10-16T10:00:00+05:30",
    }).success,
  ).toBe(false);
});

describe("independent warning rules", () => {
  it.each([
    "I cannot breathe",
    "My throat is swollen",
    "I vomited blood",
    "I have severe chest pain",
    "I am not well and I cannot breathe",
  ])("escalates %s", (text) =>
    expect(screenSafety(text).urgency).toBe("emergency"),
  );
  it.each([
    "I have no trouble breathing",
    "I do not have severe chest pain",
    "I fainted last year",
    "What if someone cannot breathe?",
    "I used to have severe chest pain",
  ])("does not escalate negated/historical/question: %s", (text) =>
    expect(screenSafety(text).urgency).toBe("none"),
  );
  it("keeps a current warning after a historical clause", () =>
    expect(
      screenSafety("I fainted last year, but I cannot breathe now.").urgency,
    ).toBe("emergency"));
  it("handles typographic apostrophes", () =>
    expect(screenSafety("I can’t breathe.").urgency).toBe("emergency"));
  it.each([
    "I have bloody stool",
    "I cannot keep water down",
    "I have severe stomach pain",
  ])("prompts professional care: %s", (text) =>
    expect(screenSafety(text).urgency).toBe("seek_care"),
  );
  it("routes food safety to curated information", () =>
    expect(isHealthText("Is this food safe for me?")).toBe(true));
  it("recognizes meal and medication reports as private", () => {
    expect(isSensitiveText("I ate dosa.")).toBe(true);
    expect(isSensitiveText("I took a tablet.")).toBe(true);
  });
  it("does not infer Kerala from every Indian destination", () => {
    expect(inKerala("Munnar, Kerala")).toBe(true);
    expect(inKerala("Delhi")).toBe(false);
  });
});
describe("validated records and time", () => {
  it("rejects invented event categories and extra fields", () => {
    expect(
      eventDraft.safeParse({ event_type: "diagnosis", title: "X" }).success,
    ).toBe(false);
    expect(
      eventDraft.safeParse({
        event_type: "meal",
        title: "Dosa",
        untrusted_url: "https://evil.test",
      }).success,
    ).toBe(false);
  });
  it("rejects invalid timezone, hydration and confidence", () => {
    for (const extra of [
      { timezone: "Mars/Orbit" },
      { metadata_json: { amount_ml: 99999 } },
      { confidence: 2 },
    ])
      expect(
        eventDraft.safeParse({ event_type: "meal", title: "Dosa", ...extra })
          .success,
      ).toBe(false);
  });
  it("requires a stable UUID and bounded chat text", () =>
    expect(
      chatInput.safeParse({ text: "x".repeat(4001), request_id: "guess" })
        .success,
    ).toBe(false));
  it("rejects backwards journey dates", () =>
    expect(
      journeyInput.safeParse({
        title: "Trip",
        destination_name: "Munnar",
        started_at: "2026-10-11T00:00:00Z",
        ended_at: "2026-10-10T00:00:00Z",
      }).success,
    ).toBe(false));
  it("allowlists model actions", () =>
    expect(
      extractionSchema.safeParse({
        reply: "hi",
        intent: "travel",
        events: [],
        actions: [{ type: "execute_url", label: "click" }],
      }).success,
    ).toBe(false));
  it("preserves uncertainty for clock times", () =>
    expect(
      resolveReportedTime(
        "around one yesterday",
        new Date("2026-10-11T12:00:00Z"),
      ),
    ).toEqual({ occurred_at: null, approximate: true }));
  it("resolves explicit durations without a model timestamp", () =>
    expect(
      resolveReportedTime("two hours ago", new Date("2026-10-11T12:00:00Z"))
        .occurred_at,
    ).toBe("2026-10-11T10:00:00.000Z"));
  it("does not resolve an unbounded duration", () =>
    expect(
      resolveReportedTime("9999 days ago", new Date()).occurred_at,
    ).toBeNull());
  it("retrieves real references and declines unsupported topics", () => {
    expect(retrieveSources("allergy")[0].url).toBe(
      "https://www.nhs.uk/conditions/food-allergy/",
    );
    expect(retrieveSources("headache")).toEqual([]);
  });
  it("rejects untrusted directions and incomplete chat responses", () => {
    expect(
      responseSchema("nearby", "GET")!.safeParse([
        {
          id: "x",
          name: "X",
          address: "Y",
          lat: 10,
          lng: 76,
          maps_url: "https://evil.test/",
        },
      ]).success,
    ).toBe(false);
    expect(
      responseSchema("chat", "POST")!.safeParse({ reply: "Saved!" }).success,
    ).toBe(false);
  });
});
