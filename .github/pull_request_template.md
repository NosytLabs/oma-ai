## Summary

<!-- One-paragraph description of what this PR changes and why. -->

Fixes #<!-- issue number, if any -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation / repo hygiene

## What changed

<!-- Bullet list of the substantive changes. Keep it short — the diff is the source of truth. -->

-

## Validation

Run locally before requesting review:

```bash
pnpm run validate
```

- [ ] `pnpm run validate:typecheck` passes (app + server)
- [ ] `pnpm run validate:lint` passes (app + server)
- [ ] `pnpm run validate:test` passes (app + server)
- [ ] No new `TODO` / `FIXME` / `HACK` introduced in production code
- [ ] I have read [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md) and [BRAND.md](../blob/main/BRAND.md) (voice/terminology applies to user-facing strings)

## Risk & rollback

<!-- How risky is this change? How do you roll it back if it breaks prod? -->

- Risk:
- Rollback plan:

## Checklist

- [ ] I have tested the change in a clean checkout
- [ ] I have updated docs / `.env.example` if config changed
- [ ] I have not introduced new prod dependencies without justification
- [ ] No secrets, API keys, or `.env` content committed