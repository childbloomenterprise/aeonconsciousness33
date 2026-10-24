// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CuisineExplorer } from "../src/components/CuisineExplorer";
afterEach(cleanup);
it("filters dishes and updates Google Maps for the selected dish and destination", () => {
  render(<CuisineExplorer destination="Munnar, Kerala" />);
  fireEvent.change(screen.getByLabelText("Search dishes"), {
    target: { value: "puttu" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Find Puttu & kadala on map" }),
  );
  expect(
    screen.getByTitle("Google Maps restaurant search").getAttribute("src"),
  ).toContain(encodeURIComponent("Puttu & kadala restaurants Munnar, Kerala"));
  expect(
    screen.getByRole("link", { name: /Open Google Maps/ }).getAttribute("href"),
  ).toContain("api=1");
  fireEvent.change(screen.getByLabelText("Search dishes"), {
    target: { value: "no-such-dish" },
  });
  expect(
    screen.getByText("No dishes match. Try another search or filter."),
  ).toBeTruthy();
});
it("offers Dubai cuisine without replacing Kerala cuisine", () => {
  render(<CuisineExplorer destination="Dubai" />);
  expect(screen.getByText("Machboos")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Cuisine region"), {
    target: { value: "Kerala" },
  });
  expect(screen.getByText("Puttu & kadala")).toBeTruthy();
});
