/**
 * Type-only shim so `tsc` sees jest-dom matchers on Vitest's Assertion
 * interface regardless of how the host runner's module augmentation resolves.
 *
 * Why this exists: @testing-library/jest-dom v6 registers its matchers by
 * augmenting Vitest's `Assertion<T>`. Vitest 5 changed that interface's generic
 * shape / augmentation contract, so the augmentation no longer applies and every
 * jest-dom matcher disappears from the type surface repo-wide (243 TS2339
 * errors: toBeInTheDocument, toHaveAttribute, toHaveTextContent, toHaveFocus).
 *
 * This is a TYPE problem, not a test failure. The runtime import in
 * src/test/setup.ts (`import "@testing-library/jest-dom";`) is still correct
 * and must stay — do not "fix" a vitest 5 bump by removing it.
 *
 * `skipLibCheck` is on, but that only skips checking .d.ts files themselves;
 * it does not stop the augmentation from failing to apply here.
 */

import "@testing-library/jest-dom";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends jest.Matchers<void, T> {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface AsymmetricMatchersContaining extends jest.Matchers {}
}
