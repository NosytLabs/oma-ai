import { readFileSync } from 'node:fs';

const file = readFileSync('.tmp/lh/home.json', 'utf8');
const data = JSON.parse(file);

const summary = {
  url: data.requestedUrl,
  fetchTime: data.fetchTime,
  categories: {},
  failingAudits: []
};

for (const [key, category] of Object.entries(data.categories)) {
  summary.categories[key] = {
    title: category.title,
    score: category.score
  };
}

for (const [key, audit] of Object.entries(data.audits)) {
  if (audit.score !== null && audit.score < 0.9) {
    let details = null;
    if (audit.details && audit.details.items && audit.details.items.length > 0) {
      details = audit.details.items.slice(0, 5).map(item => {
        // Strip out base64 images or massive data
        const cleanItem = { ...item };
        for (const k of Object.keys(cleanItem)) {
          if (typeof cleanItem[k] === 'string' && cleanItem[k].length > 500) {
            cleanItem[k] = cleanItem[k].slice(0, 500) + '...';
          }
        }
        return cleanItem;
      });
    }
    summary.failingAudits.push({
      id: audit.id,
      title: audit.title,
      score: audit.score,
      description: audit.description?.slice(0, 200),
      details: details
    });
  }
}

console.log(JSON.stringify(summary, null, 2));


