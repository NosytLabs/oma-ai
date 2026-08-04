export type PolarEnvironment = "production" | "sandbox";

export const POLAR_API_BASE_URLS: Record<PolarEnvironment, string> = {
  production: "https://api.polar.sh",
  sandbox: "https://sandbox-api.polar.sh",
};

export function polarApiBaseUrl(environment: PolarEnvironment): string {
  return POLAR_API_BASE_URLS[environment];
}
