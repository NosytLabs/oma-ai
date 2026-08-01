import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGE: ' + String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('CONS: ' + m.text().slice(0, 200)); });

const apiCalls = [];
page.on('response', r => {
  if (r.url().includes('/v1/admin/')) apiCalls.push(`${r.status()} ${r.url()}`);
});

console.log('1. Login as tyson@nosytlabs.com');
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'tyson@nosytlabs.com');
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);

console.log('2. Visit /admin');
await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

console.log('3. Click "Promote me to admin"');
const promoteBtn = await page.$('button:has-text("Promote me")');
if (promoteBtn) {
  await promoteBtn.click();
  await page.waitForTimeout(3000);
} else {
  console.log('   no promote button');
}

console.log('4. /admin after promote');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const admin = await page.evaluate(() => {
  const h1 = document.querySelector('h1')?.textContent.trim() || 'NO H1';
  const h2s = [...document.querySelectorAll('h2')].map(h => h.textContent.trim().slice(0, 60)).slice(0, 10);
  const buttons = [...document.querySelectorAll('button')].map(b => b.textContent.trim().slice(0, 40)).slice(0, 15);
  const inputs = [...document.querySelectorAll('input')].map(i => ({ type: i.type, placeholder: i.placeholder })).slice(0, 6);
  const userRows = document.querySelectorAll('table tbody tr, [data-user-row]').length;
  return { h1, h2s, buttons, inputs, userRows };
});
console.log('   h1:', admin.h1);
console.log('   h2s:', admin.h2s);
console.log('   buttons:', admin.buttons);
console.log('   inputs:', admin.inputs);
console.log('   user rows visible:', admin.userRows);

console.log('\nAPI calls:');
apiCalls.forEach(c => console.log('  ', c));

console.log('\nErrors:', errs.length, errs.slice(0, 3).join(' | ').slice(0, 300));
await browser.close();
