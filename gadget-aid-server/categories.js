const { fail, idValue } = require("./domain");
const serviceCategory = async (db, value, current) => {
  if (value === undefined)
    return current ? {} : { categoryId: null, categoryLabel: "Uncategorized" };
  if (value === null || value === "")
    return { categoryId: null, categoryLabel: "Uncategorized" };
  const id = idValue(value),
    category = await db.categories.findOne({ _id: id });
  if (
    !category ||
    (category.state !== "active" && String(current?.categoryId) !== String(id))
  )
    fail(400, "Choose an active service category.", "CATEGORY_UNAVAILABLE");
  return { categoryId: String(id), categoryLabel: category.name };
};
module.exports = { serviceCategory };
