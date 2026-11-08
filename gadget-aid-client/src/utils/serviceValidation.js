export const serviceErrors = values => {
  const errors = {};
  for (const [field,min,max] of [["name",2,120],["area",2,160],["description",10,5000]]) {
    if (typeof values[field] !== "string" || values[field].trim().length < min || values[field].trim().length > max) errors[field] = `Use ${min}–${max} characters.`;
  }
  const price = Number(values.price);
  if (!["string","number"].includes(typeof values.price) || (typeof values.price === "string" && !values.price.trim()) || !Number.isFinite(price) || price < 0 || price > 1000000 || Math.abs(price*100-Math.round(price*100)) > 0.00001) errors.price = "Enter an amount from 0 to 1,000,000 with up to 2 decimal places.";
  try { const url = new URL(values.image); if (!/^https?:$/.test(url.protocol) || url.username || url.password || values.image.length > 2048) throw new Error(); }
  catch { errors.image = "Use a valid http or https image URL without credentials."; }
  if (values.modelPrices !== undefined) {
    if (!Array.isArray(values.modelPrices) || values.modelPrices.length > 20) errors.modelPrices = "Add at most 20 model prices.";
    else {
      const seen = new Set();
      for (const row of values.modelPrices) {
        if (!row || ["model", "repair"].some(key => typeof row[key] !== "string" || row[key].trim().length < 2 || row[key].trim().length > 80)) { errors.modelPrices = "Each model and repair name needs 2–80 characters."; break; }
        const price = Number(row.price);
        if (!["string", "number"].includes(typeof row.price) || (typeof row.price === "string" && !row.price.trim()) || !Number.isFinite(price) || price < 0 || price > 1000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) { errors.modelPrices = "Enter valid USD model prices with at most two decimals."; break; }
        const key = JSON.stringify([row.model.normalize("NFKC").toLowerCase().replace(/\s+/gu, ""), row.repair.trim().toLowerCase().replace(/\s+/g, " ")]);
        if (seen.has(key)) { errors.modelPrices = "Use one price per model and repair combination."; break; }
        seen.add(key);
      }
    }
  }
  return errors;
};
export const serviceInput = form => {
  const data = new FormData(form);
  return Object.fromEntries(["name","price","area","description","image"].map(key => [key,String(data.get(key) || "").trim()]));
};
