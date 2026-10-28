// Small DSL that turns check tables into Postman v2.1 request items.
// The shared collection-level test script (status, latency, content type, Problem Details,
// no passwordHash) runs for every generated request; `tests` adds endpoint-specific assertions.

let cur = [];
const stack = [];

export function resetRoot() { cur = []; stack.length = 0; return cur; }

export function group(name, fn) {
  const folder = { name, item: [] };
  cur.push(folder);
  stack.push(cur);
  cur = folder.item;
  fn();
  cur = stack.pop();
  return folder;
}

const BEARER = { admin: '{{adminToken}}', instructor: '{{instructorToken}}', learner: '{{learnerToken}}' };

const POLL = `function poll(label,cond,tries){tries=tries||12;let n=Number(pm.environment.get('k_poll')||0);let ok=false;try{ok=!!cond()}catch(e){}if(!ok&&n<tries){pm.environment.set('k_poll',String(n+1));postman.setNextRequest(pm.info.requestName);return false}pm.environment.unset('k_poll');pm.test(label,()=>pm.expect(ok).to.eql(true));return true}`;

const HELPERS = `const d=(()=>{try{return pm.response.json()}catch(e){return undefined}})();const txt=pm.response.text();const code=pm.response.code;const hdr=n=>pm.response.headers.get(n);const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;const ISO=/^\\d{4}-\\d{2}-\\d{2}T/;const list=x=>Array.isArray(x)?x:((x&&(x.items||x.content))||[]);const env=k=>pm.environment.get(k);${POLL}`;

/**
 * t(id, title, opts)
 *  m  method (GET)            p  path incl. query, may contain {{vars}}
 *  as admin|instructor|learner|none|{{var}}|literal Authorization header value (default admin)
 *  body object -> JSON       raw string body        ct content-type override (null = send none)
 *  form [{key,value}|{key,src}]   h extra headers {k:v}
 *  s expected status (200)   type json|problem|none|<mime> (derived from s)
 *  pre / tests  extra JS     save {envVar: 'js expression over d'}
 *  noRedirect  do not follow redirects     delay ms before the request runs
 */
export function t(id, title, o = {}) {
  const m = o.m || 'GET';
  const s = o.s ?? 200;
  const okBody = o.type === 'json-error';
  const type = okBody ? 'application/json' : (o.type || (s === 204 ? 'none' : s >= 400 ? 'problem' : 'application/json'));
  const name = `${id} · ${m} ${o.p.split('?')[0]} · ${title} → ${s}`;

  const header = [{ key: 'Accept', value: o.accept || 'application/json' }];
  let body;
  if (o.form) {
    body = {
      mode: 'formdata',
      formdata: o.form.map(f => f.src
        ? { key: f.key, type: 'file', src: f.src, ...(f.contentType ? { contentType: f.contentType } : {}) }
        : { key: f.key, type: 'text', value: f.value, ...(f.contentType ? { contentType: f.contentType } : {}) }),
    };
  } else if (o.body !== undefined || o.raw !== undefined) {
    const raw = o.raw !== undefined ? o.raw : JSON.stringify(o.body, null, 2);
    body = { mode: 'raw', raw, options: { raw: { language: o.ct === 'text/plain' ? 'text' : 'json' } } };
    if (o.ct !== null) header.push({ key: 'Content-Type', value: o.ct || 'application/json' });
  }
  for (const [k, v] of Object.entries(o.h || {})) header.push({ key: k, value: v });

  const as = o.as ?? 'admin';
  let auth;
  if (as === 'none') auth = { type: 'noauth' };
  else if (BEARER[as]) auth = { type: 'bearer', bearer: [{ key: 'token', value: BEARER[as], type: 'string' }] };
  else if (as.startsWith('{{')) auth = { type: 'bearer', bearer: [{ key: 'token', value: as, type: 'string' }] };
  else { auth = { type: 'noauth' }; header.push({ key: 'Authorization', value: as }); }

  const request = { method: m, header, url: (o.base || '{{baseUrl}}') + o.p, auth };
  if (body) request.body = body;

  const pre = `pm.environment.set('expectedStatus','${s}');pm.environment.set('expectedType','${type}');pm.environment.set('captureId','');pm.environment.set('expectOkBody','${okBody ? 1 : 0}');`
    + (o.pre ? '\n' + o.pre : '')
    + (o.delay ? `\nsetTimeout(()=>{},${o.delay});` : '');
  const saves = Object.entries(o.save || {})
    .map(([k, expr]) => `if((code===${s}||code<300)&&d!==undefined){try{const v=(${expr});if(v!==undefined&&v!==null)pm.environment.set('${k}',String(v))}catch(e){}}`)
    .join('\n');
  const tests = HELPERS + '\n' + (o.tests || '') + '\n' + saves;

  const item = {
    name,
    request,
    event: [
      { listen: 'prerequest', script: { type: 'text/javascript', exec: pre.split('\n') } },
      { listen: 'test', script: { type: 'text/javascript', exec: tests.split('\n') } },
    ],
  };
  if (o.noRedirect || (s >= 300 && s < 400)) item.protocolProfileBehavior = { followRedirects: false };
  cur.push(item);
  return item;
}

/** Shorthand for a request that only exists to set up or clean up state; same shape as t(). */
export const fx = t;

export function count(items) {
  return items.reduce((n, i) => n + (i.item ? count(i.item) : 1), 0);
}
