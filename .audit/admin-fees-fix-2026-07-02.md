# admin-fees-fix — 2026-07-02

## Bug

`app/src/app/admin/fees/page.tsx` hardcoded a 7-provider array
(`venice`, `openrouter`, `together`, `deepinfra`, `litellm`, `antseed`, `tinyfish`)
and rendered the page from that list, ignoring the server response.

Per `server/src/config.ts` lines 25–29, six of those providers were removed
(OpenRouter, Together, DeepInfra, Claude, Gemini, Morpheus, AntSeed, LiteLLM).
The real server default in `server/src/routes/config.ts` `GET /v1/admin/config/fees`
returns only:

```json
{ "config": { "providers": { "venice": { "markupPercent": 10 }, "surplus": { "markupPercent": 10 } } } }
```

Net effect: admins saw markup inputs for five ghost providers (openrouter,
together, deepinfra, litellm, antseed) plus tinyfish (which the server doesn't
recognize at all), and never saw `surplus` even though it is a real configured
provider.

## Fix

- Removed the `ProviderInfo` type and the hardcoded `PROVIDERS` constant.
- Render loop now iterates `Object.entries(feesQuery.data?.providers ?? {})`
  so the page reflects whatever the server returns, including future providers
  added via the admin API.
- Display label is the provider ID (capitalized via Tailwind `capitalize`); the
  per-provider description line was dropped because descriptions don't exist
  in the server response and adding them client-side would mean hardcoding.
- Input value falls back to `provider.markupPercent` from the server response
  instead of a hardcoded `10`.
- Empty-state message ("No providers configured.") added when the server
  returns an empty providers object.

## Diff summary

```
- type ProviderInfo = { id; name; description }
- const PROVIDERS: ProviderInfo[] = [ 7 entries … ]
+ // no client-side provider list — derived from server response
- {PROVIDERS.map((provider) => ( … provider.name / provider.description … ))}
+ {Object.entries(feesQuery.data?.providers ?? {}).map(([providerId, provider]) => (
+   … capitalize(providerId) …
+ ))}
+ {Object.keys(feesQuery.data?.providers ?? {}).length === 0 && <empty-state />}
```

No changes to:
- The fees page's GET/PUT wiring (`/api/v1/admin/config/fees`)
- The margin calculator, quick examples, save handler, or any other panel
- The server route, schema, or default config
- Type exports — `FeeConfig` shape unchanged

## Verification

| Command | Result |
| --- | --- |
| `cd app && pnpm run typecheck` | PASS (next typegen + tsc --noEmit, 0 errors) |
| `cd app && pnpm run lint` | PASS (eslint, 0 errors) |
| `cd app && pnpm test` | PASS — 13 files, 117/117 tests |

Pre-existing test noise from `src/app/page.test.tsx` (`Invalid prop className
supplied to React.Fragment`) is unrelated to this change.

## Constraints satisfied

- [x] No hardcoded provider names on the fees page
- [x] Page renders whatever the server returns (now keyed by `Object.entries`)
- [x] All existing fee-tier UI preserved (default markup, calculator, examples)
- [x] TypeScript compiles
- [x] Lint passes
- [x] 117/117 tests pass