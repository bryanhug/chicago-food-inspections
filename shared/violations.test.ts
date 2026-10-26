import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseViolations } from "./violations";

type FixtureRow = {
  dba_name: string;
  results: string;
  violations: string | null;
};

const rows = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/chi_rows.json", import.meta.url),
    "utf8",
  ),
) as FixtureRow[];

describe("parseViolations", () => {
  test("parses the pipe-separated Chicago violations text from a real Pass row", () => {
    const billals = rows.find((row) => row.dba_name === "BILLAL'S");
    expect(billals).toBeTruthy();
    const parsed = parseViolations(billals?.violations);
    expect(parsed).toHaveLength(6);
    expect(parsed[0]).toEqual({
      number: 47,
      title:
        "FOOD & NON-FOOD CONTACT SURFACES CLEANABLE, PROPERLY DESIGNED, CONSTRUCTED & USED",
      comment: expect.stringContaining("OBSERVED UNTREATED WOODEN 2X4 BLOCK"),
    });
    expect(parsed.map((item) => item.number)).toEqual([47, 51, 55, 55, 57, 58]);
    expect(parsed[3]?.comment).toEqual(
      expect.stringContaining("OBSERVED SMALL STACK OVEN"),
    );
    for (const item of parsed) {
      expect(Object.keys(item).sort()).toEqual(["comment", "number", "title"]);
    }
  });

  test("keeps FDA code citations inside the comment on a real Fail row", () => {
    const grill = rows.find((row) => row.dba_name === "MACARONI GRILL");
    const parsed = parseViolations(grill?.violations);
    expect(parsed[0]?.number).toBe(38);
    expect(parsed[0]?.title).toBe("INSECTS, RODENTS, & ANIMALS NOT PRESENT");
    expect(parsed[1]?.comment).toEqual(expect.stringContaining("4-602.13"));
    expect(parsed[2]?.title).toBe(
      "PREVIOUS PRIORITY FOUNDATION VIOLATION CORRECTED",
    );
  });

  test("returns an empty list when the city omitted violations", () => {
    const quiet = rows.find((row) => row.violations == null);
    expect(quiet).toBeTruthy();
    expect(parseViolations(quiet?.violations)).toEqual([]);
    expect(parseViolations("")).toEqual([]);
    expect(parseViolations("   ")).toEqual([]);
    expect(parseViolations(null)).toEqual([]);
    expect(parseViolations(undefined)).toEqual([]);
  });

  test("parses an item that has no Comments section", () => {
    expect(parseViolations("16. FOOD PROTECTED")).toEqual([
      { number: 16, title: "FOOD PROTECTED", comment: null },
    ]);
  });

  test("splits on the spaced pipe and keeps a bare pipe inside a comment", () => {
    const parsed = parseViolations(
      "3. TITLE ONE - Comments: left|still left | 4. TITLE TWO - Comments: right",
    );
    expect(parsed).toEqual([
      { number: 3, title: "TITLE ONE", comment: "left|still left" },
      { number: 4, title: "TITLE TWO", comment: "right" },
    ]);
  });
});
