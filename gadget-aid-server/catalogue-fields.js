const { technicianId } = require("./identities");
const { priceValue } = require("./domain");
const catalogueFields = service => {
  const source = service.createdAt ?? service._id;
  const date = source?.getTimestamp ? source.getTimestamp() : new Date(source);
  const price = priceValue(service.price);
  return {
    technicianId: technicianId(service.providerEmail || ""),
    catalogueDate: Number.isFinite(+date) ? +date : 0,
    catalogueDateMissing: 0,
    cataloguePrice: price ?? 0,
    cataloguePriceMissing: price === null ? 1 : 0,
  };
};
module.exports = { catalogueFields };
