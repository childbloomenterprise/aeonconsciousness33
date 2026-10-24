// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CuisineExplorer } from "../src/components/CuisineExplorer";
import {
  destinationMenus,
  mealsForDestination,
} from "../shared/destinationCuisine";
afterEach(cleanup);
it("has 25 distinct dishes per supported city and no false Kerala fallback", () => {
  for (const [city, rows] of Object.entries(destinationMenus)) {
    expect(rows).toHaveLength(25);
    expect(new Set(rows.map((d) => d.label)).size).toBe(25);
    expect(mealsForDestination(city + ", India")).toEqual(rows);
  }
  expect(mealsForDestination("Tokyo")).toEqual([]);
});
it("follows destination switches and resets stale dish/map context", () => {
  const { rerender } = render(<CuisineExplorer destination="Mumbai" />);
  expect(screen.getByText("Pav bhaji")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Find Pav bhaji on map" }),
  );
  expect(
    screen.getByTitle("Google Maps restaurant search").getAttribute("src"),
  ).toContain(encodeURIComponent("Pav bhaji restaurants Mumbai"));
  rerender(<CuisineExplorer destination="Delhi" />);
  expect(screen.getByText("Chole bhature")).toBeTruthy();
  expect(screen.queryByText("Pav bhaji")).toBeNull();
  expect(
    screen.getByTitle("Google Maps restaurant search").getAttribute("src"),
  ).toContain(encodeURIComponent("Delhi restaurants Delhi"));
});
