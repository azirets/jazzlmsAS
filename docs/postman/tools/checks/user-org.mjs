import { group, t } from '../lib.mjs';

const settings = (mods) => ({
  pre: `const b=JSON.parse(pm.environment.get('baselineUserSettings'));Object.assign(b,${JSON.stringify(mods)});pm.environment.set('k_settings',JSON.stringify(b));`,
  raw: '{{k_settings}}',
});
const put = (id, title, mods, extra = {}) => t(id, title, { m: 'PUT', p: '/api/settings', ...settings(mods), ...extra });
const restore = (id) => put(id, 'restore baseline settings', {}, { pre: "pm.environment.set('k_settings',pm.environment.get('baselineUserSettings'));" });

export function settingsChecks() {
  return group('SET · account settings', () => {
    t('SET-01a', 'admin reads all fields', {
      p: '/api/settings',
      tests: "pm.test('all setting fields',()=>['siteName','signupMode','defaultUserType','defaultGroupId','passwordMaxAgeDays','passwordChangeOnFirstLogin','lockAfterAttempts','lockMinutes','termsOfService','visibleUserFormat'].forEach(k=>pm.expect(d).to.have.property(k)));",
    });
    t('SET-01b', 'instructor refused', { p: '/api/settings', as: 'instructor', s: 403, type: 'none' });
    t('SET-01c', 'learner refused', { p: '/api/settings', as: 'learner', s: 403, type: 'none' });
    t('SET-02a', 'PUT same body changes nothing', {
      m: 'PUT', p: '/api/settings', ...settings({}),
      pre: "pm.environment.set('k_settings',pm.environment.get('baselineUserSettings'));",
      tests: "pm.test('unchanged',()=>pm.expect(d.siteName).eql(JSON.parse(env('baselineUserSettings')).siteName));",
    });
    put('SET-02b', 'lockAfterAttempts=2, lockMinutes=1', { lockAfterAttempts: 2, lockMinutes: 1 }, { tests: "pm.test('stored',()=>{pm.expect(d.lockAfterAttempts).eql(2);pm.expect(d.lockMinutes).eql(1)});" });
    t('SET-02c', 'fixture user for lock', { m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Lock', lastName: 'Test', email: 'k_lock_{{k_ts}}@example.test', username: 'k_lock_{{k_ts}}', password: 'Aziret123!' }, save: { k_lockid: 'd.id' } });
    t('SET-02d', 'wrong password #1 → 401', { m: 'POST', p: '/api/auth/login', as: 'none', s: 401, body: { username: 'k_lock_{{k_ts}}', password: 'bad' } });
    t('SET-02e', 'wrong password #2 → 423', { m: 'POST', p: '/api/auth/login', as: 'none', s: 423, body: { username: 'k_lock_{{k_ts}}', password: 'bad' } });
    t('SET-02f', 'cleanup lock fixture', { m: 'DELETE', p: '/api/users/{{k_lockid}}', s: 204 });
    put('SET-02g', 'signupMode MANUAL closes registration', { signupMode: 'MANUAL' });
    t('SET-02h', 'register → 403', { m: 'POST', p: '/api/auth/register', as: 'none', s: 403, body: { firstName: 'a', lastName: 'b', email: 'k_man_{{k_ts}}@example.test', username: 'k_man_{{k_ts}}', password: 'Aziret123!' } });
    put('SET-02i', 'defaultGroupId = fixture group', { defaultGroupId: '{{groupId}}' }, { tests: "pm.test('stored',()=>pm.expect(d.defaultGroupId).eql(env('groupId')));" });
    t('SET-02j', 'new signup lands in that group', {
      m: 'POST', p: '/api/auth/register', as: 'none', s: 201, body: { firstName: 'a', lastName: 'b', email: 'k_dg_{{k_ts}}@example.test', username: 'k_dg_{{k_ts}}', password: 'Aziret123!' },
      save: { k_dgid: 'd.user.id' },
    });
    t('SET-02k', 'group lists the new member', { p: '/api/groups/{{groupId}}/users', tests: "pm.test('member present',()=>pm.expect(d.map(u=>u.id)).to.include(env('k_dgid')));" });
    t('SET-02l', 'cleanup default-group user', { m: 'DELETE', p: '/api/users/{{k_dgid}}', s: 204 });
    put('SET-02m', 'defaultGroupId unknown → 404', { defaultGroupId: '{{nonexistentId}}' }, { s: 404 });
    put('SET-02n', 'siteName empty → 400', { siteName: '' }, { s: 400, tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('siteName'));" });
    put('SET-02o', 'lockMinutes=0 → 400', { lockMinutes: 0 }, { s: 400, tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('lockMinutes'));" });
    put('SET-02p', 'passwordMaxAgeDays=5000 → 400', { passwordMaxAgeDays: 5000 }, { s: 400, tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('passwordMaxAgeDays'));" });
    put('SET-02q', 'blank terms are stored as null', { termsOfService: '   ' }, { tests: "pm.test('null',()=>pm.expect(d.termsOfService).eql(null));" });
    t('SET-02r', 'public settings show null terms', { p: '/api/auth/settings', as: 'none', tests: "pm.test('null terms',()=>pm.expect(d.termsOfService).eql(null));" });
    t('SET-02s', 'PATCH not allowed', { m: 'PATCH', p: '/api/settings', s: 405, ...settings({}), pre: "pm.environment.set('k_settings',pm.environment.get('baselineUserSettings'));" });
    t('SET-02t', 'instructor cannot write', { m: 'PUT', p: '/api/settings', as: 'instructor', s: 403, type: 'none', ...settings({}), pre: "pm.environment.set('k_settings',pm.environment.get('baselineUserSettings'));" });
    restore('SET-99');
  });
}

export function orgChecks() {
  return group('ORG · branches and groups', () => {
    t('ORG-00', 'fixture learners', { m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Org', lastName: 'One', email: 'k_org1_{{k_ts}}@example.test', username: 'k_org1_{{k_ts}}', password: 'Aziret123!' }, save: { k_o1: 'd.id' } });
    t('ORG-00b', 'second fixture learner', { m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Org', lastName: 'Two', email: 'k_org2_{{k_ts}}@example.test', username: 'k_org2_{{k_ts}}', password: 'Aziret123!' }, save: { k_o2: 'd.id' } });
    for (const [X, one, full, nameOf, short] of [
      ['groups', 'group', { name: 'k-group-full-{{k_ts}}', description: 'full body', active: true }, (s) => `k-group-${s}-{{k_ts}}`, 'GRP'],
      ['branches', 'branch', { name: 'k-branch-full-{{k_ts}}', title: 'Title', description: 'full body', language: 'en', timeZone: 'Asia/Bishkek', defaultUserType: 'LEARNER', signupMode: 'DIRECT', announcement: 'hello' }, (s) => `k-branch-${s}-{{k_ts}}`, 'BRN'],
    ]) {
      const id = `k_${short}`;
      group(`${short} · ${X}`, () => {
        t(`${short}-01a`, `list: admin`, { p: `/api/${X}`, tests: `pm.test('rows are {${one}, members}',()=>{pm.expect(d).to.be.an('array');d.forEach(r=>{pm.expect(r).to.have.property('${one}');pm.expect(r.members).to.be.a('number')})});pm.environment.set('k_${short}_count',String(d.length));` });
        t(`${short}-01b`, `list: instructor`, { p: `/api/${X}`, as: 'instructor' });
        t(`${short}-01c`, `list: learner refused`, { p: `/api/${X}`, as: 'learner', s: 403, type: 'none' });
        t(`${short}-02a`, `create minimal`, { m: 'POST', p: `/api/${X}`, s: 201, body: { name: nameOf('min') }, save: { [id]: 'd.id' }, tests: "pm.test('id/active/createdAt',()=>{pm.expect(d.id).to.match(UUID);pm.expect(d.active).eql(true);pm.expect(d.createdAt).to.match(ISO)});" });
        t(`${short}-02b`, `create full body`, { m: 'POST', p: `/api/${X}`, s: 201, body: full, save: { [id + '2']: 'd.id' }, tests: `Object.entries(${JSON.stringify(full)}).forEach(([k,v])=>{if(typeof v!=='string'||!v.includes('{{'))pm.test('stored '+k,()=>pm.expect(d[k]).eql(v))});` });
        t(`${short}-02c`, `empty name`, { m: 'POST', p: `/api/${X}`, s: 400, body: { name: '' }, tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('name'));" });
        t(`${short}-02d`, `name too long`, { m: 'POST', p: `/api/${X}`, s: 400, body: { name: 'x'.repeat(300) } });
        t(`${short}-02e`, `duplicate name → 409`, { m: 'POST', p: `/api/${X}`, s: 409, body: { name: nameOf('min') }, tests: "pm.test('already taken',()=>pm.expect(d.detail).to.match(/already taken/i));" });
        t(`${short}-02f`, `instructor refused`, { m: 'POST', p: `/api/${X}`, as: 'instructor', s: 403, type: 'none', body: { name: nameOf('x') } });
        t(`${short}-02g`, `learner refused`, { m: 'POST', p: `/api/${X}`, as: 'learner', s: 403, type: 'none', body: { name: nameOf('x') } });
        t(`${short}-03a`, `get by id`, { p: `/api/${X}/{{${id}}}`, tests: `pm.test('same id',()=>pm.expect(d.id).eql(env('${id}')));` });
        t(`${short}-03b`, `N5 unknown id`, { p: `/api/${X}/{{nonexistentId}}`, s: 404 });
        t(`${short}-04a`, `rename + description`, { m: 'PUT', p: `/api/${X}/{{${id}}}`, body: { name: nameOf('ren'), description: 'changed' }, tests: "pm.test('changed',()=>pm.expect(d.description).eql('changed'));" });
        t(`${short}-04b`, `empty name`, { m: 'PUT', p: `/api/${X}/{{${id}}}`, s: 400, body: { name: '' } });
        t(`${short}-04c`, `instructor refused`, { m: 'PUT', p: `/api/${X}/{{${id}}}`, as: 'instructor', s: 403, type: 'none', body: { name: nameOf('z') } });
        t(`${short}-04d`, `N5 unknown id`, { m: 'PUT', p: `/api/${X}/{{nonexistentId}}`, s: 404, body: { name: nameOf('z') } });
        t(`${short}-06a`, `members: empty`, { p: `/api/${X}/{{${id}}}/users`, tests: "pm.test('empty',()=>pm.expect(d).to.eql([]));" });
        t(`${short}-06b`, `members: N5`, { p: `/api/${X}/{{nonexistentId}}/users`, s: 404 });
        t(`${short}-07a`, `add member 1`, { m: 'POST', p: `/api/${X}/{{${id}}}/users/{{k_o1}}`, s: 204 });
        t(`${short}-07b`, `add same member again (idempotent)`, { m: 'POST', p: `/api/${X}/{{${id}}}/users/{{k_o1}}`, s: 204 });
        t(`${short}-07c`, `add member 2`, { m: 'POST', p: `/api/${X}/{{${id}}}/users/{{k_o2}}`, s: 204 });
        t(`${short}-07d`, `unknown group`, { m: 'POST', p: `/api/${X}/{{nonexistentId}}/users/{{k_o1}}`, s: 404 });
        t(`${short}-07e`, `unknown user`, { m: 'POST', p: `/api/${X}/{{${id}}}/users/{{nonexistentId}}`, s: 404 });
        t(`${short}-07f`, `instructor refused`, { m: 'POST', p: `/api/${X}/{{${id}}}/users/{{k_o1}}`, as: 'instructor', s: 403, type: 'none' });
        t(`${short}-06c`, `members: exactly 2, no passwordHash`, { p: `/api/${X}/{{${id}}}/users`, tests: "pm.test('2 members',()=>pm.expect(d).to.have.length(2));" });
        t(`${short}-01d`, `list shows members=2`, { p: `/api/${X}`, tests: `const row=d.find(r=>r.${one}.id===env('${id}'));pm.test('members=2',()=>pm.expect(row.members).eql(2));pm.test('list grew by 2',()=>pm.expect(d.length).to.be.at.least(Number(env('k_${short}_count'))+2));` });
        t(`${short}-09a`, `user's ${X} include it`, { p: `/api/users/{{k_o1}}/${X}`, tests: `pm.test('present',()=>pm.expect(d.map(x=>x.id)).to.include(env('${id}')));` });
        t(`${short}-09b`, `user without memberships → []`, { p: `/api/users/{{learnerId}}/${X}`, tests: `pm.test('contains no k_ ${X}',()=>pm.expect(JSON.stringify(d)).to.not.include('${id}'));` });
        t(`${short}-09c`, `learner reading others refused`, { p: `/api/users/{{k_o2}}/${X}`, as: 'learner', s: 403, type: 'none' });
        t(`${short}-08a`, `remove member 1`, { m: 'DELETE', p: `/api/${X}/{{${id}}}/users/{{k_o1}}`, s: 204 });
        t(`${short}-08b`, `remove non-member (idempotent)`, { m: 'DELETE', p: `/api/${X}/{{${id}}}/users/{{k_o1}}`, s: 204 });
        t(`${short}-08c`, `instructor refused`, { m: 'DELETE', p: `/api/${X}/{{${id}}}/users/{{k_o2}}`, as: 'instructor', s: 403, type: 'none' });
        t(`${short}-05a`, `delete with a member left`, { m: 'DELETE', p: `/api/${X}/{{${id}}}`, s: 204 });
        t(`${short}-05b`, `membership cascaded away`, { p: `/api/users/{{k_o2}}/${X}`, tests: `pm.test('gone',()=>pm.expect(d.map(x=>x.id)).to.not.include(env('${id}')));` });
        t(`${short}-05c`, `GET after delete → 404`, { p: `/api/${X}/{{${id}}}`, s: 404 });
        t(`${short}-05d`, `repeat delete → 404`, { m: 'DELETE', p: `/api/${X}/{{${id}}}`, s: 404 });
        t(`${short}-05e`, `instructor refused`, { m: 'DELETE', p: `/api/${X}/{{${id}2}}`, as: 'instructor', s: 403, type: 'none' });
        t(`${short}-05z`, `cleanup full-body record`, { m: 'DELETE', p: `/api/${X}/{{${id}2}}`, s: 204 });
      });
    }
    t('ORG-99a', 'cleanup learner 1', { m: 'DELETE', p: '/api/users/{{k_o1}}', s: 204 });
    t('ORG-99b', 'cleanup learner 2', { m: 'DELETE', p: '/api/users/{{k_o2}}', s: 204 });
  });
}
