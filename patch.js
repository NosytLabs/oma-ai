const fs = require('fs');
const path = require('path');
const p = path.join(process.env.HOME, 'Desktop/Code/products/OMA-AI/server/src/routes/chat/index.ts');
let code = fs.readFileSync(p, 'utf8');

// The try block starts AT 'if (userId && !isFreeWebsiteChat)'. We can move it UP to wrap idempotency as well.
code = code.replace(`
    if (idempotencyKey && userId) {
      const prior = await db
        .select()
        .from(usageRecords)
        .where(
          and(
            eq(usageRecords.userId, userId),
            eq(usageRecords.requestId, requestId),
            eq(usageRecords.status, "completed"),
          ),
        )
        .limit(1);`, `
    try {
      if (idempotencyKey && userId) {
        const prior = await db
          .select()
          .from(usageRecords)
          .where(
            and(
              eq(usageRecords.userId, userId),
              eq(usageRecords.requestId, requestId),
              eq(usageRecords.status, "completed"),
            ),
          )
          .limit(1);`);

// And remove the existing try {
code = code.replace(`
    const promptTokens = estimateTokens(promptText);

    // Fail before calling an upstream provider when an authenticated request
    // has no usable credit balance. The ledger remains the final atomic guard
    // after the provider returns, but this avoids serving obviously unpaid
    // requests and gives the client a useful 402 response.
    try {
      if (userId && !isFreeWebsiteChat) {`, `
    const promptTokens = estimateTokens(promptText);

    // Fail before calling an upstream provider when an authenticated request
    // has no usable credit balance. The ledger remains the final atomic guard
    // after the provider returns, but this avoids serving obviously unpaid
    // requests and gives the client a useful 402 response.
    if (userId && !isFreeWebsiteChat) {`);

fs.writeFileSync(p, code);
