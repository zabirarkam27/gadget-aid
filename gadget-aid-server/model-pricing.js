const modelKey = (value) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");
const literal = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const repairPatterns = (keyword) =>
  keyword
    .trim()
    .split(/\s+/u)
    .map((word) => new RegExp(literal(word), "i"));
const normalizeModelPrices = (rows, priceValue) => {
  if (!Array.isArray(rows) || rows.length > 20)
    throw Error("Add at most 20 model prices.");
  const seen = new Set();
  return rows.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      Object.keys(row).some(
        (key) => !["model", "repair", "price"].includes(key),
      )
    )
      throw Error("Use model, repair and price for each model price.");
    for (const field of ["model", "repair"])
      if (
        typeof row[field] !== "string" ||
        row[field].trim().length < 2 ||
        row[field].trim().length > 80
      )
        throw Error("Model and repair names must be 2–80 characters.");
    const price = priceValue(row.price);
    if (price === null)
      throw Error(
        "Model prices must be 0–1,000,000 USD with at most two decimals.",
      );
    const key = modelKey(row.model);
    const duplicate = JSON.stringify([
      key,
      row.repair.trim().toLowerCase().replace(/\s+/g, " "),
    ]);
    if (seen.has(duplicate))
      throw Error("Use one price per model and repair combination.");
    seen.add(duplicate);
    return {
      model: row.model.trim(),
      repair: row.repair.trim(),
      price,
      modelKey: key,
    };
  });
};
const publicModelPrices = (rows, priceValue) => {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 20).flatMap((row) => {
    try {
      return normalizeModelPrices(
        [{ model: row?.model, repair: row?.repair, price: row?.price }],
        priceValue,
      ).map(({ model, repair, price }) => ({
        model,
        repair,
        price,
        currency: "USD",
      }));
    } catch {
      return [];
    }
  });
};
module.exports = {
  modelKey,
  repairPatterns,
  normalizeModelPrices,
  publicModelPrices,
};
