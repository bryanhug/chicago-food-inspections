import { describe, expect, test } from "vitest";
import {
  applyInspection,
  summarizeInspections,
  type IdentityInput,
} from "./summary";

function item(
  inspectionId: string,
  inspectionDay: string,
  results: string,
  risk = "Risk 1 (High)",
) {
  return { inspectionId, inspectionDay, results, risk };
}

describe("summarizeInspections", () => {
  test("counts Pass and Pass w/ Conditions as passes and drops non-scored results from the rate", () => {
    const summary = summarizeInspections([
      item("1", "2026-01-01", "Pass"),
      item("2", "2026-02-01", "Pass w/ Conditions"),
      item("3", "2026-03-01", "Fail"),
      item("4", "2026-04-01", "Out of Business"),
      item("5", "2026-05-01", "No Entry"),
      item("6", "2026-06-01", "Not Ready"),
      item("7", "2026-07-01", "Business Not Located"),
    ]);

    expect(summary.passCount).toBe(2);
    expect(summary.scoredCount).toBe(3);
    expect(summary.failCount).toBe(1);
    expect(summary.passRate).toBeCloseTo(2 / 3);
    expect(summary.latestResult).toBe("Business Not Located");
    expect(summary.latestInspectionDay).toBe("2026-07-01");
    expect(summary.outOfBusiness).toBe(false);
    expect(summary.risk).toBe("Risk 1 (High)");
  });

  test("returns a null pass rate when every result is excluded from the denominator", () => {
    const summary = summarizeInspections([
      item("1", "2026-01-01", "No Entry"),
      item("2", "2026-02-01", "Not Ready"),
    ]);
    expect(summary.passRate).toBeNull();
    expect(summary.scoredCount).toBe(0);
    expect(summary.passCount).toBe(0);
    expect(summary.failCount).toBe(0);
    expect(summary.trend).toBe("insufficient");
  });

  test("compares the last three scored inspections with earlier scored inspections", () => {
    const improving = summarizeInspections([
      item("1", "2024-01-01", "Fail"),
      item("2", "2024-06-01", "Fail"),
      item("3", "2025-01-01", "Fail"),
      item("4", "2025-06-01", "Pass"),
      item("5", "2026-01-01", "Pass w/ Conditions"),
      item("6", "2026-06-01", "Pass"),
    ]);
    expect(improving.trend).toBe("improving");
    expect(improving.recentPassRate).toBe(1);
    expect(improving.earlierPassRate).toBe(0);

    const declining = summarizeInspections([
      item("1", "2024-01-01", "Pass"),
      item("2", "2024-06-01", "Pass"),
      item("3", "2025-01-01", "Pass w/ Conditions"),
      item("4", "2025-06-01", "Fail"),
      item("5", "2026-01-01", "Fail"),
      item("6", "2026-06-01", "Fail"),
    ]);
    expect(declining.trend).toBe("declining");

    const steady = summarizeInspections([
      item("1", "2024-01-01", "Pass"),
      item("2", "2024-06-01", "Pass"),
      item("3", "2025-01-01", "Fail"),
      item("4", "2025-06-01", "Pass"),
      item("5", "2026-01-01", "Pass"),
      item("6", "2026-06-01", "Fail"),
    ]);
    expect(steady.trend).toBe("steady");
    expect(steady.recentPassRate).toBeCloseTo(2 / 3);
    expect(steady.earlierPassRate).toBeCloseTo(2 / 3);
  });

  test("does not invent a trend until four scored inspections exist", () => {
    const summary = summarizeInspections([
      item("1", "2026-01-01", "Pass"),
      item("2", "2026-02-01", "Fail"),
      item("3", "2026-03-01", "Pass"),
      item("4", "2026-04-01", "Out of Business"),
      item("5", "2026-05-01", "No Entry"),
    ]);
    expect(summary.scoredCount).toBe(3);
    expect(summary.trend).toBe("insufficient");
    expect(summary.recentPassRate).toBeNull();
    expect(summary.earlierPassRate).toBeNull();
  });

  test("picks the latest result by date, then by inspection id", () => {
    const byDate = summarizeInspections([
      item("9", "2026-08-02", "Fail", "Risk 2 (Medium)"),
      item("1", "2026-01-01", "Pass", "Risk 3 (Low)"),
    ]);
    expect(byDate.latestResult).toBe("Fail");
    expect(byDate.latestInspectionId).toBe("9");
    expect(byDate.risk).toBe("Risk 2 (Medium)");

    const byId = summarizeInspections([
      item("10", "2026-08-02", "Pass", "Risk 2 (Medium)"),
      item("42", "2026-08-02", "Out of Business", "Risk 1 (High)"),
    ]);
    expect(byId.latestResult).toBe("Out of Business");
    expect(byId.latestInspectionId).toBe("42");
    expect(byId.outOfBusiness).toBe(true);
    expect(byId.risk).toBe("Risk 1 (High)");
  });

  test("flags out of business only when the latest result says so", () => {
    const closed = summarizeInspections([
      item("1", "2020-01-01", "Pass"),
      item("2", "2026-01-01", "Out of Business", ""),
    ]);
    expect(closed.outOfBusiness).toBe(true);
    expect(closed.risk).toBeNull();
    expect(closed.passRate).toBe(1);

    const reopened = summarizeInspections([
      item("1", "2020-01-01", "Out of Business"),
      item("2", "2026-01-01", "Pass"),
    ]);
    expect(reopened.outOfBusiness).toBe(false);
  });
});

function identity(overrides: Partial<IdentityInput> = {}): IdentityInput {
  return {
    inspectionId: "1",
    inspectionDay: "2026-01-01",
    results: "Pass",
    risk: "Risk 1 (High)",
    dbaName: "OLD NAME",
    akaName: "OLD AKA",
    address: "1 OLD ST",
    city: "CHICAGO",
    state: "IL",
    zip: "60601",
    facilityType: "Restaurant",
    latitude: 41.8,
    longitude: -87.6,
    ...overrides,
  };
}

describe("applyInspection", () => {
  test("replaces an inspection id and recomputes the pass rate from the merged history", () => {
    const first = applyInspection(null, "99", identity({ results: "Fail" }));
    expect(first.failCount).toBe(1);
    expect(first.passRate).toBe(0);

    const revised = applyInspection(
      first,
      "99",
      identity({ results: "Pass w/ Conditions" }),
    );
    expect(revised.history).toHaveLength(1);
    expect(revised.failCount).toBe(0);
    expect(revised.passCount).toBe(1);
    expect(revised.passRate).toBe(1);
    expect(revised.latestResult).toBe("Pass w/ Conditions");
  });

  test("keeps the newer name when an older inspection arrives later", () => {
    const current = applyInspection(
      null,
      "99",
      identity({
        inspectionId: "2",
        inspectionDay: "2026-05-01",
        dbaName: "NEW NAME",
        akaName: "NEW AKA",
        address: "9 NEW ST",
      }),
    );
    const merged = applyInspection(
      current,
      "99",
      identity({
        inspectionId: "1",
        inspectionDay: "2024-01-01",
        dbaName: "OLD NAME",
        results: "Fail",
      }),
    );
    expect(merged.dbaName).toBe("NEW NAME");
    expect(merged.akaName).toBe("NEW AKA");
    expect(merged.address).toBe("9 NEW ST");
    expect(merged.searchName).toBe("NEW NAME NEW AKA");
    expect(merged.failCount).toBe(1);
    expect(merged.latestInspectionId).toBe("2");
  });

  test("drops the oldest history entries past the cap and recounts from what remains", () => {
    let state = applyInspection(
      null,
      "99",
      identity({
        inspectionId: "1",
        inspectionDay: "2010-01-01",
        results: "Fail",
      }),
    );
    for (let index = 2; index <= 401; index += 1) {
      const day = `2010-01-${String((index % 27) + 1).padStart(2, "0")}`;
      state = applyInspection(
        state,
        "99",
        identity({
          inspectionId: String(index),
          inspectionDay:
            index === 401
              ? "2026-10-23"
              : `20${String(10 + (index % 16)).padStart(2, "0")}-06-01`,
          results: "Pass",
          dbaName: index === 401 ? "CURRENT" : "OLDER",
        }),
      );
      void day;
    }
    expect(state.history).toHaveLength(400);
    expect(state.history.some((entry) => entry.inspectionId === "1")).toBe(
      false,
    );
    expect(state.failCount).toBe(0);
    expect(state.dbaName).toBe("CURRENT");
    expect(state.latestInspectionDay).toBe("2026-10-23");
  });
});
