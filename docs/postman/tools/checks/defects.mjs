import { group, t } from '../lib.mjs';

// Requests whose spec-expected result differs from what the services return today.
// They keep the expected status from API_TEST_CHECKLIST.md so the defect stays visible;
// the folder is excluded from the acceptance run (see README).
export default function build() {
  return group('09 Known defects · Aziret', () => {
    t('DEF-USR-02', 'login with text/plain should be 400/415, not 500', {
      m: 'POST', p: '/api/auth/login', as: 'none', s: 400, ct: 'text/plain', raw: '{"username":"x","password":"y"}',
    });
    t('DEF-USR-03', 'N6 malformed UUID on GET /api/users/{id}', { p: '/api/users/abc', s: 400 });
    t('DEF-USR-04', 'N6 malformed UUID on impersonate', { m: 'POST', p: '/api/auth/impersonate/abc', s: 400 });
    t('DEF-USR-05', 'N6 malformed UUID on GET /api/groups/{id}', { p: '/api/groups/abc', s: 400 });
    t('DEF-USR-06', 'N6 malformed UUID on GET /api/branches/{id}', { p: '/api/branches/abc', s: 400 });
    t('DEF-USR-07', 'N8 malformed JSON on POST /api/users', { m: 'POST', p: '/api/users', s: 400, raw: '{bad json' });
    t('DEF-USR-08', 'unknown userType enum should be 400', {
      m: 'POST', p: '/api/users', s: 400,
      body: { firstName: 'a', lastName: 'b', email: 'k_king_{{k_ts}}@example.test', username: 'k_king_{{k_ts}}', password: 'Aziret123!', userType: 'KING' },
    });
    t('DEF-USR-09', 'import without a file part should be 400', {
      m: 'POST', p: '/api/users/import', s: 400, form: [{ key: 'other', value: 'x' }],
    });
    t('DEF-USR-10', 'import of a non-CSV file should be 400', {
      m: 'POST', p: '/api/users/import', s: 400, form: [{ key: 'file', src: 'docs/postman/fixtures/aziret-not-csv.png' }],
    });
    t('DEF-GW-01', 'N1: gateway 401 should carry WWW-Authenticate: Bearer', {
      p: '/api/auth/me', as: 'none', s: 401, type: 'none',
      tests: "pm.test('WWW-Authenticate: Bearer',()=>pm.expect(hdr('WWW-Authenticate')||'').to.match(/Bearer/i));",
    });

    t('DEF-GW-03', 'unknown path without a token should be 401, not 404', { p: '/api/nothing', as: 'none', s: 401, type: 'none' });
    t('DEF-ANL-01', 'timeline with an unknown event type should be 400/empty, not 500', { p: '/api/analytics/timeline?type=XXX', s: 400 });
    t('DEF-ANL-02', 'timeline page=-1 should be 400', { p: '/api/analytics/timeline?page=-1', s: 400 });
    t('DEF-ANL-03', 'dashboard period=year should be 400', { p: '/api/analytics/dashboard?period=year', s: 400 });
    t('DEF-NTF-01', 'rule with an unknown eventType should be 400, not 500', {
      m: 'POST', p: '/api/notifications', s: 400,
      body: { name: 'kd-rule', eventType: 'XXX', recipient: 'RELATED_USER', delayMinutes: 0, subjectTemplate: 's', bodyTemplate: 'b' },
    });

    // ---- course-service / gateway authorisation defects (need their own fixtures)
    t('DEF-00a', 'fixture: run suffix', { p: '/api/auth/settings', as: 'none', pre: "pm.environment.set('k_ts',String(Date.now()));pm.environment.set('k_dclone',pm.environment.get('nonexistentId'));" });
    t('DEF-00b', 'fixture: foreign TRAINER', { m: 'POST', p: '/api/users', s: 201, body: { firstName: 'D', lastName: 'Trainer', email: 'k_di2_{{k_ts}}@example.test', username: 'k_di2_{{k_ts}}', password: 'Aziret123!', userType: 'TRAINER' }, save: { k_di2: 'd.id' } });
    t('DEF-00c', 'fixture: foreign TRAINER logs in', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_di2_{{k_ts}}', password: 'Aziret123!' }, save: { k_di2tok: 'd.token' } });
    t('DEF-00d', 'fixture: second learner', { m: 'POST', p: '/api/users', s: 201, body: { firstName: 'D', lastName: 'Learner', email: 'k_dl2_{{k_ts}}@example.test', username: 'k_dl2_{{k_ts}}', password: 'Aziret123!' }, save: { k_dl2: 'd.id' } });
    t('DEF-00e', 'fixture: second learner logs in', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_dl2_{{k_ts}}', password: 'Aziret123!' }, save: { k_dl2tok: 'd.token' } });
    t('DEF-00f', 'fixture: course owned by the Setup instructor', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'kd-course-{{k_ts}}' }, save: { k_dcrs: 'd.id' } });
    t('DEF-00g', 'fixture: one lesson', {
      m: 'POST', p: '/api/courses/{{k_dcrs}}/units', as: 'instructor', s: 201, save: { k_du: 'd.id' },
      form: [{ key: 'unit', value: JSON.stringify({ name: 'kd-lesson', type: 'CONTENT', completionType: 'CHECKBOX', textContent: 'x' }), contentType: 'application/json' }],
    });
    t('DEF-00h', 'fixture: enroll the Setup learner', { m: 'POST', p: '/api/courses/{{k_dcrs}}/enrollments', s: 201, body: { userId: '{{learnerId}}' }, save: { k_denr: 'd.id' } });
    t('DEF-00i', 'fixture: enroll the second learner', { m: 'POST', p: '/api/courses/{{k_dcrs}}/enrollments', s: 201, body: { userId: '{{k_dl2}}' }, save: { k_denr2: 'd.id' } });
    t('DEF-00j', 'fixture: learner starts the lesson', { m: 'POST', p: '/api/units/{{k_du}}/start', as: 'learner' });
    t('DEF-00k', 'fixture: learner completes it (certificate issued)', { m: 'POST', p: '/api/units/{{k_du}}/complete', as: 'learner', body: {} });
    t('DEF-00l', 'fixture: find the certificate', {
      p: '/api/certificates/my', as: 'learner',
      tests: "poll('certificate issued',()=>d.some(c=>(c.courseName||'').startsWith('kd-course')));const c=(d||[]).find(x=>(x.courseName||'').startsWith('kd-course'));if(c)pm.environment.set('k_dcert',c.id);",
    });
    t('DEF-00m', 'fixture: a question', {
      m: 'POST', p: '/api/courses/{{k_dcrs}}/questions', as: 'instructor', s: 201, save: { k_dq: 'd.id' },
      body: { type: 'MULTIPLE_CHOICE', text: 'kd-q', data: { answers: [{ text: 'a', correct: true }, { text: 'b', correct: false }] } },
    });

    t('DEF-CRS-01', 'a TRAINER who is not on the course must not edit it', { m: 'PUT', p: '/api/courses/{{k_dcrs}}', as: '{{k_di2tok}}', s: 403, body: { name: 'kd-course-hijacked-{{k_ts}}' } });
    t('DEF-CRS-02', 'a TRAINER who is not on the course must not clone it', {
      m: 'POST', p: '/api/courses/{{k_dcrs}}/clone', as: '{{k_di2tok}}', s: 403, save: { k_dclone: 'd.id' },
    });
    t('DEF-ENR-01', "learner must not list a course's enrollments (names + emails)", { p: '/api/courses/{{k_dcrs}}/enrollments', as: 'learner', s: 403, type: 'none' });
    t('DEF-ENR-02', "learner must not change another learner's progress", { m: 'PATCH', p: '/api/enrollments/{{k_denr2}}/progress', as: 'learner', s: 403, body: { progress: 100 } });
    t('DEF-GW-02a', 'gateway has no route for GET /api/questions/{id}', { p: '/api/questions/{{k_dq}}', as: 'instructor', s: 200 });
    t('DEF-GW-02b', 'gateway has no route for PUT /api/questions/{id}', { m: 'PUT', p: '/api/questions/{{k_dq}}', as: 'instructor', s: 200, body: { type: 'MULTIPLE_CHOICE', text: 'kd-q2', data: { answers: [{ text: 'a', correct: true }, { text: 'b', correct: false }] } } });
    t('DEF-GW-02c', 'gateway has no route for DELETE /api/questions/{id}', { m: 'DELETE', p: '/api/questions/{{k_dq}}', as: 'instructor', s: 204 });
    t('DEF-CRS-03a', 'owner soft-deletes the course', { m: 'DELETE', p: '/api/courses/{{k_dcrs}}', as: 'instructor', s: 204 });
    t('DEF-CRS-03b', 'bin is admin-only: instructor restore should be 403', { m: 'POST', p: '/api/courses/{{k_dcrs}}/restore', as: 'instructor', s: 403, type: 'none' });
    t('DEF-CRS-04a', 'delete it again so the purge check has a deleted course', { m: 'DELETE', p: '/api/courses/{{k_dcrs}}', as: 'instructor', s: 204, type: 'none' });
    t('DEF-CRS-04b', 'bin is admin-only: instructor purge should be 403', { m: 'DELETE', p: '/api/courses/{{k_dcrs}}/permanent', as: 'instructor', s: 403, type: 'none' });

    t('TEARDOWN-DEF-01', 'cleanup: purge the course', { m: 'DELETE', p: '/api/courses/{{k_dcrs}}/permanent', s: 204 });
    t('TEARDOWN-DEF-02', 'cleanup: soft-delete the foreign clone (if any)', { m: 'DELETE', p: '/api/courses/{{k_dclone}}', s: 204 });
    t('TEARDOWN-DEF-03', 'cleanup: purge that clone', { m: 'DELETE', p: '/api/courses/{{k_dclone}}/permanent', s: 204 });
    t('TEARDOWN-DEF-04', 'cleanup: foreign TRAINER', { m: 'DELETE', p: '/api/users/{{k_di2}}', s: 204 });
    t('TEARDOWN-DEF-05', 'cleanup: second learner', { m: 'DELETE', p: '/api/users/{{k_dl2}}', s: 204 });
  });
}
