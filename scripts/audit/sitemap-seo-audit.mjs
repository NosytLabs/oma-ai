import fs from "fs";
import { parseStringPromise } from "xml2js";

async function auditSitemap() {
  console.log("Checking sitemap layout and routes...");
  const res = await fetch("http://localhost:3006/sitemap.xml");
  const xml = await res.text();
  
  parseStringPromise(xml).then(result => {
    const urls = result.urlset.url;
    console.log(`Sitemap contains ${urls.length} total links.`);
    
    const staleModels = urls.filter(u => u.loc[0].includes('minimax') || u.loc[0].includes('kimi-k2.6') || u.loc[0].includes('claude-opus-5'));
    if (staleModels.length > 0) {
      console.log(`[FAIL] Found stale/purged models in sitemap: ${staleModels.map(u => u.loc[0]).join(', ')}`);
    } else {
      console.log("[PASS] No stale purged models in sitemap.");
    }

    const goodModels = urls.filter(u => u.loc[0].includes('gemini-3-flash') || u.loc[0].includes('kimi-k3'));
    if (goodModels.length === 0) {
      console.log("[FAIL] New active models are MISSING from sitemap.");
    } else {
      console.log(`[PASS] New active models properly rendered in sitemap (${goodModels.length} found).`);
    }
  }).catch(e => {
    console.error("XML parse error", e);
  });
}

auditSitemap();
