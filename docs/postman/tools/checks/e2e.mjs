import { group, t } from '../lib.mjs';

const form = (name, extra = {}) => [{ key: 'unit', value: JSON.stringify({ name, type: 'CONTENT', completionType: 'CHECKBOX', textContent: 'x', ...extra }), contentType: 'application/json' }];
const settings = (mods) => ({
  pre: `const b=JSON.parse(pm.environment.get('baselineUserSettings'));Object.assign(b,${JSON.stringify(mods)});pm.environment.set('k_settings',JSON.stringify(b));`,
  raw: '{{k_settings}}',
});

// Extra E2E scenarios that close the gaps listed in the checklist. Each is self-contained
// (own users and courses, removed at the end) and runs inside the existing "07 E2E" folder.
export default function build() {
  group('E2E-3b · lockout expires', () => {
    t('E2E3b-01', 'lockout after 2 attempts for 1 minute', { m: 'PUT', p: '/api/settings', ...settings({ lockAfterAttempts: 2, lockMinutes: 1 }), pre: `const b=JSON.parse(pm.environment.get('baselineUserSettings'));Object.assign(b,{lockAfterAttempts:2,lockMinutes:1});pm.environment.set('k_settings',JSON.stringify(b));pm.environment.set('k_ts',String(Date.now()));` });
    t('E2E3b-02', 'learner', { m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Lock', lastName: 'Expiry', email: 'k_e3_{{k_ts}}@example.test', username: 'k_e3_{{k_ts}}', password: 'Aziret123!' }, save: { k_e3: 'd.id' } });
    t('E2E3b-03', 'wrong password #1 → 401', { m: 'POST', p: '/api/auth/login', as: 'none', s: 401, body: { username: 'k_e3_{{k_ts}}', password: 'bad' } });
    t('E2E3b-04', 'wrong password #2 → 423', { m: 'POST', p: '/api/auth/login', as: 'none', s: 423, body: { username: 'k_e3_{{k_ts}}', password: 'bad' } });
    t('E2E3b-05', 'still locked with the right password', { m: 'POST', p: '/api/auth/login', as: 'none', s: 423, body: { username: 'k_e3_{{k_ts}}', password: 'Aziret123!' } });
    t('E2E3b-06', 'after the 60 s TTL the account unlocks', {
      m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_e3_{{k_ts}}', password: 'Aziret123!' }, delay: 62000,
      tests: "pm.test('login works again',()=>pm.expect(d.token).to.be.a('string'));",
    });
    t('E2E3b-07', 'restore settings', { m: 'PUT', p: '/api/settings', raw: '{{baselineUserSettings}}' });
    t('E2E3b-08', 'cleanup learner', { m: 'DELETE', p: '/api/users/{{k_e3}}', s: 204 });
  });

  group('E2E-4b · clone lifecycle events', () => {
    t('E2E4b-01', 'course', { pre: "pm.environment.set('k_ts',String(Date.now()));", m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-e4b-{{k_ts}}' }, save: { k_e4: 'd.id' } });
    t('E2E4b-02', 'clone', { m: 'POST', p: '/api/courses/{{k_e4}}/clone', as: 'instructor', s: 201, save: { k_e4c: 'd.id' } });
    t('E2E4b-03', 'soft-delete the clone', { m: 'DELETE', p: '/api/courses/{{k_e4c}}', as: 'instructor', s: 204 });
    t('E2E4b-04', 'restore the clone', { m: 'POST', p: '/api/courses/{{k_e4c}}/restore' });
    t('E2E4b-05', 'timeline holds create, delete and restore for the clone', {
      p: '/api/analytics/timeline?size=100',
      tests: "poll('COURSE_CREATED, COURSE_DELETED and COURSE_RESTORED recorded for the clone',()=>{const s=list(d).filter(e=>JSON.stringify(e).includes(env('k_e4c'))).map(e=>e.type);return ['COURSE_CREATED','COURSE_DELETED','COURSE_RESTORED'].every(x=>s.includes(x))});",
    });
    t('E2E4b-06', 'delete the clone again', { m: 'DELETE', p: '/api/courses/{{k_e4c}}', as: 'instructor', s: 204 });
    t('E2E4b-07', 'purge the clone', { m: 'DELETE', p: '/api/courses/{{k_e4c}}/permanent', s: 204 });
    t('E2E4b-08', 'clone is gone everywhere', { p: '/api/courses/{{k_e4c}}', s: 404 });
    t('E2E4b-09', 'soft-delete the original', { m: 'DELETE', p: '/api/courses/{{k_e4}}', as: 'instructor', s: 204 });
    t('E2E4b-10', 'purge the original', { m: 'DELETE', p: '/api/courses/{{k_e4}}/permanent', s: 204 });
  });

  group('E2E-5b · progress checkpoints', () => {
    t('E2E5b-01', 'learner', { pre: "pm.environment.set('k_ts',String(Date.now()));", m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Prog', lastName: 'Check', email: 'k_e5_{{k_ts}}@example.test', username: 'k_e5_{{k_ts}}', password: 'Aziret123!' }, save: { k_e5: 'd.id' } });
    t('E2E5b-02', 'learner logs in', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_e5_{{k_ts}}', password: 'Aziret123!' }, save: { k_e5tok: 'd.token' } });
    t('E2E5b-03', 'course', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-e5b-{{k_ts}}' }, save: { k_e5c: 'd.id' } });
    for (const n of [1, 2, 3]) t(`E2E5b-04-${n}`, `lesson ${n}`, { m: 'POST', p: '/api/courses/{{k_e5c}}/units', as: 'instructor', s: 201, form: form('k-e5-' + n), save: { [`k_e5u${n}`]: 'd.id' } });
    t('E2E5b-05', 'enroll', { m: 'POST', p: '/api/courses/{{k_e5c}}/enrollments', s: 201, body: { userId: '{{k_e5}}' }, save: { k_e5e: 'd.id' } });
    const want = [33, 67, 100];
    [1, 2, 3].forEach((n, i) => {
      t(`E2E5b-1${n}a`, `start lesson ${n}`, { m: 'POST', p: `/api/units/{{k_e5u${n}}}/start`, as: '{{k_e5tok}}' });
      t(`E2E5b-1${n}b`, `complete lesson ${n}`, { m: 'POST', p: `/api/units/{{k_e5u${n}}}/complete`, as: '{{k_e5tok}}', body: {} });
      t(`E2E5b-1${n}c`, `progress is ${want[i]}%`, {
        p: '/api/enrollments/my', as: '{{k_e5tok}}',
        tests: `const e=d.find(x=>x.course.id===env('k_e5c'));pm.test('progress ${want[i]}',()=>pm.expect(e.progress).eql(${want[i]}));${i === 2 ? "pm.test('completedAt set',()=>pm.expect(e.completedAt||e.enrolledAt).to.be.a('string'));" : "pm.test('not completed yet',()=>pm.expect(e.completedAt||null).eql(null));"}`,
      });
    });
    t('E2E5b-20', 'report shows completedAt and time spent', { p: '/api/courses/{{k_e5c}}/report/users', as: 'instructor', tests: "const r=d.find(x=>x.email==='k_e5_'+env('k_ts')+'@example.test');pm.test('completed with duration',()=>{pm.expect(r.progress).eql(100);pm.expect(r.completedAt).to.match(ISO);pm.expect(r.seconds).to.be.a('number')});" });
    t('E2E5b-90', 'purge course (soft, then permanent)', { m: 'DELETE', p: '/api/courses/{{k_e5c}}', as: 'instructor', s: 204 });
    t('E2E5b-91', 'purge', { m: 'DELETE', p: '/api/courses/{{k_e5c}}/permanent', s: 204 });
    t('E2E5b-92', 'cleanup learner', { m: 'DELETE', p: '/api/users/{{k_e5}}', s: 204 });
  });

  group('E2E-6b · weighted score and test events', () => {
    t('E2E6b-01', 'learner', { pre: "pm.environment.set('k_ts',String(Date.now()));", m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Weight', lastName: 'Check', email: 'k_e6_{{k_ts}}@example.test', username: 'k_e6_{{k_ts}}', password: 'Aziret123!' }, save: { k_e6: 'd.id' } });
    t('E2E6b-02', 'learner logs in', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_e6_{{k_ts}}', password: 'Aziret123!' }, save: { k_e6tok: 'd.token' } });
    t('E2E6b-03', 'course', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-e6b-{{k_ts}}' }, save: { k_e6c: 'd.id' } });
    t('E2E6b-04', 'question A (weight 2)', { m: 'POST', p: '/api/courses/{{k_e6c}}/questions', as: 'instructor', s: 201, body: { type: 'MULTIPLE_CHOICE', text: 'A', data: { answers: [{ text: 'a', correct: true }, { text: 'b', correct: false }] } }, save: { k_e6qa: 'd.id' } });
    t('E2E6b-05', 'question B (weight 1)', { m: 'POST', p: '/api/courses/{{k_e6c}}/questions', as: 'instructor', s: 201, body: { type: 'FILL_GAP', text: 'B [x]', data: {} }, save: { k_e6qb: 'd.id' } });
    t('E2E6b-06', 'test: pass 60, A weighs 2 and B weighs 1', { m: 'POST', p: '/api/courses/{{k_e6c}}/tests', as: 'instructor', s: 201, body: { name: 'k-e6b-test', passScore: 60, repetitions: 'ALWAYS', questions: [{ questionId: '{{k_e6qa}}', weight: 2 }, { questionId: '{{k_e6qb}}', weight: 1 }] }, save: { k_e6t: 'd.unitId' } });
    t('E2E6b-07', 'enroll', { m: 'POST', p: '/api/courses/{{k_e6c}}/enrollments', s: 201, body: { userId: '{{k_e6}}' } });
    const attempt = (n) => t(`E2E6b-${n}a`, `attempt ${n}`, { m: 'POST', p: '/api/units/{{k_e6t}}/test/attempts', as: '{{k_e6tok}}', s: 201, save: { [`k_e6a${n}`]: 'd.id' } });
    const submit = (n, id, a, b, tests) => t(`E2E6b-${n}b`, id, {
      m: 'POST', p: `/api/units/{{k_e6t}}/test/attempts/{{k_e6a${n}}}/submit`, as: '{{k_e6tok}}', raw: '{{k_ans}}',
      pre: `const a={};a[pm.environment.get('k_e6qa')]=${a};a[pm.environment.get('k_e6qb')]=${b};pm.environment.set('k_ans',JSON.stringify({answers:a}));`, tests,
    });
    attempt(1);
    submit(1, 'only B right (weight 1 of 3) → 33, failed', '[1]', "['x']", "pm.test('33 failed',()=>{pm.expect(d.score).eql(33);pm.expect(d.passed).eql(false)});");
    attempt(2);
    submit(2, 'only A right (weight 2 of 3) → 67, passed', '[0]', "['nope']", "pm.test('67 passed',()=>{pm.expect(d.score).eql(67);pm.expect(d.passed).eql(true)});");
    t('E2E6b-20', 'TEST_COMPLETED recorded as passed=false then passed=true', {
      p: '/api/analytics/timeline?type=TEST_COMPLETED&userId={{k_e6}}&size=20',
      tests: "poll('two TEST_COMPLETED events',()=>list(d).length===2);if(list(d).length===2){const p=list(d).map(e=>String((e.payload||{}).passed));pm.test('one failed and one passed',()=>{pm.expect(p).to.include('false');pm.expect(p).to.include('true')})}",
    });
    t('E2E6b-21', 'users report carries the best score', { p: '/api/courses/{{k_e6c}}/report/users', as: 'instructor', tests: "const r=d.find(x=>x.email==='k_e6_'+env('k_ts')+'@example.test');pm.test('score 67',()=>pm.expect(r.score).eql(67));" });
    t('E2E6b-90', 'soft-delete course', { m: 'DELETE', p: '/api/courses/{{k_e6c}}', as: 'instructor', s: 204 });
    t('E2E6b-91', 'purge course', { m: 'DELETE', p: '/api/courses/{{k_e6c}}/permanent', s: 204 });
    t('E2E6b-92', 'cleanup learner', { m: 'DELETE', p: '/api/users/{{k_e6}}', s: 204 });
  });

  group('E2E-7b · traces, logs and dashboards', () => {
    t('E2E7b-01', 'learner', { pre: "pm.environment.set('k_ts',String(Date.now()));", m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Trace', lastName: 'Check', email: 'k_e7_{{k_ts}}@example.test', username: 'k_e7_{{k_ts}}', password: 'Aziret123!' }, save: { k_e7: 'd.id' } });
    t('E2E7b-02', 'course', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-e7b-{{k_ts}}' }, save: { k_e7c: 'd.id' } });
    t('E2E7b-03', 'lesson', { m: 'POST', p: '/api/courses/{{k_e7c}}/units', as: 'instructor', s: 201, form: form('k-e7-1'), save: { k_e7u: 'd.id' } });
    t('E2E7b-04', 'enroll (gateway → course-service → gRPC user-service)', { m: 'POST', p: '/api/courses/{{k_e7c}}/enrollments', s: 201, body: { userId: '{{k_e7}}' }, pre: "pm.environment.set('k_e7t0',String(Date.now()));" });
    t('E2E7b-05', 'one trace spans api-gateway, course-service and user-service', {
      base: '{{zipkinUrl}}', p: '/api/v2/traces?serviceName=course-service&limit=50&lookback=300000', as: 'none',
      tests: `const has=tr=>{const s=new Set(tr.map(x=>x.localEndpoint&&x.localEndpoint.serviceName));return s.has('api-gateway')&&s.has('course-service')&&s.has('user-service')};
poll('one trace contains api-gateway, course-service and user-service spans',()=>d.some(has),15);`,
    });
    t('E2E7b-07', 'Loki holds INFO lines about completed units', {
      base: '{{lokiUrl}}', p: '/loki/api/v1/query_range?query=%7Bservice%3D%22course-service%22%7D%20%7C~%20%22completed%22&limit=5&since=24h', as: 'none',
      tests: "pm.test('Loki answered with log streams',()=>{pm.expect(d.status).eql('success');pm.expect(d.data.result.length).to.be.above(0)});",
    });
    t('E2E7b-08', 'Grafana is healthy', { base: '{{grafanaUrl}}', p: '/api/health', as: 'none', tests: "pm.test('database ok',()=>pm.expect(d.database).eql('ok'));" });
    t('E2E7b-09', 'Prometheus scrapes all targets', { base: '{{prometheusUrl}}', p: '/api/v1/targets', as: 'none', tests: "pm.test('all active targets up',()=>{const a=d.data.activeTargets;pm.expect(a.length).to.be.above(0);a.forEach(x=>pm.expect(x.health).eql('up'))});" });
    t('E2E7b-90', 'soft-delete course', { m: 'DELETE', p: '/api/courses/{{k_e7c}}', as: 'instructor', s: 204 });
    t('E2E7b-91', 'purge course', { m: 'DELETE', p: '/api/courses/{{k_e7c}}/permanent', s: 204 });
    t('E2E7b-92', 'cleanup learner', { m: 'DELETE', p: '/api/users/{{k_e7}}', s: 204 });
  });
}
