export const serviceErrors = values => {
  const errors = {};
  for (const [field,min,max] of [["name",2,120],["area",2,160],["description",10,5000]]) {
    if (typeof values[field] !== "string" || values[field].trim().length < min || values[field].trim().length > max) errors[field] = `Use ${min}–${max} characters.`;
  }
  const price = Number(values.price);
  if (!["string","number"].includes(typeof values.price) || (typeof values.price === "string" && !values.price.trim()) || !Number.isFinite(price) || price < 0 || price > 1000000 || Math.abs(price*100-Math.round(price*100)) > 0.00001) errors.price = "Enter an amount from 0 to 1,000,000 with up to 2 decimal places.";
  try { const url = new URL(values.image); if (!/^https?:$/.test(url.protocol) || url.username || url.password || values.image.length > 2048) throw new Error(); }
  catch { errors.image = "Use a valid http or https image URL without credentials."; }
  return errors;
};
export const serviceInput = form => {
  const data = new FormData(form);
  return Object.fromEntries(["name","price","area","description","image"].map(key => [key,String(data.get(key) || "").trim()]));
};
