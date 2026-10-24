// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  coreQuestions,
  deeperQuestions,
  isAdult,
} from "../src/onboarding/questions";
import { LoginExperience } from "../src/onboarding/LoginExperience";
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useReducedMotion: () => true,
  motion: {
    div: ({
      children,
      initial,
      animate,
      exit,
      transition,
      onAnimationComplete,
      ...props
    }: any) => <div {...props}>{children}</div>,
    i: () => <i />,
  },
}));
afterEach(cleanup);
it("connects the live login entry to authentication instead of the preview questionnaire", () => {
  const authenticate = vi.fn();
  render(<LoginExperience onSignIn={authenticate} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Explore your personal setup" }),
  );
  expect(authenticate).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
  expect(authenticate).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/Preview only/)).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Let's get acquainted" }),
  ).toBeNull();
});
function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}
function essentials() {
  click("Explore your personal setup");
  click("Let’s get acquainted");
  fireEvent.change(screen.getByLabelText("Your first name"), {
    target: { value: "Alex" },
  });
  click("Continue");
  fireEvent.change(screen.getByLabelText("Date of birth"), {
    target: { value: "2000-05-12" },
  });
  click("Continue");
  for (const answer of [
    "Feel better on a trip",
    "Travelling right now",
    "Vegan",
    "Yes, I have food allergies",
    "Slow & unhurried",
    "Keep it short & practical",
  ]) {
    click(new RegExp(answer));
    click("Continue");
  }
  click("Finish the essentials");
}
it("offers at least 26 optional questions and gates relevant branches by reported answers", () => {
  const baseline = deeperQuestions({ journey: "No trip planned" });
  expect(baseline.length).toBeGreaterThan(25);
  expect(baseline.some((q) => q.id === "allergyDetails")).toBe(false);
  const tailored = deeperQuestions({
    allergies: "Yes, I have food allergies",
    journey: "Travelling right now",
    company: "Family",
    reminders: "Yes, occasionally",
  });
  expect(tailored.map((q) => q.id)).toEqual(
    expect.arrayContaining([
      "destination",
      "allergyDetails",
      "family",
      "checkinTime",
    ]),
  );
  expect(new Set(tailored.map((q) => q.id)).size).toBe(tailored.length);
  expect(
    coreQuestions({ purpose: "Feel better on a trip" })[3].title,
  ).toContain("away from home");
  expect(isAdult("2015-01-01")).toBe(false);
  expect(isAdult("2000-02-31")).toBe(false);
  expect(isAdult("2000-05-12")).toBe(true);
});
it("completes essentials, edits an earlier answer, keeps privacy off, and restarts cleanly", () => {
  render(<LoginExperience />);
  essentials();
  click("I’m ready with the essentials");
  expect(screen.getByText(/Storage: off/)).toBeTruthy();
  click(/First, what should we call you/);
  fireEvent.change(screen.getByLabelText("Your first name"), {
    target: { value: "Sam" },
  });
  click("Update answer");
  expect(screen.getByText("Sam")).toBeTruthy();
  click("This feels like me");
  expect(
    screen.getByRole("heading", { name: /more understood, Sam/ }),
  ).toBeTruthy();
  click("Try a different journey");
  click("Explore your personal setup");
  click("Let’s get acquainted");
  expect(
    (screen.getByLabelText("Your first name") as HTMLInputElement).value,
  ).toBe("");
});
it("lets people skip the deeper profile or stop partway through without losing essentials", () => {
  render(<LoginExperience />);
  essentials();
  click("Let’s make it more personal");
  click("Skip for now");
  expect(
    screen.getByRole("heading", { name: "Who usually comes along?" }),
  ).toBeTruthy();
  click("Family");
  click("Continue");
  click("That’s enough for now — review my answers");
  expect(screen.getByText("Family")).toBeTruthy();
  expect(screen.getByText("Alex")).toBeTruthy();
});
