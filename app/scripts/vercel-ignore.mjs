#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const rootBuildFiles = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  '.nvmrc',
  'vercel.json',
]);
// Files imported by the frontend from the server workspace, including the
// OpenAPI spec's transitive origin-guard dependency.
const sharedBuildFiles = new Set([
  'server/src/inference/model-catalog.json',
  'server/src/inference/api-limits.json',
  'server/src/middleware/rate-limit/model-limits.json',
  'server/src/routes/openapi-spec.ts',
  'server/src/middleware/origin-guard-paths.json',
]);

export function shouldBuild(base, runGit = spawnSync) {
  if (!/^[0-9a-f]{7,40}$/i.test(base || '')) return true;

  const root = runGit('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (root.status !== 0 || !root.stdout?.trim()) return true;

  const diff = runGit('git', ['-C', root.stdout.trim(), 'diff', '--name-only', '-z', base, 'HEAD'], { encoding: 'utf8' });
  if (diff.status !== 0 || typeof diff.stdout !== 'string') return true;

  return diff.stdout.split('\0').filter(Boolean).some(
    (path) => path.startsWith('app/') || path.startsWith('patches/') ||
      rootBuildFiles.has(path) || sharedBuildFiles.has(path),
  );
}

// Vercel: exit 0 = ignore build, exit 1 = continue build.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(shouldBuild(process.env.VERCEL_GIT_PREVIOUS_SHA) ? 1 : 0);
}
