// Builds the sanitized HTML summary from a Newman JSON export:
//   node docs/postman/tools/report.mjs <newman-run.json> <out.html>
// Only counts and request names are written — no bodies, headers, tokens or user data.
import fs from 'node:fs';

const [, , input, output] = process.argv;
const run = JSON.parse(fs.readFileSync(input, 'utf8')).run;
const collection = JSON.parse(fs.readFileSync(new URL('../JazzLMS.postman_collection.json', import.meta.url), 'utf8'));

// map request name -> top-level folder
const folderOf = new Map();
const walk = (items, top) => items.forEach(i => (i.item ? walk(i.item, top || i.name) : folderOf.set(i.name, top)));
walk(collection.item);

const byFolder = new Map();
for (const e of run.executions) {
  const top = folderOf.get(e.item.name) || '(unknown)';
  const row = byFolder.get(top) || { requests: 0, assertions: 0, failed: 0 };
  row.requests++;
  for (const a of e.assertions || []) { row.assertions++; if (a.error) row.failed++; }
  byFolder.set(top, row);
}
const s = run.stats;
const esc = (x) => String(x).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const rows = [...byFolder].map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.requests}</td><td>${v.assertions}</td><td class="${v.failed ? 'warn' : 'pass'}">${v.failed}</td></tr>`).join('');
const failures = run.failures.length;
const iterations = s.iterations.total;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>JazzLMS API acceptance report · Aziret</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:920px;margin:3rem auto;padding:0 1rem;color:#17202a}h1{line-height:1.2}table{border-collapse:collapse;width:100%;margin:1rem 0 2rem}th,td{border:1px solid #ccd2d8;padding:.65rem;text-align:left}th{background:#f3f5f7}.pass{color:#137333;font-weight:700}.warn{color:#9b4d00;font-weight:700}small{color:#58636e}</style><h1>JazzLMS API acceptance report</h1><p>Owner: Aziret · Run: ${new Date(run.timings.started).toISOString().slice(0, 10)}</p><h2>Result</h2><p class="${failures ? 'warn' : 'pass'}">${failures ? 'FAIL' : 'PASS'} — ${iterations} iterations, ${s.requests.total} requests, ${s.assertions.total.toLocaleString('en')} assertions, ${s.assertions.failed} failures.</p><p>Folders run each iteration: 00 Setup, 06 Security (N1–N8 and the full matrix), 07 E2E (E2E-1…7 plus 3b–7b), the three 08 Checks folders and 99 Teardown. The 09 Known defects folder is excluded; it holds the spec-expected result of each defect listed in API_TEST_FINDINGS.md and fails by design.</p><h2>Per folder (all iterations)</h2><table><tr><th>Folder</th><th>Requests</th><th>Assertions</th><th>Failed</th></tr>${rows}</table><small>This report contains aggregate counts and folder names only. It does not include credentials, JWTs, response bodies, or user data.</small></html>`;
fs.writeFileSync(output, html);
console.log('wrote', output, 'iterations', iterations, 'failures', failures);
