const { createHash } = require("node:crypto");
const { isIP } = require("node:net");

// Supplemental per-instance protection. Existing shared upload/AI quotas remain
// authoritative; this is not a distributed firewall or account authentication.
const requestLimiter = ({ clock = () => new Date(), vercel = false, limit = 180, capacity = 5000 } = {}) => {
  const buckets = new Map();
  return (req, res, next) => {
    const now = +clock();
    const forwarded = vercel ? req.get("x-forwarded-for")?.split(",")[0]?.trim() : "";
    const address = isIP(forwarded || "") ? forwarded : req.socket.remoteAddress || "unknown";
    const key = createHash("sha256").update(address).digest("hex");
    for (const [id, bucket] of buckets) if (bucket.ends <= now) buckets.delete(id);
    let bucket = buckets.get(key);
    if (!bucket && buckets.size < capacity) {
      bucket = { used: 0, ends: now + 60000 };
      buckets.set(key, bucket);
    }
    const weight = req.path === "/tools/estimate" ? 6 : 1;
    if (!bucket || bucket.used + weight > limit) {
      res.set("Retry-After", String(Math.max(1, Math.ceil(((bucket?.ends || now + 60000) - now) / 1000))));
      res.set("Cache-Control", "no-store");
      return res.status(429).json({ message: "Too many requests. Please wait a minute and try again.", code: "RATE_LIMITED" });
    }
    bucket.used += weight;
    next();
  };
};
module.exports = { requestLimiter };
