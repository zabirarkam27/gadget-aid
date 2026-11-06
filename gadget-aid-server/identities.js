const { createHash } = require("node:crypto");
const technicianId = (email) =>
  createHash("sha256")
    .update(`technician-v1:${email}`)
    .digest("hex")
    .slice(0, 24);
module.exports = { technicianId };
