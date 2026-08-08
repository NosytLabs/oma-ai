const fs = require('fs');
let f5 = '/Users/tyson/Desktop/Code/products/OMA-AI/server/src/tracing.ts';
let c5 = fs.readFileSync(f5, 'utf8');
const lines = c5.split('\n');
const filtered = lines.filter((_, i) => i < 73 || i > 87); // Drop the definition
fs.writeFileSync(f5, filtered.join('\n'));
