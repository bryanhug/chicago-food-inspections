import { describe, expect, test } from "vitest";
import { interpretLookup } from "./lookup";

const blank = { q: "", zip: "", result: "", facility: "", risk: "" };

describe("interpretLookup", () => {
  test("treats a 5-digit query as a zip when the zip field is empty", () => {
    expect(interpretLookup({ ...blank, q: "60661" })).toMatchObject({
      mode: "zip",
      q: "",
      zip: "60661",
    });
  });

  test("keeps a name query and a separate zip filter", () => {
    expect(
      interpretLookup({ ...blank, q: "  Billal ", zip: "60661" }),
    ).toMatchObject({
      mode: "text",
      q: "Billal",
      zip: "60661",
    });
  });

  test("uses the feed when there is no text query", () => {
    expect(interpretLookup(blank).mode).toBe("feed");
    expect(interpretLookup({ ...blank, zip: "60614" })).toMatchObject({
      mode: "zip",
      zip: "60614",
    });
  });
});
