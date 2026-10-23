# Third-party licenses

This inventory is generated from the installed direct dependencies declared in the root, app and server package manifests. It also retains notices for installed jose and undici transitive dependencies. Package license declarations, original shipped license texts and pinned upstream license sources are the sources; transitive and bundled dependencies may have additional notices in their distributions.

[Original runtime license texts](app/public/licenses/third-party-notices.txt) are also served by the website at `/licenses/third-party-notices.txt`.

Regenerate after installing dependencies with `pnpm licenses:generate`.

## Runtime dependencies

| Package | Installed version | License declared by package | Used by |
| --- | --- | --- | --- |
| [@hono/node-server](https://www.npmjs.com/package/@hono/node-server) | 2.1.5 | MIT | server |
| [@neon/config](https://www.npmjs.com/package/@neon/config) | 1.9.1 | Apache-2.0 | server |
| [@neondatabase/serverless](https://www.npmjs.com/package/@neondatabase/serverless) | 1.2.0 | MIT | server |
| [@opentelemetry/api](https://www.npmjs.com/package/@opentelemetry/api) | 1.9.1 | Apache-2.0 | server |
| [@opentelemetry/auto-instrumentations-node](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node) | 0.81.0 | Apache-2.0 | server |
| [@opentelemetry/exporter-trace-otlp-http](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-http) | 0.223.0 | Apache-2.0 | server |
| [@opentelemetry/resources](https://www.npmjs.com/package/@opentelemetry/resources) | 2.12.0 | Apache-2.0 | server |
| [@opentelemetry/sdk-node](https://www.npmjs.com/package/@opentelemetry/sdk-node) | 0.223.0 | Apache-2.0 | server |
| [@opentelemetry/sdk-trace-base](https://www.npmjs.com/package/@opentelemetry/sdk-trace-base) | 2.12.0 | Apache-2.0 | server |
| [@opentelemetry/semantic-conventions](https://www.npmjs.com/package/@opentelemetry/semantic-conventions) | 1.43.0 | Apache-2.0 | server |
| [@openuidev/react-lang](https://www.npmjs.com/package/@openuidev/react-lang) | 1.0.1 | MIT | app |
| [@polar-sh/sdk](https://www.npmjs.com/package/@polar-sh/sdk) | 1.0.2 | MIT | server |
| [@tanstack/react-query](https://www.npmjs.com/package/@tanstack/react-query) | 5.104.3 | MIT | app |
| [@upstash/redis](https://www.npmjs.com/package/@upstash/redis) | 1.39.0 | MIT | server |
| [better-auth](https://www.npmjs.com/package/better-auth) | 1.7.12 | MIT | app, server |
| [border-beam](https://www.npmjs.com/package/border-beam) | 1.4.1 | MIT | app |
| [clsx](https://www.npmjs.com/package/clsx) | 2.1.1 | MIT | app |
| [cuelume](https://www.npmjs.com/package/cuelume) | 0.2.8 | MIT | app |
| [date-fns](https://www.npmjs.com/package/date-fns) | 4.4.0 | MIT | app |
| [dotenv](https://www.npmjs.com/package/dotenv) | 18.0.8 | BSD-2-Clause | server |
| [drizzle-orm](https://www.npmjs.com/package/drizzle-orm) | 0.45.4 | Apache-2.0 | server |
| [framer-motion](https://www.npmjs.com/package/framer-motion) | 14.3.0 | MIT | app |
| [hono](https://www.npmjs.com/package/hono) | 4.13.13 | MIT | server |
| [jose](https://www.npmjs.com/package/jose) | 6.2.12 | MIT | transitive |
| [katex](https://www.npmjs.com/package/katex) | 0.19.0 | MIT | app |
| [lucide-react](https://www.npmjs.com/package/lucide-react) | 1.57.0 | ISC | app |
| [nanoid](https://www.npmjs.com/package/nanoid) | 6.0.2 | MIT | server |
| [next](https://www.npmjs.com/package/next) | 16.4.3 | MIT | app |
| [pg](https://www.npmjs.com/package/pg) | 8.23.1 | MIT | server |
| [pino](https://www.npmjs.com/package/pino) | 10.4.0 | MIT | server |
| [react](https://www.npmjs.com/package/react) | 19.3.1 | MIT | app |
| [react-dom](https://www.npmjs.com/package/react-dom) | 19.3.1 | MIT | app |
| [react-markdown](https://www.npmjs.com/package/react-markdown) | 10.1.0 | MIT | app |
| [recharts](https://www.npmjs.com/package/recharts) | 3.10.1 | MIT | app |
| [rehype-katex](https://www.npmjs.com/package/rehype-katex) | 7.0.1 | MIT | app |
| [remark-gfm](https://www.npmjs.com/package/remark-gfm) | 4.0.1 | MIT | app |
| [remark-math](https://www.npmjs.com/package/remark-math) | 6.0.0 | MIT | app |
| [siwe](https://www.npmjs.com/package/siwe) | 3.0.0 | Apache-2.0 | app |
| [thinking-orbs](https://www.npmjs.com/package/thinking-orbs) | 0.3.2 | MIT | app |
| [undici](https://www.npmjs.com/package/undici) | 8.12.2 | MIT | transitive |
| [viem](https://www.npmjs.com/package/viem) | 2.57.7 | MIT | app, server |
| [zod](https://www.npmjs.com/package/zod) | 4.6.7 | MIT | app, server |

## Development tooling

| Package | Installed version | License declared by package | Used by |
| --- | --- | --- | --- |
| [@eslint/js](https://www.npmjs.com/package/@eslint/js) | 10.0.1 | MIT | server |
| [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer) | 16.4.3 | MIT | app |
| [@next/eslint-plugin-next](https://www.npmjs.com/package/@next/eslint-plugin-next) | 16.4.3 | MIT | app |
| [@playwright/test](https://www.npmjs.com/package/@playwright/test) | 1.64.1 | Apache-2.0 | app |
| [@tailwindcss/postcss](https://www.npmjs.com/package/@tailwindcss/postcss) | 4.3.3 | MIT | app |
| [@testing-library/jest-dom](https://www.npmjs.com/package/@testing-library/jest-dom) | 7.0.1 | MIT | app |
| [@testing-library/react](https://www.npmjs.com/package/@testing-library/react) | 16.3.3 | MIT | app |
| [@types/node](https://www.npmjs.com/package/@types/node) | 24.19.2 | MIT | app, server |
| [@types/pg](https://www.npmjs.com/package/@types/pg) | 8.23.1 | MIT | server |
| [@types/react](https://www.npmjs.com/package/@types/react) | 19.3.0 | MIT | app |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom) | 19.3.0 | MIT | app |
| [@typescript-eslint/eslint-plugin](https://www.npmjs.com/package/@typescript-eslint/eslint-plugin) | 8.71.2 | MIT | app |
| [@typescript-eslint/parser](https://www.npmjs.com/package/@typescript-eslint/parser) | 8.71.2 | MIT | app |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | 6.1.2 | MIT | app |
| [drizzle-kit](https://www.npmjs.com/package/drizzle-kit) | 0.31.11 | MIT | server |
| [eslint](https://www.npmjs.com/package/eslint) | 10.12.0 | MIT | app, server |
| [eslint-plugin-react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks) | 7.1.1 | MIT | root tooling |
| [globals](https://www.npmjs.com/package/globals) | 17.13.0 | MIT | server |
| [jsdom](https://www.npmjs.com/package/jsdom) | 30.1.3 | MIT | app |
| [pino-pretty](https://www.npmjs.com/package/pino-pretty) | 13.2.0 | MIT | server |
| [sharp](https://www.npmjs.com/package/sharp) | 0.35.5 | Apache-2.0 | app |
| [tailwindcss](https://www.npmjs.com/package/tailwindcss) | 4.3.3 | MIT | app |
| [tsx](https://www.npmjs.com/package/tsx) | 4.23.15 | MIT | server |
| [typescript](https://www.npmjs.com/package/typescript) | 6.0.3 | Apache-2.0 | root tooling, app, server |
| [typescript-eslint](https://www.npmjs.com/package/typescript-eslint) | 8.71.2 | MIT | server |
| [vite](https://www.npmjs.com/package/vite) | 8.2.4 | MIT | root tooling |
| [vitest](https://www.npmjs.com/package/vitest) | 5.0.5 | MIT | app, server |

## Pinned upstream license sources

- [drizzle-orm@0.45.4](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/0.45.4/LICENSE)
- [rehype-katex@7.0.1](https://raw.githubusercontent.com/remarkjs/remark-math/88a9497e1ede93b958237c85edbf5651faeca7af/license)
- [remark-math@6.0.0](https://raw.githubusercontent.com/remarkjs/remark-math/d5d0660b150810a535bbb07eac6cc96a4510aa24/license)
- [siwe@3.0.0](https://raw.githubusercontent.com/spruceid/siwe/7b7bb4fc4c74d9e53103e1c987869880c03eb5f5/LICENSE-APACHE)
