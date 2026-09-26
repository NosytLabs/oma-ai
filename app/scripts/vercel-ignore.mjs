#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const base = process.env.VERCEL_GIT_PREVIOUS_SHA || '';
if (!/^[0-9a-f]{7,40}$/i.test(base)) process.exit(1);

const gitRoot = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim();
if (!gitRoot) process.exit(1);

const diff = spawnSync('git', ['-C', gitRoot, 'diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' });
if (diff.status !== 0) process.exit(1);

const rootBuildFiles = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.npmrc',
  '.nvmrc',
]);
const changed = diff.stdout.split(/\r?\n/).filter(Boolean);
const affectsFrontend = changed.some(
  (path) => path.startsWith('app/') || rootBuildFiles.has(path),
);

// Vercel: exit 0 = ignore build, exit 1 = continue build.
process.exit(affectsFrontend ? 1 : 0);
