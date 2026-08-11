// TaskManager MCP Audit & Debugging Task Suite
// This file registers all major audit and debugging tasks for tracking/completion.

export interface AuditDebugTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export const auditDebugTasks: AuditDebugTask[] = [
  {
    id: 'axe-audit',
    name: 'Accessibility Audit',
    description: 'Run axe-core accessibility checks on all major pages.',
    status: 'pending',
  },
  {
    id: 'visual-audit',
    name: 'Visual Regression Audit',
    description: 'Capture screenshots and overflow metrics for UI validation.',
    status: 'pending',
  },
  {
    id: 'ux-audit',
    name: 'UX Audit',
    description: 'Authenticated UX captures for workflow and usability.',
    status: 'pending',
  },
  {
    id: 'validate-launch',
    name: 'Launch Validation',
    description: 'Pre-launch environment and config checks.',
    status: 'pending',
  },
  {
    id: 'deploy',
    name: 'Deployment Audit',
    description: 'VPS deploy helper and post-deploy verification.',
    status: 'pending',
  },
  {
    id: 'start-prod',
    name: 'Production Start Audit',
    description: 'Docker Compose production up/down/logs checks.',
    status: 'pending',
  },
  {
    id: 'neon-cost-check',
    name: 'Cost Check Audit',
    description: 'Database cost check for Neon hosting.',
    status: 'pending',
  },
  {
    id: 'blockchain-bootstrap',
    name: 'Blockchain Bootstrap Audit',
    description: 'Bootstrap blockchain environment and verify platform wallet.',
    status: 'pending',
  },
  {
    id: 'e2e-seed-user',
    name: 'E2E Seed User Audit',
    description: 'Seed-session dashboard smoke test for user flows.',
    status: 'pending',
  },
  {
    id: 'audit-logs',
    name: 'Audit Log Verification',
    description: 'Verify audit log entries for all tracked actions.',
    status: 'pending',
  },
  {
    id: 'typecheck-lint-test',
    name: 'Typecheck/Lint/Test',
    description: 'Run type checking, linting, and tests across app and server.',
    status: 'pending',
  }
];

export function getAuditDebugTaskTable(): AuditDebugTask[] {
  return auditDebugTasks;
}
