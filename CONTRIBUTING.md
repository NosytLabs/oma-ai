# Contributing to OMA AI Gateway

Thank you for your interest in contributing to OMA AI Gateway!

## How to Submit a Pull Request

1. **Fork the repository** and create a branch from `main`:
   ```
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** — ensure your work is focused and atomic.

3. **Run validation** before pushing:
   ```bash
   npm run validate
   ```
   This runs typecheck, lint, and tests for both `app/` and `server/`.

4. **Commit with a clear message**:
   ```
   git commit -m "feat(provider): add support for X provider"
   ```

5. **Push and open a Pull Request** against `main`. Fill out the PR template with a description of changes, testing done, and any breaking concerns.

## Coding Standards

- **TypeScript** — strict mode enabled. No `any` without explicit justification.
- **Formatting** — run `npm run lint:fix` before committing. ESLint + Prettier are configured.
- **Naming** — use descriptive names. Follow existing conventions in each package (`app/` and `server/`).
- **Error handling** — never swallow errors silently. Propagate with context.
- **No dead code** — remove unused imports, functions, and providers. The project maintains a clean inference provider list.

## Testing Requirements

- **Unit tests** — required for new logic. Run with `npm test` in `app/` or `server/`.
- **Integration tests** — for API routes and payment flows.
- **100% passing** — CI will not merge PRs with failing tests. Run `npm run validate` locally to verify.

## Project Structure

```
OMA-AI/
├── app/          # Frontend (Next.js)
├── server/       # Backend (API + routing)
├── LICENSE       # MIT license
└── README.md     # Project overview
```

## Questions?

Open an issue for discussion before starting large PRs to avoid wasted effort.
