const {
  randomBytes,
  createCipheriv,
  createDecipheriv,
} = require("node:crypto");
const { fail } = require("./domain");
const aad = ({ ownerUid, deviceId, id }) =>
  Buffer.from(JSON.stringify(["receipt-v1", ownerUid, deviceId, id]));
const createReceiptVault = ({ activeKeyId, keys }) => {
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(activeKeyId) || !keys?.[activeKeyId])
    throw Error("Receipt encryption configuration is invalid.");
  const decoded = new Map(
    Object.entries(keys).map(([id, key]) => {
      if (
        !/^[a-zA-Z0-9_-]{1,40}$/.test(id) ||
        typeof key !== "string" ||
        !/^[A-Za-z0-9+/]{43}=$/.test(key) ||
        Buffer.from(key, "base64").length !== 32
      )
        throw Error("Receipt encryption configuration is invalid.");
      return [id, Buffer.from(key, "base64")];
    }),
  );
  return {
    seal(buffer, context) {
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", decoded.get(activeKeyId), iv);
      cipher.setAAD(aad(context));
      const data = Buffer.concat([cipher.update(buffer), cipher.final()]);
      return {
        encryptionVersion: 1,
        keyId: activeKeyId,
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        ciphertext: data.toString("base64"),
      };
    },
    open(row, context) {
      try {
        if (row.encryptionVersion !== 1 || !decoded.has(row.keyId))
          throw Error();
        const decipher = createDecipheriv(
          "aes-256-gcm",
          decoded.get(row.keyId),
          Buffer.from(row.iv, "base64"),
        );
        decipher.setAAD(aad(context));
        decipher.setAuthTag(Buffer.from(row.tag, "base64"));
        return Buffer.concat([
          decipher.update(Buffer.from(row.ciphertext, "base64")),
          decipher.final(),
        ]);
      } catch {
        fail(
          503,
          "This private receipt cannot be decrypted. Contact the storage operator.",
          "RECEIPT_UNAVAILABLE",
        );
      }
    },
  };
};
const receiptVaultFromEnv = (env = process.env) => {
  if (!env.RECEIPT_ENCRYPTION_KEY) return null;
  let previous = {};
  try {
    if (env.RECEIPT_PREVIOUS_KEYS)
      previous = JSON.parse(env.RECEIPT_PREVIOUS_KEYS);
  } catch {
    throw Error("Receipt encryption configuration is invalid.");
  }
  if (!previous || typeof previous !== "object" || Array.isArray(previous))
    throw Error("Receipt encryption configuration is invalid.");
  const activeKeyId = env.RECEIPT_KEY_ID || "v1";
  return createReceiptVault({
    activeKeyId,
    keys: { ...previous, [activeKeyId]: env.RECEIPT_ENCRYPTION_KEY },
  });
};
module.exports = { createReceiptVault, receiptVaultFromEnv };
