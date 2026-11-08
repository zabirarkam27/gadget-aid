import test from "node:test";
import assert from "node:assert/strict";
import { serviceErrors } from "../src/utils/serviceValidation.js";
const base = {
  name: "Screen repair",
  price: 50,
  area: "Dhaka",
  description: "Repair service description",
  image: "https://example.test/image.png",
};
const rate = { model: "Phone 13", repair: "Screen replacement", price: 80 };
test("service model rates accept zero and separate model variants", () => {
  assert.deepEqual(
    serviceErrors({
      ...base,
      modelPrices: [
        { ...rate, price: 0 },
        { ...rate, model: "Phone 13 Pro" },
      ],
    }),
    {},
  );
});
test("service model rates reject invalid money, duplicates and excess entries", () => {
  for (const prices of [
    null,
    {},
    Array(21).fill(rate),
    [rate, { ...rate, model: "PHONE13" }],
    [{ ...rate, price: " " }],
    [{ ...rate, price: true }],
    [{ ...rate, price: 1.001 }],
    [{ ...rate, model: " " }],
  ])
    assert.ok(serviceErrors({ ...base, modelPrices: prices }).modelPrices);
  assert.equal(serviceErrors(base).modelPrices, undefined);
});
