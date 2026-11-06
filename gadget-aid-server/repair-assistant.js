const { checkKeys, fail, serializeService, todayInDhaka } = require("./domain");
const { visibleServices } = require("./access");
const { listPage } = require("./listings");
const POLICY = "repair-ai-v1";
const categories = ["Smartphone", "Laptop", "Desktop", "Tablet", "Smartwatch", "Gaming console", "Other"];
const issues = {
  power: { label: "Power or startup issue", pattern: /power|start|boot|turn on|চালু|অন হচ্ছে/i, search: /power|diagnos|laptop|computer/i },
  screen: { label: "Screen or display issue", pattern: /screen|display|crack|স্ক্রিন|ডিসপ্লে|পর্দা/i, search: /screen|display|monitor/i },
  charging: { label: "Charging or battery issue", pattern: /charg|battery|চার্জ|ব্যাটারি/i, search: /charg|battery|diagnos/i },
  connectivity: { label: "Connectivity issue", pattern: /wifi|wi-fi|bluetooth|network|নেটওয়ার্ক|ওয়াইফাই/i, search: /network|router|connect/i },
  performance: { label: "Performance or software issue", pattern: /slow|freeze|software|ল্যাগ|স্লো|হ্যাং/i, search: /software|diagnos|computer/i },
  other: { label: "Needs a technician's assessment", pattern: /./, search: /diagnos|repair/i },
};
const questions = {
  onset: "When did this begin, and is it constant or intermittent?",
  changes: "Was there a recent drop, spill or software update?",
  message: "Is there an error message? Describe it without account details or passwords.",
  scope: "Does the issue affect one app/accessory or the whole device?",
};
const normalize = text => text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").toLowerCase();
const hazardous = text => /sw[eo]ll|bloat|bulg|puff|smok|burn|smell|odou?r|flame|fire|over.?heat|\bhot\b|\bheat\b|liquid|water|spill|wet|spark|electric.?shock|ধোঁ[য়য়]া|ধো[য়য়]া|ফুলে|ফোলা|পোড়া|পোড়া|আগুন|গরম|পানি|জল|ভেজা/.test(normalize(text));
const safety = [
  "Stop using and charging the device. Do not test it again to reproduce the problem.",
  "Do not open the device, touch or remove its battery, or attempt electrical repairs. Avoid touching a hot, smoking or wet powered device.",
  "Seek qualified repair help. If there is smoke or fire, move away, keep others away and contact local emergency services; do not wait for a booking.",
];
const safeSteps = [
  "Check the manufacturer's user guide for the exact model and note any on-screen error without sharing passwords.",
  "If the device is dry, cool, undamaged and safe to use, you may close and reopen the affected app or use the normal on-screen restart. Do not force a reset or erase data.",
  "If the issue persists, arrange a technician assessment. Stop using or charging if heat, swelling, smoke, unusual smell or liquid damage appears.",
];
const validate = body => {
  checkKeys(body, ["category", "brand", "model", "symptoms", "onset", "useAi", "consentVersion", "danger"]);
  if (typeof body.danger !== "boolean") fail(400, "Confirm whether there are device safety symptoms.", "VALIDATION_ERROR");
  if (!categories.includes(body.category) || typeof body.useAi !== "boolean") fail(400, "Choose a device category and assistant mode.", "VALIDATION_ERROR");
  const data = { category: body.category };
  for (const [key, min, max] of [["brand", 0, 80], ["model", 0, 80], ["symptoms", 10, 1000], ["onset", 0, 80]]) {
    const value = body[key] ?? "";
    if (typeof value !== "string" || value.trim().length < min || value.length > max) fail(400, `Check ${key}: use ${min}–${max} characters.`, "VALIDATION_ERROR");
    data[key] = value.trim();
  }
  return data;
};
const validSelection = value => value && Object.keys(value).length === 2 && Array.isArray(value.issues) && value.issues.length >= 1 && value.issues.length <= 3 && value.issues.every(id => Object.hasOwn(issues, id)) && Array.isArray(value.questions) && value.questions.length <= 3 && value.questions.every(id => Object.hasOwn(questions, id));
const createRepairAssistant = ({ collections, clock, classify = null }) => {
  let active = 0;
  const quota = async user => {
    const db = await collections(), day = todayInDhaka(clock());
    await db.transaction(async tx => {
      for (const [id, limit] of [["assistant:global", 100], [`assistant:user:${user.uid}`, 10]]) {
        const row = await tx.operationMeta.findOne({ _id: id });
        const count = row?.day === day ? row.count : 0;
        if (count >= limit) fail(429, "AI request limit reached. Use the guided mode or try another day.", "AI_LIMIT");
        const fields = { day, count: count + 1 };
        if (row) await tx.operationMeta.updateOne({ _id: id }, { $set: fields });
        else await tx.operationMeta.insertOne({ _id: id, ...fields });
      }
    });
  };
  return {
    configuration: (req, res) => res.json({ aiAvailable: !!classify, policyVersion: POLICY, categories }),
    suggest: async (req, res) => {
      const input = validate(req.body);
      const risk = req.body.danger || hazardous(Object.values(input).join(" "));
      if (!risk && req.body.useAi && req.body.consentVersion !== POLICY) fail(400, "Review and accept the current AI data policy first.", "AI_CONSENT_REQUIRED");
      let selection = { issues: Object.keys(issues).filter(id => id !== "other" && issues[id].pattern.test(input.symptoms)).slice(0, 3), questions: ["onset", "changes", "message"] };
      if (!selection.issues.length) selection.issues = ["other"];
      let mode = "guided", aiState = req.body.useAi ? "unavailable" : "not_requested";
      if (risk) { mode = "safety"; aiState = "skipped_safety"; }
      else if (req.body.useAi && classify) {
        if (active >= 2) fail(429, "The assistant is busy. Use guided mode or retry shortly.", "AI_BUSY");
        active++;
        try {
          await quota(req.user);
          const answer = await classify(input);
          if (!validSelection(answer)) throw Error("Invalid classification");
          selection = answer; mode = "ai"; aiState = "used";
        } catch (error) {
          if (error.status === 429) throw error;
          aiState = "failed";
        } finally { active--; }
      }
      let services = [], servicesUnavailable = false;
      try {
        const db = await collections();
        const patterns = selection.issues.map(id => issues[id].search);
        const page = await listPage({ collection: db.services, filter: { deletedAt: null, $or: patterns.flatMap(pattern => [{ name: pattern }, { description: pattern }]) }, query: { limit: "4" }, scope: "assistant", visible: rows => visibleServices(db, rows) });
        services = page.items.map(serializeService);
      } catch { servicesUnavailable = true; }
      res.json({ mode, aiState, urgent: risk, disclaimer: "Preliminary suggestions only, not a diagnosis. A qualified technician must assess the device.",
        issueCategories: risk ? ["Potential device safety issue"] : [...new Set(selection.issues)].map(id => issues[id].label),
        questions: risk ? [] : [...new Set(selection.questions)].map(id => questions[id]),
        steps: risk ? safety : safeSteps, services, servicesUnavailable });
    },
  };
};
module.exports = { createRepairAssistant, issues, questions, POLICY, hazardous, validSelection };
