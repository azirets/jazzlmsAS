// Regenerates the check folders inside JazzLMS.postman_collection.json.
//   node docs/postman/tools/build-checks.mjs
// Hand-written folders (00 Setup, 01-05 Swagger operations, 06 Security N1-N8, 07 E2E, 99 Teardown)
// are left untouched; only the folders listed in GENERATED are replaced.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resetRoot, count } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, '..', 'JazzLMS.postman_collection.json');
const col = JSON.parse(fs.readFileSync(file, 'utf8'));

const GENERATED = [/^08 Checks/, /^09 Known defects/, /^06 Security · matrix/];
col.item = col.item.filter(i => !GENERATED.some(re => re.test(i.name)));

// Shared test script: allow `expectedType = none` (gateway 401/403 with no body), JSON error bodies
// (`expectOkBody`) and 3xx responses without changing behaviour for the existing requests.
const ev = col.event.find(e => e.listen === 'test');
let script = ev.script.exec.join('\n');
if (!script.includes('expectOkBody')) {
  const needle = "}else if(expected>=200&&expected<300){pm.test('Expected Content-Type '";
  const anchor = "pm.test('Expected HTTP '+expected,()=>pm.response.to.have.status(expected));";
  if (!script.includes(needle) || !script.includes(anchor)) throw new Error('collection test script changed; update build-checks.mjs');
  script = script.replace(needle, "}else if((expected>=200&&expected<400)||okBody){pm.test('Expected Content-Type '");
  script = script.replace(anchor, anchor + "pm.test('Response time < 1500ms',()=>pm.expect(pm.response.responseTime).below(1500));if(expectedType==='none'){if(expected===204)pm.test('204 body is empty',()=>pm.expect(pm.response.text()).eql(''));return;}");
  script = "const okBody=pm.environment.get('expectOkBody')==='1';pm.environment.unset('expectOkBody');" + script;
  // the original also asserts latency after the status check; drop our early duplicate for non-none requests
  script = script.replace(anchor + "pm.test('Response time < 1500ms',()=>pm.expect(pm.response.responseTime).below(1500));if(expectedType==='none')", anchor + "if(expectedType==='none'){pm.test('Response time < 1500ms',()=>pm.expect(pm.response.responseTime).below(1500));}if(expectedType==='none')");
  ev.script.exec = [script];
}

const modules = ['user', 'course', 'platform', 'defects'];
const folders = [];
for (const m of modules) {
  const f = path.join(here, 'checks', m + '.mjs');
  if (!fs.existsSync(f)) continue;
  resetRoot();
  const mod = await import(pathToUrl(f));
  folders.push(mod.default());
}
if (fs.existsSync(path.join(here, 'checks', 'security.mjs'))) {
  resetRoot();
  folders.push((await import(pathToUrl(path.join(here, 'checks', 'security.mjs')))).default());
}

// extra E2E scenarios go inside the existing 07 E2E folder
const e2eFolder = col.item.find(i => i.name.startsWith('07 E2E'));
e2eFolder.item = e2eFolder.item.filter(i => !/^E2E-d+b ·/.test(i.name));
if (fs.existsSync(path.join(here, 'checks', 'e2e.mjs'))) {
  const root = resetRoot();
  (await import(pathToUrl(path.join(here, 'checks', 'e2e.mjs')))).default();
  e2eFolder.item.push(...root);
  console.log('07 E2E extra scenarios'.padEnd(48), count(root), 'requests');
}

const at = col.item.findIndex(i => i.name.startsWith('99 Teardown'));
col.item.splice(at < 0 ? col.item.length : at, 0, ...folders);
fs.writeFileSync(file, JSON.stringify(col, null, 2) + '\n');
for (const f of folders) console.log(f.name.padEnd(48), count(f.item), 'requests');

function pathToUrl(p) { return pathToFileURL(p).href; }
