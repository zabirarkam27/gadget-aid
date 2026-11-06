require("dotenv").config({ quiet: true });
// Configuration-only readiness check. No mail, provider calls or secret values.
const checks = {
  RESEND_API_KEY: /^re_\S{10,}$/.test(process.env.RESEND_API_KEY || ""),
  EMAIL_FROM: /^[^\r\n<>]*<?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(process.env.EMAIL_FROM || ""),
  CRON_SECRET: (process.env.CRON_SECRET || "").length >= 32,
  APP_URL: false,
};
try {
  const url = new URL(process.env.APP_URL);
  checks.APP_URL = url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
} catch { /* Missing or invalid origin. */ }
for (const [name, ready] of Object.entries(checks)) console.log(`${name}: ${ready ? "configured" : "missing or invalid"}`);
console.log("Domain verification and scheduler execution must also be verified before activation.");
if (Object.values(checks).some(ready => !ready)) process.exitCode = 1;
