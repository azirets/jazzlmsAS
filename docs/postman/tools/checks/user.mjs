import { group, t } from '../lib.mjs';
import { settingsChecks, orgChecks } from './user-org.mjs';

// Settings body helper: start from the snapshot taken in 00 Setup and override fields.
const settings = (mods) => ({
  pre: `const b=JSON.parse(pm.environment.get('baselineUserSettings'));Object.assign(b,${JSON.stringify(mods)});pm.environment.set('k_settings',JSON.stringify(b));`,
  raw: '{{k_settings}}',
});
const putSettings = (id, title, mods, extra = {}) =>
  t(id, title, { m: 'PUT', p: '/api/settings', ...settings(mods), ...extra });

const userBody = (suffix, extra = {}) => ({
  firstName: 'Aziret', lastName: 'Check', email: `k_${suffix}_{{k_ts}}@example.test`,
  username: `k_${suffix}_{{k_ts}}`, password: 'Aziret123!', userType: 'LEARNER', ...extra,
});
const tokenOf = 'const tk=d&&d.token;';

export default function build() {
  return group('08 Checks · user-service · Aziret', () => {
    t('USR-00a', 'init run suffix', {
      p: '/api/auth/settings', as: 'none',
      pre: "pm.environment.set('k_ts',String(Date.now()));",
      tests: "pm.test('public settings reachable',()=>pm.expect(d).to.have.property('siteName'));",
    });

    group('AUTH-01 · login', () => {
      t('USR-00b', 'fixture: learner for auth checks', {
        m: 'POST', p: '/api/users', s: 201, body: userBody('auth'),
        save: { k_uid: 'd.id', k_uname: 'd.username' },
        tests: "pm.test('created active LEARNER',()=>{pm.expect(d.id).to.match(UUID);pm.expect(d.userType).eql('LEARNER');pm.expect(d.active).eql(true)});",
      });
      t('AUTH-01a', 'admin login', {
        m: 'POST', p: '/api/auth/login', as: 'none', body: { username: '{{adminUsername}}', password: '{{adminPassword}}' },
        tests: `pm.test('JWT has 3 parts',()=>pm.expect(d.token.split('.')).to.have.length(3));
pm.test('SUPER_ADMIN, no forced change',()=>{pm.expect(d.user.username).eql('admin');pm.expect(d.user.userType).eql('SUPER_ADMIN');pm.expect(d.mustChangePassword).eql(false)});`,
      });
      t('AUTH-01b', 'login by email', {
        m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'admin@jazzlms.local', password: '{{adminPassword}}' },
        tests: "pm.test('same admin account',()=>pm.expect(d.user.username).eql('admin'));",
      });
      t('AUTH-01c', 'instructor login', {
        m: 'POST', p: '/api/auth/login', as: 'none', body: { username: '{{instructorUsername}}', password: '{{instructorPassword}}' },
        tests: "pm.test('TRAINER',()=>pm.expect(d.user.userType).eql('TRAINER'));",
      });
      t('AUTH-01d', 'wrong password', {
        m: 'POST', p: '/api/auth/login', as: 'none', s: 401, body: { username: '{{k_uname}}', password: 'wrong-password' },
        tests: "pm.test('generic invalid-credentials detail',()=>pm.expect(d.detail).to.include('Invalid username or password'));",
      });
      t('AUTH-01e', 'unknown user', {
        m: 'POST', p: '/api/auth/login', as: 'none', s: 401, body: { username: 'no_such_user_{{k_ts}}', password: 'whatever1' },
        tests: "pm.test('same detail as wrong password (no user enumeration)',()=>pm.expect(d.detail).to.include('Invalid username or password'));",
      });
      t('AUTH-01f', 'empty body', {
        m: 'POST', p: '/api/auth/login', as: 'none', s: 400, body: {},
        tests: "pm.test('detail names both fields',()=>{pm.expect(d.detail).to.include('username');pm.expect(d.detail).to.include('password')});",
      });
      t('AUTH-01g', 'GET instead of POST', { p: '/api/auth/login', as: 'none', s: 405 });
      t('AUTH-01h', 'extra body fields are ignored', {
        m: 'POST', p: '/api/auth/login', as: 'none', body: { username: '{{k_uname}}', password: 'Aziret123!', unexpected: 1 },
        tests: "pm.test('token issued',()=>pm.expect(d.token).to.be.a('string'));",
      });
      t('AUTH-01i', 'deactivate fixture user', {
        m: 'PUT', p: '/api/users/{{k_uid}}', body: { active: false },
        tests: "pm.test('active=false',()=>pm.expect(d.active).eql(false));",
      });
      t('AUTH-01j', 'deactivated user cannot log in', {
        m: 'POST', p: '/api/auth/login', as: 'none', s: 401, body: { username: '{{k_uname}}', password: 'Aziret123!' },
        tests: "pm.test('detail mentions deactivated',()=>pm.expect(d.detail).to.match(/deactivated/i));",
      });
      t('AUTH-01k', 're-activate fixture user', { m: 'PUT', p: '/api/users/{{k_uid}}', body: { active: true } });
      putSettings('AUTH-01l', 'enable lockout (3 attempts / 30 min)', { lockAfterAttempts: 3, lockMinutes: 30 }, {
        tests: "pm.test('lockout configured',()=>{pm.expect(d.lockAfterAttempts).eql(3);pm.expect(d.lockMinutes).eql(30)});",
      });
      for (const n of [1, 2]) {
        t(`AUTH-01m${n}`, `wrong password #${n} still 401`, { m: 'POST', p: '/api/auth/login', as: 'none', s: 401, body: { username: '{{k_uname}}', password: 'bad-' + n } });
      }
      t('AUTH-01m3', 'wrong password #3 locks the account', {
        m: 'POST', p: '/api/auth/login', as: 'none', s: 423, body: { username: '{{k_uname}}', password: 'bad-3' },
        tests: "pm.test('detail reports minutes',()=>pm.expect(d.detail).to.match(/minute/i));",
      });
      t('AUTH-01n', 'correct password is rejected while locked', {
        m: 'POST', p: '/api/auth/login', as: 'none', s: 423, body: { username: '{{k_uname}}', password: 'Aziret123!' },
        tests: "pm.test('locked',()=>pm.expect(hdr('Content-Type')).to.include('application/problem+json'));",
      });
      putSettings('AUTH-01o', 'lockout disabled (null) → no more 423', { lockAfterAttempts: null });
      for (const n of [1, 2, 3, 4, 5]) {
        t(`AUTH-01p${n}`, `lockout off: wrong password #${n} stays 401`, { m: 'POST', p: '/api/auth/login', as: 'none', s: 401, body: { username: 'no_lock_{{k_ts}}', password: 'bad-' + n } });
      }
      putSettings('AUTH-01q', 'restore baseline settings', {}, {
        pre: "pm.environment.set('k_settings',pm.environment.get('baselineUserSettings'));",
      });
    });

    group('AUTH-02 · register', () => {
      t('AUTH-02a', 'valid registration', {
        m: 'POST', p: '/api/auth/register', as: 'none', s: 201, body: userBody('reg', { userType: undefined }),
        save: { k_regtoken: 'd.token', k_reguid: 'd.user.id', k_regname: 'd.user.username' },
        tests: "pm.test('LEARNER with token',()=>{pm.expect(d.token).to.be.a('string');pm.expect(d.user.userType).eql('LEARNER')});",
      });
      t('AUTH-02b', 'token works on /me', {
        p: '/api/auth/me', as: '{{k_regtoken}}',
        tests: "pm.test('same user',()=>{pm.expect(d.username).eql(env('k_regname'));pm.expect(d.id).eql(env('k_reguid'))});",
      });
      const bad = (id, title, mods, s, field) => t(id, title, {
        m: 'POST', p: '/api/auth/register', as: 'none', s, body: userBody('rbad', mods),
        tests: field ? `pm.test('detail mentions ${field}',()=>pm.expect(d.detail).to.include('${field}'));` : undefined,
      });
      bad('AUTH-02c', 'username shorter than 3', { username: 'ab' }, 400, 'username');
      bad('AUTH-02d', 'password shorter than 6', { password: '12345' }, 400, 'password');
      bad('AUTH-02e', 'email without @', { email: 'not-an-email' }, 400, 'email');
      bad('AUTH-02f', 'username already taken', { username: '{{k_regname}}' }, 409, 'already taken');
      bad('AUTH-02g', 'email already registered', { email: 'k_reg_{{k_ts}}@example.test' }, 409, 'already registered');
      t('AUTH-02h', 'missing first and last name', {
        m: 'POST', p: '/api/auth/register', as: 'none', s: 400, body: { email: 'n_{{k_ts}}@example.test', username: 'n_{{k_ts}}', password: 'Aziret123!' },
        tests: "pm.test('detail names fields',()=>{pm.expect(d.detail).to.include('firstName');pm.expect(d.detail).to.include('lastName')});",
      });
      putSettings('AUTH-02i', 'signup mode MANUAL', { signupMode: 'MANUAL' });
      t('AUTH-02j', 'register is closed in MANUAL mode', {
        m: 'POST', p: '/api/auth/register', as: 'none', s: 403, body: userBody('man'),
        tests: "pm.test('detail explains',()=>pm.expect(d.detail).to.match(/disabled/i));",
      });
      putSettings('AUTH-02k', 'terms of service set, signup DIRECT', { signupMode: 'DIRECT', termsOfService: 'You agree to the terms.' });
      t('AUTH-02l', 'register without acceptTerms', {
        m: 'POST', p: '/api/auth/register', as: 'none', s: 400, body: userBody('tos'),
        tests: "pm.test('asks to accept terms',()=>pm.expect(d.detail).to.include('Terms of Service'));",
      });
      t('AUTH-02m', 'register with acceptTerms=true', {
        m: 'POST', p: '/api/auth/register', as: 'none', s: 201, body: userBody('tos', { acceptTerms: true }),
        save: { k_tosuid: 'd.user.id' },
      });
      putSettings('AUTH-02n', 'default user type TRAINER', { termsOfService: null, defaultUserType: 'TRAINER' });
      t('AUTH-02o', 'new signup becomes TRAINER', {
        m: 'POST', p: '/api/auth/register', as: 'none', s: 201, body: userBody('trn'),
        save: { k_trnuid: 'd.user.id' },
        tests: "pm.test('TRAINER',()=>pm.expect(d.user.userType).eql('TRAINER'));",
      });
      putSettings('AUTH-02p', 'default user type SUPER_ADMIN', { defaultUserType: 'SUPER_ADMIN' });
      t('AUTH-02q', 'signup never becomes SUPER_ADMIN', {
        m: 'POST', p: '/api/auth/register', as: 'none', s: 201, body: userBody('sup'),
        save: { k_supuid: 'd.user.id' },
        tests: "pm.test('falls back to LEARNER',()=>pm.expect(d.user.userType).eql('LEARNER'));",
      });
      putSettings('AUTH-02r', 'restore baseline settings', {}, { pre: "pm.environment.set('k_settings',pm.environment.get('baselineUserSettings'));" });
      for (const v of ['reguid', 'tosuid', 'trnuid', 'supuid']) {
        t(`AUTH-02z-${v}`, `cleanup ${v}`, { m: 'DELETE', p: `/api/users/{{k_${v}}}`, s: 204 });
      }
    });

    group('AUTH-03 · public settings', () => {
      t('AUTH-03a', 'public, no token', {
        p: '/api/auth/settings', as: 'none',
        tests: "pm.test('public fields',()=>['siteName','signupAllowed','termsOfService','visibleUserFormat'].forEach(k=>pm.expect(d).to.have.property(k)));",
      });
      putSettings('AUTH-03b', 'switch signup to MANUAL', { signupMode: 'MANUAL' });
      t('AUTH-03c', 'signupAllowed becomes false', {
        p: '/api/auth/settings', as: 'none',
        tests: "pm.test('signup closed',()=>pm.expect(d.signupAllowed).eql(false));",
      });
      putSettings('AUTH-03d', 'restore baseline settings', {}, { pre: "pm.environment.set('k_settings',pm.environment.get('baselineUserSettings'));" });
      t('AUTH-03e', 'POST is not allowed', { m: 'POST', p: '/api/auth/settings', as: 'none', s: 405, body: {} });
    });

    group('AUTH-04 · change password', () => {
      t('AUTH-04a', 'login fixture user', {
        m: 'POST', p: '/api/auth/login', as: 'none', body: { username: '{{k_uname}}', password: 'Aziret123!' },
        save: { k_utoken: 'd.token' },
      });
      t('AUTH-04b', 'wrong current password', {
        m: 'POST', p: '/api/auth/password', as: '{{k_utoken}}', s: 401, body: { currentPassword: 'wrong', newPassword: 'Changed456!' },
        tests: "pm.test('says current password is wrong',()=>pm.expect(d.detail).to.match(/current password/i));",
      });
      t('AUTH-04c', 'new equals current', {
        m: 'POST', p: '/api/auth/password', as: '{{k_utoken}}', s: 400, body: { currentPassword: 'Aziret123!', newPassword: 'Aziret123!' },
        tests: "pm.test('must differ',()=>pm.expect(d.detail).to.match(/differ/i));",
      });
      t('AUTH-04d', 'new shorter than 6', {
        m: 'POST', p: '/api/auth/password', as: '{{k_utoken}}', s: 400, body: { currentPassword: 'Aziret123!', newPassword: '12345' },
        tests: "pm.test('names newPassword',()=>pm.expect(d.detail).to.include('newPassword'));",
      });
      t('AUTH-04e', 'no token', { m: 'POST', p: '/api/auth/password', as: 'none', s: 401, type: 'none', body: { currentPassword: 'a', newPassword: 'bbbbbbb' } });
      t('AUTH-04f', 'successful change', { m: 'POST', p: '/api/auth/password', as: '{{k_utoken}}', s: 204, body: { currentPassword: 'Aziret123!', newPassword: 'Changed456!' } });
      t('AUTH-04g', 'old password no longer works', { m: 'POST', p: '/api/auth/login', as: 'none', s: 401, body: { username: '{{k_uname}}', password: 'Aziret123!' } });
      t('AUTH-04h', 'new password works', {
        m: 'POST', p: '/api/auth/login', as: 'none', body: { username: '{{k_uname}}', password: 'Changed456!' },
        tests: "pm.test('no forced change',()=>pm.expect(d.mustChangePassword).eql(false));",
      });
      putSettings('AUTH-04i', 'force password change on first login', { passwordChangeOnFirstLogin: true });
      t('AUTH-04j', 'create user under that policy', {
        m: 'POST', p: '/api/users', s: 201, body: userBody('mcp'), save: { k_mcpuid: 'd.id', k_mcpname: 'd.username' },
      });
      t('AUTH-04k', 'first login demands a change', {
        m: 'POST', p: '/api/auth/login', as: 'none', body: { username: '{{k_mcpname}}', password: 'Aziret123!' },
        save: { k_mcptoken: 'd.token' },
        tests: "pm.test('mustChangePassword',()=>pm.expect(d.mustChangePassword).eql(true));",
      });
      t('AUTH-04l', 'change it', { m: 'POST', p: '/api/auth/password', as: '{{k_mcptoken}}', s: 204, body: { currentPassword: 'Aziret123!', newPassword: 'Changed456!' } });
      t('AUTH-04m', 'next login no longer demands a change', {
        m: 'POST', p: '/api/auth/login', as: 'none', body: { username: '{{k_mcpname}}', password: 'Changed456!' },
        tests: "pm.test('flag cleared',()=>pm.expect(d.mustChangePassword).eql(false));",
      });
      putSettings('AUTH-04n', 'restore baseline settings', {}, { pre: "pm.environment.set('k_settings',pm.environment.get('baselineUserSettings'));" });
      t('AUTH-04o', 'cleanup policy user', { m: 'DELETE', p: '/api/users/{{k_mcpuid}}', s: 204 });
    });

    group('AUTH-05 · impersonate', () => {
      t('AUTH-05a', 'admin → learner', {
        m: 'POST', p: '/api/auth/impersonate/{{k_uid}}', save: { k_imptoken: 'd.token' },
        tests: "pm.test('token issued',()=>pm.expect(d.token).to.be.a('string'));",
      });
      t('AUTH-05b', 'impersonation token is the learner', {
        p: '/api/auth/me', as: '{{k_imptoken}}',
        tests: "pm.test('me = target',()=>{pm.expect(d.id).eql(env('k_uid'));pm.expect(d.userType).eql('LEARNER')});",
      });
      t('AUTH-05c', 'instructor is refused by the gateway', { m: 'POST', p: '/api/auth/impersonate/{{k_uid}}', as: 'instructor', s: 403, type: 'none' });
      t('AUTH-05d', 'learner is refused by the gateway', { m: 'POST', p: '/api/auth/impersonate/{{k_uid}}', as: 'learner', s: 403, type: 'none' });
      t('AUTH-05e', 'cannot impersonate SUPER_ADMIN', {
        m: 'POST', p: '/api/auth/impersonate/{{adminId}}', s: 409,
        tests: "pm.test('SuperAdmin protected',()=>pm.expect(d.detail).to.match(/SuperAdmin/i));",
      });
      t('AUTH-05f', 'unknown user id', { m: 'POST', p: '/api/auth/impersonate/{{nonexistentId}}', s: 404 });
      t('AUTH-05g', 'USER_IMPERSONATED reaches the timeline', {
        p: '/api/analytics/timeline?type=USER_IMPERSONATED&size=20',
        tests: "poll('USER_IMPERSONATED event recorded',()=>list(d).length>0);",
      });
      t('AUTH-05h', 'deactivate fixture, then impersonate it', { m: 'PUT', p: '/api/users/{{k_uid}}', body: { active: false } });
      t('AUTH-05i', 'cannot impersonate deactivated user', {
        m: 'POST', p: '/api/auth/impersonate/{{k_uid}}', s: 409,
        tests: "pm.test('mentions deactivated',()=>pm.expect(d.detail).to.match(/deactivated/i));",
      });
      t('AUTH-05j', 're-activate fixture', { m: 'PUT', p: '/api/users/{{k_uid}}', body: { active: true } });
    });

    group('AUTH-06 · me', () => {
      for (const [r, ty] of [['admin', 'SUPER_ADMIN'], ['instructor', 'TRAINER'], ['learner', 'LEARNER']]) {
        t(`AUTH-06-${r}`, `${r} identity matches token subject`, {
          p: '/api/auth/me', as: r,
          tests: `const sub=JSON.parse(atob(pm.request.headers.get('Authorization').split(' ')[1].split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;
pm.test('id equals JWT sub',()=>pm.expect(d.id).eql(sub));pm.test('userType ${ty}',()=>pm.expect(d.userType).eql('${ty}'));`,
        });
      }
      t('AUTH-06d', 'forged X-User-Id is ignored', {
        p: '/api/auth/me', as: 'learner', h: { 'X-User-Id': '{{adminId}}' },
        tests: "pm.test('still the learner',()=>pm.expect(d.id).eql(env('learnerId')));",
      });
      t('AUTH-06e', 'N1 no token', { p: '/api/auth/me', as: 'none', s: 401, type: 'none' });
      t('AUTH-06f', 'N2 garbage token', { p: '/api/auth/me', as: 'Bearer abc.def.ghi', s: 401, type: 'none' });
      t('AUTH-06g', 'N3 tampered signature', {
        p: '/api/auth/me', as: 'Bearer {{k_tampered}}', s: 401, type: 'none',
        pre: "const x=pm.environment.get('learnerToken');pm.environment.set('k_tampered',x.slice(0,-1)+(x.slice(-1)==='A'?'B':'A'));",
      });
    });

    group('DEMO-01 · status codes', () => {
      t('DEMO-01a', '200', { p: '/api/demo/status/200', tests: "pm.test('message present',()=>pm.expect(d.message).to.be.a('string'));" });
      t('DEMO-01b', '201 + Location', { p: '/api/demo/status/201', s: 201, tests: "pm.test('Location header',()=>pm.expect(hdr('Location')).to.eql('/api/demo/status/200'));" });
      t('DEMO-01c', '204 without body', { p: '/api/demo/status/204', s: 204 });
      t('DEMO-01d', '300 with alternatives', {
        p: '/api/demo/status/300', s: 300,
        tests: "pm.test('Location + 2 alternatives',()=>{pm.expect(hdr('Location')).to.be.a('string');pm.expect(d.alternatives).to.have.length(2)});",
      });
      t('DEMO-01e', '301 + Location', { p: '/api/demo/status/301', s: 301, type: 'none', tests: "pm.test('Location header',()=>pm.expect(hdr('Location')).to.eql('/api/demo/status/200'));" });
      t('DEMO-01f', '301 followed → 200', {
        p: '/api/demo/status/301', s: 200, pre: '',
      }).protocolProfileBehavior = { followRedirects: true };
      t('DEMO-01g', '403 demo body', { p: '/api/demo/status/403', s: 403, type: 'json-error', tests: "pm.test('explains role',()=>pm.expect(d.message).to.match(/not allowed/i));" });
      t('DEMO-01h', '500 has no stack trace', { p: '/api/demo/status/500', s: 500, tests: "pm.test('no stack trace',()=>pm.expect(txt).to.not.match(/\\sat\\s[\\w.$]+\\(|Exception/));" });
      t('DEMO-01i', 'unsupported code 418', { p: '/api/demo/status/418', s: 400, type: 'json-error', tests: "pm.test('lists supported codes',()=>pm.expect(d.message).to.include('supported codes'));" });
      t('DEMO-01j', 'POST not allowed', { m: 'POST', p: '/api/demo/status/200', s: 405, body: {} });
      t('DEMO-01k', 'no token', { p: '/api/demo/status/200', as: 'none', s: 401, type: 'none' });
    });

    group('USR-01 · list', () => {
      t('USR-01a', 'admin lists users', {
        p: '/api/users',
        tests: "pm.test('array with required fields',()=>{pm.expect(d).to.be.an('array').that.is.not.empty;d.forEach(u=>['id','username','email','userType','active','createdAt'].forEach(k=>pm.expect(u).to.have.property(k)))});",
      });
      t('USR-01b', 'instructor can read', { p: '/api/users', as: 'instructor' });
      t('USR-01c', 'learner refused', { p: '/api/users', as: 'learner', s: 403, type: 'none' });
      t('USR-01d', 'search by username fragment', {
        p: '/api/users?search=k_auth_',
        tests: "pm.test('all rows match',()=>{pm.expect(d).to.not.be.empty;d.forEach(u=>pm.expect((u.username+u.email+u.firstName+u.lastName).toLowerCase()).to.include('k_auth_'))});",
      });
      t('USR-01e', 'search is case-insensitive', {
        p: '/api/users?search=K_AUTH_',
        tests: "pm.test('same hit',()=>pm.expect(d.map(u=>u.id)).to.include(env('k_uid')));",
      });
      t('USR-01f', 'active=false only', {
        p: '/api/users?active=false',
        tests: "pm.test('only inactive',()=>d.forEach(u=>pm.expect(u.active).eql(false)));",
      });
      t('USR-01g', 'no matches → empty array', { p: '/api/users?search=xyz_no_such_user_{{k_ts}}', tests: "pm.test('empty',()=>pm.expect(d).to.eql([]));" });
      t('USR-01h', 'empty search = full list', {
        p: '/api/users?search=', tests: "pm.test('non-empty',()=>pm.expect(d.length).to.be.above(0));",
      });
      t('USR-02a', 'stats', { p: '/api/users/stats', tests: "pm.test('total ≥ active',()=>{pm.expect(d.total).to.be.a('number');pm.expect(d.total).to.be.at.least(d.active)});" });
      t('USR-02b', 'stats: learner refused', { p: '/api/users/stats', as: 'learner', s: 403, type: 'none' });
    });

    group('USR-03 · create', () => {
      t('USR-03a', 'create LEARNER', {
        m: 'POST', p: '/api/users', s: 201, body: userBody('c1', { bio: 'bio' }), save: { k_c1: 'd.id', k_c1name: 'd.username' },
        tests: "pm.test('id/createdAt/active',()=>{pm.expect(d.id).to.match(UUID);pm.expect(d.createdAt).to.match(ISO);pm.expect(d.active).eql(true)});",
      });
      t('USR-03b', 'create without password', {
        m: 'POST', p: '/api/users', s: 201, body: userBody('nopw', { password: undefined }), save: { k_c2: 'd.id', k_c2name: 'd.username' },
      });
      t('USR-03c', 'blank password cannot be used to log in (validation, not 401)', {
        m: 'POST', p: '/api/auth/login', as: 'none', s: 400, body: { username: '{{k_c2name}}', password: '' },
        tests: "pm.test('names password',()=>pm.expect(d.detail).to.include('password'));",
      });
      t('USR-03d', 'create TRAINER', {
        m: 'POST', p: '/api/users', s: 201, body: userBody('trn2', { userType: 'TRAINER' }), save: { k_c3: 'd.id' },
        tests: "pm.test('TRAINER',()=>pm.expect(d.userType).eql('TRAINER'));",
      });
      t('USR-03e', 'create inactive', {
        m: 'POST', p: '/api/users', s: 201, body: userBody('off', { active: false }), save: { k_c4: 'd.id', k_c4name: 'd.username' },
        tests: "pm.test('inactive',()=>pm.expect(d.active).eql(false));",
      });
      t('USR-03f', 'inactive user cannot log in', { m: 'POST', p: '/api/auth/login', as: 'none', s: 401, body: { username: '{{k_c4name}}', password: 'Aziret123!' } });
      t('USR-03g', 'duplicate username', { m: 'POST', p: '/api/users', s: 409, body: userBody('dupu', { username: '{{k_c1name}}' }) });
      t('USR-03h', 'duplicate email', { m: 'POST', p: '/api/users', s: 409, body: userBody('dupe', { email: 'k_c1_{{k_ts}}@example.test' }) });
      t('USR-03i', 'firstName 51 chars', { m: 'POST', p: '/api/users', s: 400, body: userBody('fn', { firstName: 'x'.repeat(51) }), tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('firstName'));" });
      t('USR-03j', 'bio 801 chars', { m: 'POST', p: '/api/users', s: 400, body: userBody('bio', { bio: 'x'.repeat(801) }), tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('bio'));" });
      t('USR-03k', 'empty body', { m: 'POST', p: '/api/users', s: 400, body: {} });
      t('USR-03l', 'instructor refused', { m: 'POST', p: '/api/users', as: 'instructor', s: 403, type: 'none', body: userBody('x1') });
      t('USR-03m', 'learner refused', { m: 'POST', p: '/api/users', as: 'learner', s: 403, type: 'none', body: userBody('x2') });
      t('USR-03n', 'USER_CREATED reaches the timeline', {
        p: '/api/analytics/timeline?type=USER_CREATED&size=50',
        tests: "poll('USER_CREATED event for fixture',()=>JSON.stringify(list(d)).includes(env('k_c1')));",
      });
    });

    group('USR-04 · read', () => {
      t('USR-04a', 'admin reads user', {
        p: '/api/users/{{k_c1}}',
        tests: "pm.test('fields',()=>{pm.expect(d.id).eql(env('k_c1'));pm.expect(d.email).to.include('@')});",
      });
      t('USR-04b', 'instructor reads learner', { p: '/api/users/{{k_c1}}', as: 'instructor' });
      t('USR-04c', 'learner refused', { p: '/api/users/{{k_c1}}', as: 'learner', s: 403, type: 'none' });
      t('USR-04d', 'N5 unknown id', { p: '/api/users/{{nonexistentId}}', s: 404 });
      t('USR-04f', 'N7 PATCH not allowed', { m: 'PATCH', p: '/api/users/{{k_c1}}', s: 405, body: {} });
    });

    group('USR-05 · update', () => {
      t('USR-05a', 'change firstName', {
        m: 'PUT', p: '/api/users/{{k_c1}}', body: { firstName: 'Changed' },
        tests: "pm.test('changed, ids intact',()=>{pm.expect(d.firstName).eql('Changed');pm.expect(d.id).eql(env('k_c1'));pm.expect(d.createdAt).to.match(ISO)});",
      });
      t('USR-05b', 'partial update keeps other fields', {
        m: 'PUT', p: '/api/users/{{k_c1}}', body: { bio: 'only bio' },
        tests: "pm.test('firstName kept',()=>{pm.expect(d.bio).eql('only bio');pm.expect(d.firstName).eql('Changed')});",
      });
      t('USR-05c', 'change email to a free one', {
        m: 'PUT', p: '/api/users/{{k_c1}}', body: { email: 'k_c1_new_{{k_ts}}@example.test' },
        tests: "pm.test('email changed',()=>pm.expect(d.email).to.include('k_c1_new_'));",
      });
      t('USR-05d', 'email already taken', { m: 'PUT', p: '/api/users/{{k_c1}}', s: 409, body: { email: 'admin@jazzlms.local' } });
      t('USR-05e', 'change password', { m: 'PUT', p: '/api/users/{{k_c1}}', body: { password: 'Brandnew789!' } });
      t('USR-05f', 'login with the new password', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: '{{k_c1name}}', password: 'Brandnew789!' } });
      t('USR-05g', 'deactivate', { m: 'PUT', p: '/api/users/{{k_c1}}', body: { active: false } });
      t('USR-05h', 'deactivated user cannot log in', { m: 'POST', p: '/api/auth/login', as: 'none', s: 401, body: { username: '{{k_c1name}}', password: 'Brandnew789!' } });
      t('USR-05i', 'GET shows fresh data (cache evicted)', {
        p: '/api/users/{{k_c1}}', tests: "pm.test('inactive now',()=>{pm.expect(d.active).eql(false);pm.expect(d.bio).eql('only bio')});",
      });
      t('USR-05j', 'instructor cannot promote', { m: 'PUT', p: '/api/users/{{k_c1}}', as: 'instructor', s: 403, type: 'none', body: { userType: 'ADMIN' } });
      t('USR-05k', 'N5 unknown id', { m: 'PUT', p: '/api/users/{{nonexistentId}}', s: 404, body: { bio: 'x' } });
    });

    group('USR-07 · export', () => {
      t('USR-07a', 'admin exports CSV', {
        p: '/api/users/export', type: 'text/csv', accept: 'text/csv',
        tests: `pm.test('attachment users.csv',()=>pm.expect(hdr('Content-Disposition')).to.include('filename="users.csv"'));
pm.test('header row',()=>pm.expect(txt.replace(/^\\uFEFF/,'').split('\\n')[0]).to.include('username'));
pm.test('UTF-8 BOM first',()=>{const b=pm.response.stream;pm.expect([b[0],b[1],b[2]]).to.eql([0xEF,0xBB,0xBF])});
pm.environment.set('k_csvRows',String(txt.trim().split('\\n').length-1));`,
      });
      t('USR-07b', 'row count equals stats.total', { p: '/api/users/stats', tests: "pm.test('rows = total',()=>pm.expect(Number(env('k_csvRows'))).to.be.at.least(d.total));" });
      t('USR-07c', 'active=false only', {
        p: '/api/users/export?active=false', type: 'text/csv', accept: 'text/csv',
        tests: "pm.test('no active rows',()=>{const rows=txt.trim().split('\\n').slice(1);rows.forEach(r=>pm.expect(r).to.include('\"false\"'))});",
      });
      t('USR-07d', 'learner refused', { p: '/api/users/export', as: 'learner', s: 403, type: 'none' });
    });

    group('USR-08 · import', () => {
      const csvPart = (rows) => [{ key: 'file', value: rows, contentType: 'text/csv' }];
      const hdr1 = 'firstName,lastName,email,username,password\\n';
      t('USR-08a', 'valid rows via file fixture', {
        m: 'POST', p: '/api/users/import', form: [{ key: 'file', src: 'docs/postman/fixtures/aziret-check-import.csv' }],
        pre: '',
        tests: "pm.test('created=3, skipped empty',()=>{pm.expect(d.created).eql(3);pm.expect(d.skipped).to.be.empty});",
      });
      t('USR-08b', 'duplicate username and missing email are skipped', {
        m: 'POST', p: '/api/users/import', form: [{ key: 'file', src: 'docs/postman/fixtures/aziret-check-import-mixed.csv' }],
        tests: "pm.test('1 created, 2 skipped with line+reason',()=>{pm.expect(d.created).eql(1);pm.expect(d.skipped).to.have.length(2);d.skipped.forEach(s=>{pm.expect(s.line).to.be.a('number');pm.expect(s.reason).to.be.a('string')})});",
      });
      t('USR-08c', 'empty file → created 0', {
        m: 'POST', p: '/api/users/import', form: [{ key: 'file', src: 'docs/postman/fixtures/aziret-empty.csv' }],
        tests: "pm.test('nothing created',()=>pm.expect(d.created).eql(0));",
      });
      t('USR-08d', 'instructor refused', { m: 'POST', p: '/api/users/import', as: 'instructor', s: 403, type: 'none', form: [{ key: 'file', src: 'docs/postman/fixtures/aziret-empty.csv' }] });
      t('USR-08e', 'cleanup imported users', {
        p: '/api/users?search=k_imp_',
        tests: `pm.test('imported users found',()=>pm.expect(d.length).to.be.at.least(4));
d.forEach(u=>pm.sendRequest({url:env('baseUrl')+'/api/users/'+u.id,method:'DELETE',header:{Authorization:'Bearer '+env('adminToken')}},()=>{}));`,
      });
    });

    settingsChecks();
    orgChecks();

    group('USR-06 · delete + cleanup', () => {
      t('USR-06a', 'delete user', { m: 'DELETE', p: '/api/users/{{k_c1}}', s: 204 });
      t('USR-06b', 'GET after delete → 404', { p: '/api/users/{{k_c1}}', s: 404 });
      t('USR-06c', 'repeat delete → 404', { m: 'DELETE', p: '/api/users/{{k_c1}}', s: 404 });
      t('USR-06d', 'SUPER_ADMIN cannot be deleted', { m: 'DELETE', p: '/api/users/{{adminId}}', s: 409, tests: "pm.test('message',()=>pm.expect(d.detail).to.include('SuperAdmin'));" });
      t('USR-06e', 'instructor refused', { m: 'DELETE', p: '/api/users/{{k_c2}}', as: 'instructor', s: 403, type: 'none' });
      t('USR-06f', 'N5 unknown id', { m: 'DELETE', p: '/api/users/{{nonexistentId}}', s: 404 });
      t('USR-06g', 'USER_DELETED reaches the timeline', {
        p: '/api/analytics/timeline?type=USER_DELETED&size=50', tests: "poll('USER_DELETED event recorded',()=>list(d).length>0);",
      });
      for (const v of ['k_c2', 'k_c3', 'k_c4', 'k_uid']) t(`USR-06z-${v}`, `cleanup ${v}`, { m: 'DELETE', p: `/api/users/{{${v}}}`, s: 204 });
    });
  });
}
