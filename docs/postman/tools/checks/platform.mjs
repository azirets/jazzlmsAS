import { group, t } from '../lib.mjs';

const FX = 'docs/postman/fixtures/';
const unit = (name, extra = {}) => [{ key: 'unit', value: JSON.stringify({ name, type: 'CONTENT', completionType: 'CHECKBOX', textContent: 'x', ...extra }), contentType: 'application/json' }];
const rule = (mods) => ({ name: 'k-rule-{{k_ts}}', eventType: 'COURSE_COMPLETED', recipient: 'RELATED_USER', active: true, delayMinutes: 0, subjectTemplate: 'Subj {{courseName}}', bodyTemplate: 'Hi {{firstName}}', ...mods });
const hist = 'const h=(d&&d.history)||[];const acts=h.map(x=>x.action);';

function notifications() {
  return group('NTF · notification-service', () => {
    t('NTF-01a', 'event types', { p: '/api/notifications/events', tests: "pm.test('includes core events',()=>['USER_CREATED','USER_ENROLLED','COURSE_COMPLETED'].forEach(e=>pm.expect(d).to.include(e)));" });
    t('NTF-02a', 'recipient kinds', { p: '/api/notifications/recipients', tests: "pm.test('kinds',()=>['RELATED_USER','ACCOUNT_OWNER','COURSE_INSTRUCTORS'].forEach(e=>pm.expect(d).to.include(e)));" });
    t('NTF-03a', 'list rules', { p: '/api/notifications', tests: "pm.test('seeded rules (≥7) with fields',()=>{pm.expect(d.length).to.be.at.least(7);d.forEach(r=>['eventType','recipient','active','delayMinutes','subjectTemplate','bodyTemplate'].forEach(k=>pm.expect(r).to.have.property(k)))});" });
    for (const [id, p] of [['NTF-01', '/api/notifications/events'], ['NTF-02', '/api/notifications/recipients'], ['NTF-03', '/api/notifications'], ['NTF-08', '/api/notifications/history'], ['NTF-09', '/api/notifications/pending']]) {
      t(`${id}b`, `${p}: instructor refused`, { p, as: 'instructor', s: 403, type: 'none' });
      t(`${id}c`, `${p}: learner refused`, { p, as: 'learner', s: 403, type: 'none' });
    }
    t('NTF-05a', 'create rule', { m: 'POST', p: '/api/notifications', s: 201, body: rule({}), save: { k_rule: 'd.id' }, tests: "pm.test('stored',()=>{pm.expect(d.eventType).eql('COURSE_COMPLETED');pm.expect(d.delayMinutes).eql(0);pm.expect(d.active).eql(true)});" });
    t('NTF-05b', 'empty name', { m: 'POST', p: '/api/notifications', s: 400, body: rule({ name: '' }), tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('name'));" });
    t('NTF-05c', 'negative delay', { m: 'POST', p: '/api/notifications', s: 400, body: rule({ delayMinutes: -1 }), tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('delayMinutes'));" });
    t('NTF-04a', 'get by id', { p: '/api/notifications/{{k_rule}}', tests: "pm.test('same rule',()=>pm.expect(d.id).eql(env('k_rule')));" });
    t('NTF-04b', 'unknown id → 404', { p: '/api/notifications/{{nonexistentId}}', s: 404 });
    t('NTF-04c', 'malformed id → 404 (recorded)', { p: '/api/notifications/abc', s: 404 });
    t('NTF-06a', 'deactivate', { m: 'PUT', p: '/api/notifications/{{k_rule}}', body: rule({ active: false }), tests: "pm.test('inactive',()=>pm.expect(d.active).eql(false));" });
    t('NTF-06b', 'unknown id → 404', { m: 'PUT', p: '/api/notifications/{{nonexistentId}}', s: 404, body: rule({}) });
    t('NTF-07a', 'delete', { m: 'DELETE', p: '/api/notifications/{{k_rule}}', s: 204 });
    t('NTF-07b', 'repeat → 404', { m: 'DELETE', p: '/api/notifications/{{k_rule}}', s: 404 });

    // delayed rule -> pending; unknown placeholder -> immediate mail
    t('NTF-09z', 'rule with 60-minute delay on USER_CREATED', { m: 'POST', p: '/api/notifications', s: 201, body: rule({ name: 'k-delay-{{k_ts}}', eventType: 'USER_CREATED', delayMinutes: 60, subjectTemplate: 'later {{firstName}}', bodyTemplate: 'later' }), save: { k_ruleDelay: 'd.id' } });
    t('NTF-12z', 'rule with an unknown placeholder on USER_CREATED', { m: 'POST', p: '/api/notifications', s: 201, body: rule({ name: 'k-foo-{{k_ts}}', eventType: 'USER_CREATED', subjectTemplate: 'foo', bodyTemplate: 'x {{foo}} y' }), save: { k_ruleFoo: 'd.id' } });
    t('NTF-09y', 'create a user to trigger both', { m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Notif', lastName: 'Target', email: 'k_nt_{{k_ts}}@example.test', username: 'k_nt_{{k_ts}}', password: 'Aziret123!' }, save: { k_nt: 'd.id' } });
    t('NTF-09a', 'delayed mail is PENDING and not yet in history', {
      p: '/api/notifications/pending',
      tests: "poll('pending mail for the new user',()=>d.some(m=>m.recipientEmail==='k_nt_'+env('k_ts')+'@example.test'&&m.status==='PENDING'));const m=d.find(x=>x.recipientEmail==='k_nt_'+env('k_ts')+'@example.test');if(m)pm.environment.set('k_msg',m.id);",
    });
    t('NTF-08a', 'immediate mail is SENT with substituted fields', {
      p: '/api/notifications/history',
      tests: "poll('SENT mail to the new user',()=>d.some(m=>m.recipientEmail==='k_nt_'+env('k_ts')+'@example.test'&&m.status==='SENT'));const m=d.find(x=>x.recipientEmail==='k_nt_'+env('k_ts')+'@example.test'&&x.status==='SENT'&&x.subject==='foo');if(m){pm.test('unknown placeholder is recorded as-is or blank (no braces crash)',()=>pm.expect(m.body).to.be.a('string'));}pm.test('delayed mail is not in history',()=>pm.expect(d.some(x=>x.subject&&x.subject.startsWith('later')&&x.recipientEmail==='k_nt_'+env('k_ts')+'@example.test')).eql(false));",
    });
    t('NTF-11a', 'delete a pending message', { m: 'DELETE', p: '/api/notifications/messages/{{k_msg}}', s: 204 });
    t('NTF-11b', 'it is gone from pending', { p: '/api/notifications/pending', tests: "pm.test('not listed',()=>pm.expect(d.map(m=>m.id)).to.not.include(env('k_msg')));" });
    t('NTF-11c', 'deleting an unknown message is idempotent (204, recorded)', { m: 'DELETE', p: '/api/notifications/messages/{{k_msg}}', s: 204 });
    t('NTF-99a', 'cleanup delayed rule', { m: 'DELETE', p: '/api/notifications/{{k_ruleDelay}}', s: 204 });
    t('NTF-99b', 'cleanup placeholder rule', { m: 'DELETE', p: '/api/notifications/{{k_ruleFoo}}', s: 204 });
    t('NTF-99c', 'cleanup target user', { m: 'DELETE', p: '/api/users/{{k_nt}}', s: 204 });
  });
}

function analytics() {
  return group('ANL · analytics-service', () => {
    t('ANL-01a', 'timeline page', {
      p: '/api/analytics/timeline',
      tests: "pm.test('page envelope',()=>['items','total','page','size'].forEach(k=>pm.expect(d).to.have.property(k)));pm.test('items have fields, newest first',()=>{pm.expect(d.items).to.not.be.empty;d.items.forEach(e=>['type','userId','description','occurredAt'].forEach(k=>pm.expect(e).to.have.property(k)));const ts=d.items.map(e=>e.occurredAt);pm.expect(ts).to.eql([...ts].sort().reverse())});",
    });
    t('ANL-01b', 'instructor can read (STAFF)', { p: '/api/analytics/timeline', as: 'instructor' });
    t('ANL-01c', 'learner refused', { p: '/api/analytics/timeline', as: 'learner', s: 403, type: 'none' });
    t('ANL-02a', 'filter by type', { p: '/api/analytics/timeline?type=USER_LOGGED_IN&size=20', tests: "pm.test('only that type',()=>{pm.expect(d.items).to.not.be.empty;d.items.forEach(e=>pm.expect(e.type).eql('USER_LOGGED_IN'))});" });
    t('ANL-03a', 'filter by userId', { p: '/api/analytics/timeline?userId={{adminId}}&size=20', tests: "pm.test('only that user',()=>d.items.forEach(e=>pm.expect(e.userId).eql(env('adminId'))));" });
    t('ANL-04a', 'from/to range', { p: '/api/analytics/timeline?from=2020-01-01&to=2020-01-02', tests: "pm.test('empty range',()=>pm.expect(d.items).to.eql([]));" });
    t('ANL-04b', 'from after to → empty (recorded)', { p: '/api/analytics/timeline?from=2030-01-01&to=2020-01-01', tests: "pm.test('empty',()=>pm.expect(d.items).to.eql([]));" });
    t('ANL-05a', 'page 1 size 5', { p: '/api/analytics/timeline?page=1&size=5', tests: "pm.test('5 items on page 1',()=>{pm.expect(d.items).to.have.length(5);pm.expect(d.page).eql(1);pm.expect(d.size).eql(5)});pm.environment.set('k_p1',d.items[0].eventId);" });
    t('ANL-05b', 'page 0 differs from page 1', { p: '/api/analytics/timeline?page=0&size=5', tests: "pm.test('different first item',()=>pm.expect(d.items[0].eventId).to.not.eql(env('k_p1')));" });
    t('ANL-05c', 'size=1000 is capped at 100', { p: '/api/analytics/timeline?size=1000', tests: "pm.test('capped',()=>{pm.expect(d.size).to.be.at.most(100);pm.expect(d.items.length).to.be.at.most(100)});" });
    t('ANL-06a', 'CSV export', { p: '/api/analytics/timeline/export', type: 'text/csv', accept: 'text/csv', tests: "pm.test('header row',()=>pm.expect(txt.split('\\n')[0].replace(/^\\uFEFF/,'').trim()).eql('date,event,user,course,description'));pm.test('has rows',()=>pm.expect(txt.trim().split('\\n').length).to.be.above(1));" });
    t('ANL-06b', 'learner refused', { p: '/api/analytics/timeline/export', as: 'learner', s: 403, type: 'none' });
    t('ANL-07a', 'summary shape', {
      p: '/api/analytics/summary',
      tests: "pm.test('today + week blocks',()=>['today','week'].forEach(b=>['logins','courseCompletions','usersWithActivity'].forEach(m=>{pm.expect(d[b][m].value).to.be.a('number');pm.expect(d[b][m]).to.have.property('previous');pm.expect(d[b][m]).to.have.property('changePercent')})));pm.environment.set('k_loginsBefore',String(d.today.logins.value));",
    });
    t('ANL-07b', 'one more login is counted', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: '{{instructorUsername}}', password: '{{instructorPassword}}' } });
    t('ANL-07c', 'summary logins grew', { p: '/api/analytics/summary', tests: "poll('today.logins increased',()=>d.today.logins.value>Number(env('k_loginsBefore')));" });
    t('ANL-08a', 'overview', { p: '/api/analytics/overview', tests: "pm.test('topUsers + eventsByType',()=>{pm.expect(d.topUsers).to.be.an('array');pm.expect(d).to.have.property('eventsByType')});" });
    t('ANL-09a', 'dashboard today: 24 points', { p: '/api/analytics/dashboard?period=today', tests: "pm.test('equal lengths, 24',()=>{pm.expect(d.labels).to.have.length(24);pm.expect(d.logins).to.have.length(24);pm.expect(d.completions).to.have.length(24)});" });
    t('ANL-09b', 'dashboard week: 7 points', { p: '/api/analytics/dashboard?period=week', tests: "pm.test('7',()=>{pm.expect(d.labels).to.have.length(7);pm.expect(d.logins).to.have.length(7);pm.expect(d.completions).to.have.length(7)});" });
    for (const p of ['yesterday', 'month']) t(`ANL-09-${p}`, `dashboard ${p}`, { p: `/api/analytics/dashboard?period=${p}`, tests: "pm.test('series align',()=>{pm.expect(d.logins).to.have.length(d.labels.length);pm.expect(d.completions).to.have.length(d.labels.length)});" });
    t('ANL-10a', 'top users sorted by score', { p: '/api/analytics/top-users', tests: "pm.test('descending',()=>{const s=d.map(x=>x.score);pm.expect(s).to.eql([...s].sort((a,b)=>b-a))});" });
    t('ANL-11a', 'user activity', { p: '/api/analytics/users/{{adminId}}/activity', tests: "pm.test('series',()=>{pm.expect(d.labels).to.be.an('array');pm.expect(d.logins).to.have.length(d.labels.length)});" });
    t('ANL-11b', 'unknown user → zeros (recorded)', { p: '/api/analytics/users/{{nonexistentId}}/activity', tests: "pm.test('all zero',()=>{pm.expect(d.logins.every(x=>x===0)).eql(true);pm.expect(d.completions.every(x=>x===0)).eql(true)});" });
    t('ANL-11c', 'learner refused', { p: '/api/analytics/users/{{adminId}}/activity', as: 'learner', s: 403, type: 'none' });
    t('ANL-12a', 'course activity', { p: '/api/analytics/courses/{{courseId}}/activity', tests: "pm.test('series',()=>pm.expect(d.labels).to.be.an('array'));" });
    t('ANL-12b', 'learner refused', { p: '/api/analytics/courses/{{courseId}}/activity', as: 'learner', s: 403, type: 'none' });
  });
}

function gamification() {
  return group('GAM · gamification-service', () => {
    t('GAM-00a', 'init run suffix', { p: '/api/auth/settings', as: 'none', pre: "pm.environment.set('k_ts',String(Date.now()));" });
    t('GAM-00b', 'snapshot gamification settings', { p: '/api/gamification/settings', tests: "pm.environment.set('k_gsnap',JSON.stringify(d));pm.test('document',()=>pm.expect(d.id).eql('default'));" });
    t('GAM-00c', 'fresh learner A', { m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Game', lastName: 'A', email: 'k_ga_{{k_ts}}@example.test', username: 'k_ga_{{k_ts}}', password: 'Aziret123!' }, save: { k_ga: 'd.id' } });
    t('GAM-00d', 'fresh learner B', { m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Game', lastName: 'B', email: 'k_gb_{{k_ts}}@example.test', username: 'k_gb_{{k_ts}}', password: 'Aziret123!' }, save: { k_gb: 'd.id' } });
    t('GAM-02a', 'learner A first login', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_ga_{{k_ts}}', password: 'Aziret123!' }, save: { k_gatok: 'd.token' } });
    t('GAM-01a', 'profile has all fields', {
      p: '/api/gamification/me', as: '{{k_gatok}}',
      tests: `${hist}poll('first login awards 10 points',()=>d.points===10&&acts.includes('Sign in'));if(d.points===10){pm.test('profile fields',()=>['points','level','logins','units','courses','badges','history','rank','nextLevelPoints','enabled'].forEach(k=>pm.expect(d).to.have.property(k)));pm.test('newcomer badge',()=>pm.expect(d.badges.map(b=>b.code)).to.include('newcomer'))}`,
    });
    t('GAM-01b', 'no token', { p: '/api/gamification/me', as: 'none', s: 401, type: 'none' });
    t('GAM-02b', 'second login the same day', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_ga_{{k_ts}}', password: 'Aziret123!' } });
    t('GAM-02c', 'no extra points for a repeat login', { p: '/api/gamification/me', as: '{{k_gatok}}', delay: 1500, tests: "pm.test('still 10',()=>pm.expect(d.points).eql(10));" });
    t('ANL-13a', 'each login recorded exactly once', {
      p: '/api/analytics/timeline?type=USER_LOGGED_IN&userId={{k_ga}}&size=50',
      tests: "poll('two logins = two events (no duplicates)',()=>d.items.length===2);",
    });

    // learning flow: course with a checkbox lesson and a test
    t('GAM-03a', 'course', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-game-{{k_ts}}' }, save: { k_gc: 'd.id' } });
    t('GAM-03b', 'lesson', { m: 'POST', p: '/api/courses/{{k_gc}}/units', as: 'instructor', s: 201, form: unit('k-g1'), save: { k_gu: 'd.id' } });
    t('GAM-03c', 'question', { m: 'POST', p: '/api/courses/{{k_gc}}/questions', as: 'instructor', s: 201, body: { type: 'MULTIPLE_CHOICE', text: 'gq', data: { answers: [{ text: 'a', correct: true }, { text: 'b', correct: false }] } }, save: { k_gq: 'd.id' } });
    t('GAM-03d', 'test', { m: 'POST', p: '/api/courses/{{k_gc}}/tests', as: 'instructor', s: 201, body: { name: 'k-gt', passScore: 50, repetitions: 'ALWAYS', questions: [{ questionId: '{{k_gq}}', weight: 1 }] }, save: { k_gt: 'd.unitId' } });
    t('GAM-03e', 'enroll A', { m: 'POST', p: '/api/courses/{{k_gc}}/enrollments', body: { userId: '{{k_ga}}' }, s: 201, save: { k_gae: 'd.id' } });
    t('GAM-03f', 'A starts and completes the lesson', { m: 'POST', p: '/api/units/{{k_gu}}/start', as: '{{k_gatok}}' });
    t('GAM-03g', 'complete', { m: 'POST', p: '/api/units/{{k_gu}}/complete', as: '{{k_gatok}}', body: {} });
    t('GAM-03h', '+15 and the first-step badge', {
      p: '/api/gamification/me', as: '{{k_gatok}}',
      tests: `${hist}poll('unit points and first-step',()=>acts.includes('Unit completed')&&d.badges.some(b=>b.code==='first-step'));`,
    });
    t('GAM-05a', 'A starts the test and fails it', { m: 'POST', p: '/api/units/{{k_gt}}/test/attempts', as: '{{k_gatok}}', s: 201, save: { k_gatt1: 'd.id' } });
    t('GAM-05b', 'empty submit', { m: 'POST', p: '/api/units/{{k_gt}}/test/attempts/{{k_gatt1}}/submit', as: '{{k_gatok}}', body: { answers: {} }, tests: "pm.test('failed',()=>pm.expect(d.passed).eql(false));" });
    t('GAM-05c', 'a failed test earns nothing', { p: '/api/gamification/me', as: '{{k_gatok}}', delay: 1500, tests: `${hist}pm.test('no test points yet',()=>pm.expect(acts).to.not.include('Test passed'));` });
    t('GAM-05d', 'A retakes and passes', { m: 'POST', p: '/api/units/{{k_gt}}/test/attempts', as: '{{k_gatok}}', s: 201, save: { k_gatt2: 'd.id' } });
    t('GAM-05e', 'submit right answer', { m: 'POST', p: '/api/units/{{k_gt}}/test/attempts/{{k_gatt2}}/submit', as: '{{k_gatok}}', pre: "const a={};a[pm.environment.get('k_gq')]=[0];pm.environment.set('k_ans',JSON.stringify({answers:a}));", raw: '{{k_ans}}', tests: "pm.test('passed',()=>pm.expect(d.passed).eql(true));" });
    t('GAM-04a', 'course, certificate and test points + graduate badge', {
      p: '/api/gamification/me', as: '{{k_gatok}}',
      tests: `${hist}poll('all awards present',()=>['Course completed','Certificate','Test passed'].every(a=>acts.includes(a))&&d.badges.some(b=>b.code==='graduate'));pm.test('Test passed appears once and is worth 20',()=>{const x=h.filter(e=>e.action==='Test passed');pm.expect(x).to.have.length(1);pm.expect(x[0].points).eql(20)});`,
    });

    t('GAM-06a', 'instructor reads another profile', { p: '/api/gamification/users/{{k_ga}}', as: 'instructor', tests: "pm.test('that user',()=>pm.expect(d.userId).eql(env('k_ga')));" });
    t('GAM-06b', 'learner refused', { p: '/api/gamification/users/{{k_ga}}', as: 'learner', s: 403, type: 'none' });
    t('GAM-07a', 'leaderboard top 3', {
      p: '/api/gamification/leaderboard?by=points&limit=3', as: 'learner',
      tests: "pm.test('≤3, ranked, descending',()=>{pm.expect(d.top.length).to.be.at.most(3);d.top.forEach((r,i)=>pm.expect(r.rank).eql(i+1));const s=d.top.map(r=>r.score);pm.expect(s).to.eql([...s].sort((a,b)=>b-a))});pm.test('me block',()=>pm.expect(d).to.have.property('me'));",
    });
    t('GAM-07b', 'unknown ranking falls back to points (by is echoed, recorded)', { p: '/api/gamification/leaderboard?by=xxx&limit=3', as: 'learner', tests: "pm.test('still ranked by score',()=>{const s=d.top.map(r=>r.score);pm.expect(s).to.eql([...s].sort((a,b)=>b-a))});" });
    t('GAM-07c', 'limit=100 is capped at 50', { p: '/api/gamification/leaderboard?limit=100', as: 'learner', tests: "pm.test('≤50',()=>pm.expect(d.top.length).to.be.at.most(50));" });
    t('GAM-07d', 'leaderboard by levels and badges', { p: '/api/gamification/leaderboard?by=levels&limit=3', as: 'learner' });
    t('GAM-07e', 'by badges', { p: '/api/gamification/leaderboard?by=badges&limit=3', as: 'learner' });
    t('GAM-08a', 'rules', { p: '/api/gamification/rules', as: 'learner', tests: "pm.test('points/levels/badges',()=>{pm.expect(d.points).to.not.be.empty;pm.expect(d.levels).to.not.be.empty;d.badges.forEach(b=>pm.expect(b).to.have.property('earned'))});" });
    t('GAM-09a', 'config', { p: '/api/gamification/config', as: 'learner', tests: "pm.test('keys',()=>['enabled','points','badges','levels','leaderboard'].forEach(k=>pm.expect(d).to.have.property(k)));" });
    t('GAM-10a', 'admin reads settings', { p: '/api/gamification/settings', tests: "pm.test('document',()=>{pm.expect(d.points.unit.points).to.be.a('number')});" });
    t('GAM-10b', 'instructor refused', { p: '/api/gamification/settings', as: 'instructor', s: 403, type: 'none' });
    t('GAM-10c', 'learner refused', { p: '/api/gamification/settings', as: 'learner', s: 403, type: 'none' });
    t('GAM-11x', 'instructor cannot write settings', { m: 'PUT', p: '/api/gamification/settings', as: 'instructor', s: 403, type: 'none', body: {} });

    const putGame = (id, title, mods, extra = {}) => t(id, title, {
      m: 'PUT', p: '/api/gamification/settings', raw: '{{k_gset}}',
      pre: `const b=JSON.parse(pm.environment.get('k_gsnap'));const m=${JSON.stringify(mods)};const merge=(t,s)=>{for(const k in s){if(s[k]&&typeof s[k]==='object')merge(t[k],s[k]);else t[k]=s[k]}};merge(b,m);pm.environment.set('k_gset',JSON.stringify(b));`,
      ...extra,
    });
    putGame('GAM-11a', 'unit points 99 and a level every 50 points', { points: { unit: { points: 99 } }, levels: { byPoints: { every: 50 } } }, { tests: "pm.test('stored',()=>{pm.expect(d.points.unit.points).eql(99);pm.expect(d.levels.byPoints.every).eql(50)});" });
    t('GAM-11b', 'course 2 with two lessons', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-game2-{{k_ts}}' }, save: { k_gc2: 'd.id' } });
    t('GAM-11c', 'lesson 1', { m: 'POST', p: '/api/courses/{{k_gc2}}/units', as: 'instructor', s: 201, form: unit('k-g21'), save: { k_gu21: 'd.id' } });
    t('GAM-11d', 'lesson 2', { m: 'POST', p: '/api/courses/{{k_gc2}}/units', as: 'instructor', s: 201, form: unit('k-g22'), save: { k_gu22: 'd.id' } });
    t('GAM-11e', 'enroll B', { m: 'POST', p: '/api/courses/{{k_gc2}}/enrollments', body: { userId: '{{k_gb}}' }, s: 201, save: { k_gbe: 'd.id' } });
    t('GAM-11f', 'B logs in', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_gb_{{k_ts}}', password: 'Aziret123!' }, save: { k_gbtok: 'd.token' } });
    t('GAM-11g', 'B starts lesson 1', { m: 'POST', p: '/api/units/{{k_gu21}}/start', as: '{{k_gbtok}}' });
    t('GAM-11h', 'B completes lesson 1', { m: 'POST', p: '/api/units/{{k_gu21}}/complete', as: '{{k_gbtok}}', body: {} });
    t('GAM-11i', 'the lesson was worth 99 and the level follows the new step', {
      p: '/api/gamification/me', as: '{{k_gbtok}}',
      tests: `${hist}poll('99-point unit award',()=>h.some(e=>e.action==='Unit completed'&&e.points===99));if(h.some(e=>e.action==='Unit completed'&&e.points===99))pm.test('level uses every=50 (109 points → level ≥ 3)',()=>pm.expect(d.level).to.be.at.least(3));pm.environment.set('k_gbPoints',String(d.points));`,
    });
    putGame('GAM-12a', 'gamification disabled', { enabled: false });
    t('GAM-12b', 'config reports disabled', { p: '/api/gamification/config', as: 'learner', tests: "pm.test('enabled=false',()=>pm.expect(d.enabled).eql(false));" });
    t('GAM-12c', 'B starts lesson 2', { m: 'POST', p: '/api/units/{{k_gu22}}/start', as: '{{k_gbtok}}' });
    t('GAM-12d', 'B completes lesson 2', { m: 'POST', p: '/api/units/{{k_gu22}}/complete', as: '{{k_gbtok}}', body: {} });
    t('GAM-12e', 'no points were awarded while disabled', { p: '/api/gamification/me', as: '{{k_gbtok}}', delay: 2000, tests: "pm.test('unchanged',()=>pm.expect(String(d.points)).eql(env('k_gbPoints')));" });
    putGame('GAM-13a', 'hide badges on the leaderboard', { enabled: true, leaderboard: { showBadges: false } });
    t('GAM-13b', 'config reflects it', { p: '/api/gamification/config', as: 'learner', tests: "pm.test('showBadges=false',()=>pm.expect(d.leaderboard.showBadges).eql(false));" });
    t('GAM-15a', 'reset settings to defaults', {
      m: 'POST', p: '/api/gamification/settings/reset',
      tests: "pm.test('defaults',()=>{pm.expect(d.points.login.points).eql(10);pm.expect(d.points.unit.points).eql(15);pm.expect(d.points.course.points).eql(100);pm.expect(d.points.certificate.points).eql(50);pm.expect(d.points.test.points).eql(20)});",
    });
    t('GAM-15b', 'instructor cannot reset', { m: 'POST', p: '/api/gamification/settings/reset', as: 'instructor', s: 403, type: 'none' });
    t('GAM-16a', 'instructor cannot wipe statistics', { m: 'POST', p: '/api/gamification/reset-statistics', as: 'instructor', s: 403, type: 'none' });
    t('GAM-16b', 'learner cannot wipe statistics', { m: 'POST', p: '/api/gamification/reset-statistics', as: 'learner', s: 403, type: 'none' });
    t('GAM-99a', 'restore the original settings', {
      m: 'PUT', p: '/api/gamification/settings', raw: '{{k_gsnap}}',
      tests: "pm.test('restored',()=>pm.expect(JSON.stringify(d)).eql(env('k_gsnap')));",
    });

    for (const [v, kind] of [['k_gc', 'courses/'], ['k_gc2', 'courses/']]) {
      t(`GAM-99-${v}`, `soft-delete ${v}`, { m: 'DELETE', p: `/api/courses/{{${v}}}`, s: 204 });
      t(`GAM-99p-${v}`, `purge ${v}`, { m: 'DELETE', p: `/api/courses/{{${v}}}/permanent`, s: 204 });
    }
    for (const v of ['k_ga', 'k_gb']) t(`GAM-99u-${v}`, `delete ${v}`, { m: 'DELETE', p: `/api/users/{{${v}}}`, s: 204 });
  });
}

export default function build() {
  return group('08 Checks · notification, analytics, gamification · Aziret', () => {
    t('PLT-00a', 'init run suffix', { p: '/api/auth/settings', as: 'none', pre: "pm.environment.set('k_ts',String(Date.now()));" });
    notifications();
    analytics();
    gamification();
  });
}
