#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.join(__dirname, 'vulnerability-report.json');

function runAudit() {
  console.log('[vuln-monitor] Running npm audit...\n');
  
  return new Promise((resolve, reject) => {
    const output = [];
    const proc = spawn('npm', ['audit', '--json'], {
      cwd: __dirname,
      shell: true,
      windowsHide: true
    });
    
    proc.stdout.on('data', (data) => output.push(data.toString()));
    
    proc.on('close', (code) => {
      try {
        const result = JSON.parse(output.join(''));
        
        const vulnData = result.metadata?.vulnerabilities || {};
        const depsData = result.metadata?.dependencies || {};
        
        const report = {
          timestamp: new Date().toISOString(),
          summary: {
            totalDependencies: depsData.total || 0,
            ...vulnData
          },
          vulnerabilities: result.vulnerabilities || {}
        };
        
        fs.writeFileSync(AUDIT_FILE, JSON.stringify(report, null, 2));
        
        const total = depsData.total || 0;
        const vulnCount = vulnData.total || 0;
        
        console.log(`[vuln-monitor] Report saved to ${AUDIT_FILE}`);
        console.log(`\n=== Vulnerability Summary ===`);
        console.log(`Total vulnerabilities: ${vulnCount}`);
        console.log(`Total dependencies: ${total}`);
        console.log('');
        
        const severityLevels = ['critical', 'high', 'moderate', 'low'];
        for (const level of severityLevels) {
          const count = vulnData[level] || 0;
          if (count > 0) {
            console.log(`  ${level.toUpperCase()}: ${count}`);
            const vulns = report.vulnerabilities[level] || [];
            if (Array.isArray(vulns)) {
              vulns.slice(0, 5).forEach(v => console.log(`    - ${v.name}@${v.range}`));
              if (vulns.length > 5) console.log(`    ... and ${vulns.length - 5} more`);
            }
          }
        }
        
        if (vulnCount > 0) {
          console.log('\n[!] Vulnerabilities detected - review required');
        } else {
          console.log('\n[+] No vulnerabilities found!');
        }
        
        resolve(report);
      } catch (error) {
        console.error('[vuln-monitor] Failed:', error.message);
        reject(error);
      }
    });
    
    proc.on('error', (error) => {
      console.error('[vuln-monitor] Process error:', error.message);
      reject(error);
    });
  });
}

async function main() {
  let prevCount = 0;
  
  if (fs.existsSync(AUDIT_FILE)) {
    try {
      const prev = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
      const prevVuln = prev.summary?.total || 0;
      console.log(`[vuln-monitor] Previous scan: ${prevVuln} vulnerabilities\n`);
      prevCount = prevVuln;
    } catch (e) {}
  }
  
  const current = await runAudit();
  const currentCount = current.summary?.total || 0;
  
  if (prevCount > 0 && currentCount > prevCount) {
    console.log(`\n[!] WARNING: Vulnerabilities increased from ${prevCount} to ${currentCount}`);
    process.exit(2);
  }
  
  if (currentCount < prevCount && prevCount > 0) {
    console.log(`\n[+] IMPROVED: Vulnerabilities decreased from ${prevCount} to ${currentCount}`);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});