import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

export function deriveEncryptionKey(masterKey: string): Buffer {
  return createHash("sha256").update(masterKey).digest();
}

export function encryptSecret(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = deriveEncryptionKey(config.ENCRYPTION_KEY);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return { encrypted, iv: iv.toString("hex"), authTag };
}

export function decryptSecret(encrypted: string, iv: string, authTag: string): string {
  const key = deriveEncryptionKey(config.ENCRYPTION_KEY);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let plaintext = decipher.update(encrypted, "hex", "utf8");
  plaintext += decipher.final("utf8");
  return plaintext;
}
