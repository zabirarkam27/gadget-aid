export function compareRepairCosts({
  repairCost,
  replacementCost,
  repairMonths,
  replacementMonths,
}) {
  const money = (value) => {
    if (typeof value !== "string" && typeof value !== "number")
      throw Error("Enter valid costs.");
    if (
      String(value).trim() === "" ||
      !Number.isFinite(Number(value)) ||
      Number(value) < 0 ||
      Number(value) > 1000000 ||
      Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) > 0.00001
    )
      throw Error("Costs must be 0–1,000,000 with at most two decimal places.");
    return Math.round(Number(value) * 100);
  };
  const months = (value) => {
    if (typeof value !== "string" && typeof value !== "number")
      throw Error("Enter valid expected months.");
    if (
      String(value).trim() === "" ||
      !Number.isInteger(Number(value)) ||
      Number(value) < 1 ||
      Number(value) > 120
    )
      throw Error("Expected use must be 1–120 whole months.");
    return Number(value);
  };
  const repair = money(repairCost),
    replacement = money(replacementCost),
    a = months(repairMonths),
    b = months(replacementMonths);
  return {
    upfrontDifference: (replacement - repair) / 100,
    repairPerMonth: repair / 100 / a,
    replacementPerMonth: replacement / 100 / b,
  };
}
