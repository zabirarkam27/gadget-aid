import test from "node:test";
import assert from "node:assert/strict";
import { compareRepairCosts } from "../src/utils/repairComparison.js";
test("repair comparison uses entered costs and lifetime assumptions without rounding inputs early", () => {
  assert.deepEqual(
    compareRepairCosts({
      repairCost: "120",
      replacementCost: "600",
      repairMonths: "12",
      replacementMonths: "24",
    }),
    { upfrontDifference: 480, repairPerMonth: 10, replacementPerMonth: 25 },
  );
  assert.equal(
    compareRepairCosts({
      repairCost: "0.10",
      replacementCost: "0.30",
      repairMonths: "1",
      replacementMonths: "1",
    }).upfrontDifference,
    0.2,
  );
});
test("comparison permits a genuinely zero repair price and negative upfront difference", () => {
  assert.equal(
    compareRepairCosts({
      repairCost: "0",
      replacementCost: "50",
      repairMonths: "1",
      replacementMonths: "12",
    }).repairPerMonth,
    0,
  );
  assert.equal(
    compareRepairCosts({
      repairCost: "100",
      replacementCost: "50",
      repairMonths: "12",
      replacementMonths: "12",
    }).upfrontDifference,
    -50,
  );
});
test("comparison rejects missing, nonfinite, fractional-month and overprecision inputs", () => {
  const valid = {
    repairCost: "10",
    replacementCost: "100",
    repairMonths: "12",
    replacementMonths: "24",
  };
  for (const patch of [
    { repairCost: "" },
    { repairCost: NaN },
    { repairCost: "-1" },
    { replacementCost: "1.234" },
    { replacementCost: "1000001" },
    { repairMonths: "0" },
    { replacementMonths: "1.5" },
    { repairMonths: true },
    { repairMonths: "121" },
  ])
    assert.throws(() => compareRepairCosts({ ...valid, ...patch }));
});
