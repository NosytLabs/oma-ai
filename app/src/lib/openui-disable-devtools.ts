/**
 * react-lang 0.3 auto-loads its CDN devtools widget in development unless
 * this package-level flag is already present. OMA uses its own diagnostics,
 * so opt out before evaluating the react-lang entrypoint.
 */
const flags = globalThis as Record<symbol, unknown>;
flags[Symbol.for("openui.devtools.autoMount")] = true;
