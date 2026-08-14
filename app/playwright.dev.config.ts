import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://localhost:3000" },
});
