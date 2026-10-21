import { describe, it, expect } from "vitest";
import { findDuplicates } from "./investmentDuplicates";

describe("findDuplicates", () => {
  const txs = [{ date: "2026-10-05", category: "Investimentos", type: "expense", amount: 500 }];
  it("flags a move already saved in the goal category", () => {
    expect(findDuplicates([{ date: "2026-10-05", description: "x", kind: "deposit", amount: 500 }], txs, "Investimentos")).toEqual(["app"]);
  });
  it("a withdrawal with same date and value is not a duplicate of a deposit", () => {
    expect(findDuplicates([{ date: "2026-10-05", description: "x", kind: "withdraw", amount: 500 }], txs, "Investimentos")).toEqual([null]);
  });
  it("flags repeats inside the same batch", () => {
    const m = { date: "2026-10-06", description: "a", kind: "deposit" as const, amount: 10 };
    expect(findDuplicates([m, m], txs, "Investimentos")).toEqual([null, "batch"]);
  });
});
