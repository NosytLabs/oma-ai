import { hashAPIKey } from "./src/auth/keys.ts";
console.log(await hashAPIKey("oma_sk_test_12345"));
