import { describe, expect, it } from "vitest";
import { responseSchema, signupInput } from "../shared/contracts";
const answers = {
  display_name: "Alex",
  date_of_birth: "1996-04-02",
  sex: "female" as const,
  allergies: ["peanuts"],
  dietary_preference: "vegetarian" as const,
  interests: ["trekking", "street food"],
  emergency_contact: null,
  adult: true as const,
  storage_consent: true,
  ai_consent: true,
};
describe("signup questionnaire contract", () => {
  it("rejects an underage birth date even with an adult declaration", () => {
    expect(
      signupInput.safeParse({
        ...answers,
        date_of_birth: new Date().toISOString().slice(0, 10),
      }).success,
    ).toBe(false);
    expect(
      signupInput.safeParse({ ...answers, allergies: ["none", "peanuts"] })
        .success,
    ).toBe(false);
  });
  it("accepts a complete answer set", () => {
    const parsed = signupInput.parse(answers);
    expect(parsed.interests).toEqual(["trekking", "street food"]);
    expect(parsed.allergies).toEqual(["peanuts"]);
  });
  it("requires an affirmed adult declaration", () => {
    expect(signupInput.safeParse({ ...answers, adult: false }).success).toBe(
      false,
    );
  });
  it("requires at least one interest", () => {
    expect(signupInput.safeParse({ ...answers, interests: [] }).success).toBe(
      false,
    );
  });
  it("refuses an emergency contact without private storage", () => {
    expect(
      signupInput.safeParse({
        ...answers,
        storage_consent: false,
        emergency_contact: { name: "Sam", phone: "+919876543210" },
      }).success,
    ).toBe(false);
  });
  it("rejects invented interests, bad dates and unknown fields", () => {
    expect(
      signupInput.safeParse({ ...answers, interests: ["skydiving"] }).success,
    ).toBe(false);
    expect(
      signupInput.safeParse({ ...answers, date_of_birth: "02/04/1996" })
        .success,
    ).toBe(false);
    expect(signupInput.safeParse({ ...answers, admin: true }).success).toBe(
      false,
    );
  });
  it("validates the onboarding response shape", () => {
    const schema = responseSchema("onboarding", "POST");
    expect(schema).not.toBeNull();
    expect(
      schema!.safeParse({
        success: true,
        storage_saved: false,
        age_range: "30–44",
      }).success,
    ).toBe(true);
    expect(schema!.safeParse({ success: true }).success).toBe(false);
  });
});
