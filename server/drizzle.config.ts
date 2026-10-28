import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load the local server environment without overriding explicitly supplied values.
config({ path: ".env", quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
