# Deployment references

Deployment status changes with each release. Check GitHub `main` and the
deployment serving the production domain for the current commit and readiness.
Record release-specific checks in the release PR.

Use these maintained references:

- [Deployment](../docs/DEPLOYMENT.md): canonical host, production targets, and
  frontend/API release procedures.
- [Deployment verification](../docs/deployment-health.md): validation commands,
  health checks, and failure diagnosis.
- [Platform](../docs/PLATFORM.md): authentication, funding, and operator settings.
- [Chat UI](../docs/chat-ui.md): local history, response rendering, and actions.

`deploy/coolify/` and Docker compose files are self-hosting references. Current
production configuration is documented in Deployment.
