import crypto from 'crypto';
const rawKey = 'oma_sk_test_1234567890abcdef';
const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
console.log(keyHash);
