import { group, t } from '../lib.mjs';

const SERVICES = [
  ['userSvc', '/api/users'],
  ['courseSvc', '/api/courses'],
  ['notifSvc', '/api/notifications'],
  ['analyticsSvc', '/api/analytics/summary'],
  ['gameSvc', '/api/gamification/me'],
];

const B64 = "const b64u=x=>btoa(x).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');const dec=x=>atob(x.replace(/-/g,'+').replace(/_/g,'/'));";
const sign = (secretExpr, payloadMods) => `${B64}
const adm=JSON.parse(dec(pm.environment.get('adminToken').split('.')[1]));const now=Math.floor(Date.now()/1000);
const pl=Object.assign({},adm,${payloadMods});
const hd=b64u(JSON.stringify({alg:'HS384'}));const body=hd+'.'+b64u(JSON.stringify(pl));
const sig=CryptoJS.HmacSHA384(body,${secretExpr}).toString(CryptoJS.enc.Base64).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
pm.environment.set('k_jwt',body+'.'+sig);`;

export default function build() {
  return group('06 Security · matrix · Aziret', () => {
    t('SEC-00a', 'init run suffix', { p: '/api/auth/settings', as: 'none', pre: "pm.environment.set('k_ts',String(Date.now()));" });
    t('SEC-00b', 'second trainer', { m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Sec', lastName: 'Trainer', email: 'k_si2_{{k_ts}}@example.test', username: 'k_si2_{{k_ts}}', password: 'Aziret123!', userType: 'TRAINER' }, save: { k_si2: 'd.id' } });
    t('SEC-00c', 'second trainer logs in', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_si2_{{k_ts}}', password: 'Aziret123!' }, save: { k_si2tok: 'd.token' } });
    t('SEC-00d', 'course owned by the Setup instructor', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-sec-q-{{k_ts}}' }, save: { k_sq: 'd.id' } });
    t('SEC-00e', 'a question', { m: 'POST', p: '/api/courses/{{k_sq}}/questions', as: 'instructor', s: 201, body: { type: 'MULTIPLE_CHOICE', text: 'sq', data: { answers: [{ text: 'a', correct: true }, { text: 'b', correct: false }] } }, save: { k_sqq: 'd.id' } });
    t('SEC-00f', 'a test', { m: 'POST', p: '/api/courses/{{k_sq}}/tests', as: 'instructor', s: 201, body: { name: 'k-sec-test', questions: [{ questionId: '{{k_sqq}}', weight: 1 }] }, save: { k_stu: 'd.unitId' } });
    t('SEC-00g', 'enroll the Setup learner', { m: 'POST', p: '/api/courses/{{k_sq}}/enrollments', s: 201, body: { userId: '{{learnerId}}' } });
    t('SEC-00h', 'course owned by the second trainer', { m: 'POST', p: '/api/courses', as: '{{k_si2tok}}', s: 201, body: { name: 'k-sec-e-{{k_ts}}' }, save: { k_se: 'd.id' } });

    group('SEC-01 · direct access to the service ports', () => {
      for (const [svc, path] of SERVICES) {
        const b = `{{${svc}}}`;
        t(`SEC-01-${svc}-none`, `${svc}: no token`, { base: b, p: path, as: 'none', s: 401, type: 'none' });
        t(`SEC-01-${svc}-junk`, `${svc}: garbage token`, { base: b, p: path, as: 'Bearer abc.def.ghi', s: 401, type: 'none' });
        t(`SEC-01-${svc}-learner`, `${svc}: learner token`, { base: b, p: path, as: 'learner', s: 401, type: 'none' });
        t(`SEC-01-${svc}-instructor`, `${svc}: instructor token`, { base: b, p: path, as: 'instructor', s: 401, type: 'none' });
        t(`SEC-01-${svc}-admin`, `${svc}: admin token`, { base: b, p: path, as: 'admin', tests: "pm.test('served',()=>pm.expect(txt.length).to.be.above(1));" });
        t(`SEC-01-${svc}-health`, `${svc}: actuator health is public`, { base: b, p: '/actuator/health', as: 'none', tests: "pm.test('UP',()=>pm.expect(d.status).eql('UP'));" });
        t(`SEC-01-${svc}-swagger`, `${svc}: Swagger UI is public`, { base: b, p: '/swagger-ui/index.html', as: 'none', type: 'text/html', accept: 'text/html' });
      }
      t('SEC-01-login', 'direct login stays public', { base: '{{userSvc}}', m: 'POST', p: '/api/auth/login', as: 'none', body: { username: '{{adminUsername}}', password: '{{adminPassword}}' } });
    });

    group('SEC-02 · header spoofing', () => {
      t('SEC-02a', 'direct call with X-User-Role: SUPER_ADMIN and no token', { base: '{{userSvc}}', p: '/api/users', as: 'none', s: 401, type: 'none', h: { 'X-User-Role': 'SUPER_ADMIN', 'X-User-Id': '{{adminId}}' } });
      t('SEC-02b', 'gateway: learner + X-User-Role SUPER_ADMIN', { p: '/api/users', as: 'learner', s: 403, type: 'none', h: { 'X-User-Role': 'SUPER_ADMIN' } });
      t('SEC-02c', 'gateway: learner + X-User-Id of the admin', { p: '/api/auth/me', as: 'learner', h: { 'X-User-Id': '{{adminId}}' }, tests: "pm.test('own identity',()=>pm.expect(d.id).eql(env('learnerId')));" });
      t('SEC-02d', 'direct learner + guessed X-Gateway-Token', { base: '{{userSvc}}', p: '/api/users', as: 'learner', s: 401, type: 'none', h: { 'X-Gateway-Token': 'guess' } });
    });

    group('SEC-03 · token handling', () => {
      t('SEC-03a', 'payload edited (role → SUPER_ADMIN), signature kept', {
        p: '/api/users', as: 'Bearer {{k_jwt}}', s: 401, type: 'none',
        pre: `${B64}const tk=pm.environment.get('learnerToken').split('.');const pl=JSON.parse(dec(tk[1]));pl.role='SUPER_ADMIN';pm.environment.set('k_jwt',tk[0]+'.'+b64u(JSON.stringify(pl))+'.'+tk[2]);`,
      });
      t('SEC-03b', 'validly shaped token signed with another secret', {
        p: '/api/users', as: 'Bearer {{k_jwt}}', s: 401, type: 'none',
        pre: sign("'another-secret-another-secret-another-secret-1234567890'", '{iat:now,exp:now+3600}'),
      });
      t('SEC-03c', 'Authorization: Basic', { p: '/api/users', as: 'Basic YWRtaW46YWRtaW4xMjM=', s: 401, type: 'none' });
      t('SEC-03d', 'lowercase "bearer" scheme is rejected (recorded)', { p: '/api/users', as: 'bearer {{adminToken}}', s: 401, type: 'none' });
      t('SEC-03e', 'correctly signed but expired token (needs jwtSecret)', {
        p: '/api/users', as: 'Bearer {{k_jwt}}', s: 401, type: 'none',
        pre: `if(!pm.environment.get('jwtSecret')){pm.execution.skipRequest();}else{${sign("pm.environment.get('jwtSecret')", '{iat:now-40000,exp:now-3600}')}}`,
      });
      t('SEC-03f', 'CORS preflight needs no token', {
        m: 'OPTIONS', p: '/api/courses', as: 'none', s: 200, type: 'none',
        h: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'GET' },
      });
    });

    group('SEC-04 · role matrix through the gateway', () => {
      const row = (id, m, path, [l, i, a], o = {}) => {
        for (const [role, s] of [['learner', l], ['instructor', i], ['admin', a]]) {
          t(`SEC-04-${id}-${role}`, `${m} ${path.split('?')[0].replace(/\{\{[^}]+\}\}/g, '{id}')} as ${role}`, {
            m, p: path, as: role, s, type: s === 403 ? 'none' : undefined,
            body: o.body && o.body(role), save: o.save && o.save(role),
            ...(s === 403 ? {} : (o.ok || {})),
          });
        }
      };
      const user = (role) => ({ firstName: 'Sec', lastName: 'Row', email: `k_srow_${role}_{{k_ts}}@example.test`, username: `k_srow_${role}_{{k_ts}}`, password: 'Aziret123!' });
      row('01', 'GET', '/api/users', [403, 200, 200]);
      row('02', 'POST', '/api/users', [403, 403, 201], { body: user, save: (r) => ({ k_srowU: 'd.id' }) });
      row('03', 'GET', '/api/settings', [403, 403, 200]);
      row('04', 'POST', '/api/branches', [403, 403, 201], { body: () => ({ name: 'k-sec-branch-{{k_ts}}' }), save: () => ({ k_srowB: 'd.id' }) });
      row('05', 'GET', '/api/branches', [403, 200, 200]);
      row('06', 'POST', '/api/courses', [403, 201, 201], { body: (r) => ({ name: `k-sec-row-${r}-{{k_ts}}` }), save: (r) => ({ [`k_srowC_${r}`]: 'd.id' }) });
      row('07', 'GET', '/api/courses', [200, 200, 200]);
      row('08', 'POST', '/api/courses/{{k_se}}/enroll', [201, 201, 201]);
      row('09', 'GET', '/api/courses/deleted', [403, 403, 200]);
      row('10', 'GET', '/api/courses/{{k_sq}}/questions', [403, 200, 200]);
      row('11', 'POST', '/api/units/{{k_stu}}/test/attempts', [201, 201, 201]);
      row('12', 'GET', '/api/notifications', [403, 403, 200]);
      row('13', 'GET', '/api/analytics/timeline', [403, 200, 200]);
      row('14', 'GET', '/api/gamification/settings', [403, 403, 200]);
      row('15', 'GET', '/api/gamification/me', [200, 200, 200]);
      row('16', 'GET', '/api/certificates/templates', [403, 200, 200]);
      row('17', 'POST', '/api/certificates/templates', [403, 403, 201], { body: () => ({ name: 'k-sec-tpl-{{k_ts}}', background: 'classic', title: 'T', body: 'B' }), save: () => ({ k_srowT: 'd.id' }) });
    });

    group('SEC-05/06 · rate limit and unknown paths', () => {
      t('SEC-05a', 'burst of 60 GETs with one learner token → some 429', {
        p: '/api/courses', as: 'learner',
        tests: `const url=env('baseUrl')+'/api/courses';const tok=env('learnerToken');let seen=0,tooMany=0,ok=0;
for(let n=0;n<60;n++){pm.sendRequest({url:url,method:'GET',header:{Authorization:'Bearer '+tok}},(e,r)=>{seen++;if(r&&r.code===429)tooMany++;if(r&&r.code===200)ok++;if(seen===60){pm.test('throttled at least once',()=>pm.expect(tooMany).to.be.at.least(1));pm.test('and served the rest',()=>pm.expect(ok).to.be.at.least(1))}})}`,
      });
      t('SEC-05b', 'bucket refills after a pause', { p: '/api/courses', as: 'learner', delay: 3000 });
      t('SEC-06a', 'unknown path with token → 404', { p: '/api/nothing', s: 404, type: 'none' });
      t('SEC-06b', 'unknown path without token → 404 (recorded, see DEF-GW-03)', { p: '/api/nothing', as: 'none', s: 404, type: 'none' });
    });

    group('SEC-99 · cleanup', () => {
      const del = (id, title, path) => t(id, title, { m: 'DELETE', p: path, s: 204 });
      del('SEC-99a', 'fixture user created by the matrix', '/api/users/{{k_srowU}}');
      del('SEC-99b', 'fixture branch', '/api/branches/{{k_srowB}}');
      del('SEC-99c', 'fixture template', '/api/certificates/templates/{{k_srowT}}');
      for (const v of ['k_srowC_instructor', 'k_srowC_admin', 'k_sq', 'k_se']) {
        del(`SEC-99d-${v}`, `soft-delete ${v}`, `/api/courses/{{${v}}}`);
        del(`SEC-99e-${v}`, `purge ${v}`, `/api/courses/{{${v}}}/permanent`);
      }
      del('SEC-99f', 'second trainer', '/api/users/{{k_si2}}');
    });
  });
}
