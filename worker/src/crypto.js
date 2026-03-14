const crypto = require("crypto");

const algorithm = "aes-256-gcm";

function getKey() {
  const secret = process.env.TOKEN_ENCRYPTION_SECRET || "01234567890123456789012345678901";
  return Buffer.from(secret.slice(0, 32).padEnd(32, "0"));
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decrypt(payload) {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const decipher = crypto.createDecipheriv(algorithm, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

module.exports = {
  encrypt,
  decrypt
};
