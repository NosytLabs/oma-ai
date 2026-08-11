/* eslint-disable no-console -- standalone example CLI script */
// Example usage: Print the audit & debug task tracking table
import { getAuditDebugTaskTable } from './index';

console.table(getAuditDebugTaskTable());
