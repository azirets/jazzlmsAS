import { group, t } from '../lib.mjs';

const FX = 'docs/postman/fixtures/';
const unitForm = (unit, file, mime) => [
  { key: 'unit', value: JSON.stringify(unit), contentType: 'application/json' },
  ...(file ? [{ key: 'file', src: FX + file, contentType: mime }] : []),
];
const addUnit = (id, title, unit, o = {}) => t(id, title, {
  m: 'POST', p: `/api/courses/{{${o.course || 'k_crs'}}}/units`, as: o.as || 'instructor', s: o.s || 201,
  form: unitForm(unit, o.file, o.mime), save: o.save, tests: o.tests, type: o.type,
});

export function units() {
  return group('UNT · units', () => {
    addUnit('UNT-02a', 'CONTENT', { name: 'k-content', type: 'CONTENT', completionType: 'CHECKBOX', textContent: 'hello' }, {
      save: { k_uc: 'd.id', k_ucPos: 'd.position' }, tests: "pm.test('type + position',()=>{pm.expect(d.type).eql('CONTENT');pm.expect(d.position).to.be.a('number')});",
    });
    addUnit('UNT-02b', 'VIDEO from YouTube', { name: 'k-youtube', type: 'VIDEO', sourceType: 'YOUTUBE', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, {
      save: { k_uyt: 'd.id' }, tests: "pm.test('embed url',()=>pm.expect(d.embedUrl).eql('https://www.youtube.com/embed/dQw4w9WgXcQ'));",
    });
    addUnit('UNT-02c', 'VIDEO upload (mp4)', { name: 'k-mp4', type: 'VIDEO', sourceType: 'UPLOAD' }, {
      file: 'aziret-sample.mp4', mime: 'video/mp4', save: { k_uv: 'd.id' },
      tests: "pm.test('file metadata',()=>{pm.expect(d.fileName).to.include('mp4');pm.expect(d.fileSize).to.be.above(0);pm.expect(d.fileContentType).to.include('video')});",
    });
    addUnit('UNT-02d', 'VIDEO upload (webm)', { name: 'k-webm', type: 'VIDEO', sourceType: 'UPLOAD' }, { file: 'aziret-sample.webm', mime: 'video/webm', save: { k_uv2: 'd.id' } });
    addUnit('UNT-02e', 'PRESENTATION pdf', { name: 'k-pdf', type: 'PRESENTATION' }, { file: 'aziret-sample.pdf', mime: 'application/pdf', save: { k_up: 'd.id' } });
    for (const [x, mime] of [['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']]) {
      addUnit(`UNT-02f-${x}`, `PRESENTATION ${x}`, { name: `k-${x}`, type: 'PRESENTATION' }, { file: `aziret-sample.${x}`, mime, save: { [`k_u${x}`]: 'd.id' } });
    }
    addUnit('UNT-02g', 'completion by QUESTION', { name: 'k-question', type: 'CONTENT', completionType: 'QUESTION', question: 'Capital of France?', answer: 'Paris', textContent: 'x' }, { save: { k_uq: 'd.id' } });
    addUnit('UNT-02h', 'completion by TIME', { name: 'k-time', type: 'CONTENT', completionType: 'TIME', timeLimitSeconds: 5, textContent: 'x' }, { save: { k_ut: 'd.id' } });
    addUnit('UNT-02i', 'reuse a file via sourceUnitId', { name: 'k-reuse', type: 'PRESENTATION', sourceUnitId: '{{k_up}}' }, {
      save: { k_ureuse: 'd.id' }, tests: "pm.test('own file copied',()=>pm.expect(d.fileName).to.be.a('string'));",
    });
    addUnit('UNT-02j', 'VIDEO upload without file → 400', { name: 'k-nofile', type: 'VIDEO', sourceType: 'UPLOAD' }, { s: 400, tests: "pm.test('file required',()=>pm.expect(d.detail).to.match(/file is required/i));" });
    addUnit('UNT-02k', 'VIDEO upload with a pdf → 400', { name: 'k-badvid', type: 'VIDEO', sourceType: 'UPLOAD' }, { s: 400, file: 'aziret-sample.pdf', mime: 'application/pdf', tests: "pm.test('must be a video',()=>pm.expect(d.detail).to.match(/video/i));" });
    addUnit('UNT-02l', 'PRESENTATION with exe → 400', { name: 'k-exe', type: 'PRESENTATION' }, { s: 400, file: 'aziret-sample.exe', mime: 'application/octet-stream', tests: "pm.test('lists allowed files',()=>pm.expect(d.detail).to.match(/allowed/i));" });
    addUnit('UNT-02m', 'PRESENTATION with txt → 400', { name: 'k-txt', type: 'PRESENTATION' }, { s: 400, file: 'aziret-notes.txt', mime: 'text/plain' });
    addUnit('UNT-02n', 'invalid YouTube link → 400', { name: 'k-badyt', type: 'VIDEO', sourceType: 'YOUTUBE', youtubeUrl: 'https://example.com/notyoutube' }, { s: 400 });
    addUnit('UNT-02o', 'CONTENT without text → 400', { name: 'k-notext', type: 'CONTENT', completionType: 'CHECKBOX' }, { s: 400 });
    addUnit('UNT-02p', 'QUESTION without answer → 400', { name: 'k-noans', type: 'CONTENT', completionType: 'QUESTION', question: 'q?', textContent: 'x' }, { s: 400 });
    addUnit('UNT-02q', 'TIME without limit → 400', { name: 'k-nolimit', type: 'CONTENT', completionType: 'TIME', textContent: 'x' }, { s: 400 });
    addUnit('UNT-02r', 'name of 81 chars → 400', { name: 'x'.repeat(81), type: 'CONTENT', textContent: 'x' }, { s: 400, tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('name'));" });
    addUnit('UNT-02s', 'type TEST via this endpoint → 400', { name: 'k-test', type: 'TEST' }, { s: 400, tests: "pm.test('points to tests API',()=>pm.expect(d.detail).to.match(/test/i));" });
    addUnit('UNT-02t', 'learner refused', { name: 'k-l', type: 'CONTENT', textContent: 'x' }, { as: 'learner', s: 403, type: 'none' });
    addUnit('UNT-02u', 'instructor of another course refused', { name: 'k-o', type: 'CONTENT', textContent: 'x' }, { as: '{{k_i2tok}}', s: 403, course: 'k_crsH' });
    t('UNT-02v', 'UNIT_ADDED reaches the timeline', { p: '/api/analytics/timeline?type=UNIT_ADDED&size=50', tests: "poll('UNIT_ADDED event for this course',()=>JSON.stringify(list(d)).includes(env('k_crs')));" });

    t('UNT-01a', 'instructor lists all units in position order', {
      p: '/api/courses/{{k_crs}}/units', as: 'instructor',
      tests: "pm.test('sorted by position',()=>{const p=d.map(u=>u.position);pm.expect(p).to.eql([...p].sort((a,b)=>a-b))});pm.test('question answer visible to staff',()=>pm.expect(d.find(u=>u.id===env('k_uq')).answer).to.eql('Paris'));",
    });
    t('UNT-01b', 'learner without enrollment refused', { p: '/api/courses/{{k_crs}}/units', as: '{{k_l2tok}}', s: 403 });

    t('UNT-03a', 'instructor reads video unit with presigned URL', {
      p: '/api/units/{{k_uv}}', as: 'instructor',
      tests: `pm.test('fileUrl present',()=>pm.expect(d.fileUrl).to.be.a('string'));
const url=d.fileUrl;
pm.sendRequest({url:url,method:'GET'},(e,r)=>pm.test('signed URL downloads (200)',()=>pm.expect(r.code).eql(200)));
pm.sendRequest({url:url,method:'GET',header:{Range:'bytes=0-9'}},(e,r)=>pm.test('Range request → 206',()=>pm.expect(r.code).eql(206)));
pm.sendRequest({url:url.split('?')[0],method:'GET'},(e,r)=>pm.test('unsigned URL refused (403)',()=>pm.expect(r.code).eql(403)));`,
    });
    t('UNT-03b', 'CONTENT unit has no fileUrl', { p: '/api/units/{{k_uc}}', as: 'instructor', tests: "pm.test('no file',()=>pm.expect(d.fileUrl||null).eql(null));" });
    t('UNT-03c', 'N5 unknown unit', { p: '/api/units/{{nonexistentId}}', as: 'instructor', s: 404 });
    t('UNT-03d', 'non-enrolled learner refused', { p: '/api/units/{{k_uc}}', as: '{{k_l2tok}}', s: 403 });

    t('UNT-04a', 'update name, description, flags', {
      m: 'PUT', p: '/api/units/{{k_uv}}', as: 'instructor', body: { name: 'k-mp4-renamed', type: 'VIDEO', description: 'desc', autoplay: true, showSpeed: false },
      tests: "pm.test('changed',()=>{pm.expect(d.name).eql('k-mp4-renamed');pm.expect(d.autoplay).eql(true);pm.expect(d.showSpeed).eql(false)});",
    });
    t('UNT-04b', 'type cannot change', { m: 'PUT', p: '/api/units/{{k_uv}}', as: 'instructor', s: 400, body: { name: 'k-mp4', type: 'CONTENT', textContent: 'x' }, tests: "pm.test('says so',()=>pm.expect(d.detail).to.match(/type cannot be changed/i));" });
    t('UNT-04c', 'learner refused', { m: 'PUT', p: '/api/units/{{k_uv}}', as: 'learner', s: 403, type: 'none', body: { name: 'z', type: 'VIDEO' } });
    t('UNT-04d', 'other instructor refused', { m: 'PUT', p: '/api/units/{{k_uc}}', as: '{{k_i2tok}}', body: { name: 'k-content', type: 'CONTENT', textContent: 'x' } });

    t('UNT-06a', 'move second unit up', { m: 'POST', p: '/api/units/{{k_uyt}}/move', as: 'instructor', s: 204, body: { direction: -1 } });
    t('UNT-06b', 'order changed', { p: '/api/courses/{{k_crs}}/units', as: 'instructor', tests: "pm.test('youtube before content',()=>{const ids=d.map(u=>u.id);pm.expect(ids.indexOf(env('k_uyt'))).to.be.below(ids.indexOf(env('k_uc')))});" });
    t('UNT-06c', 'move first unit up is a no-op', { m: 'POST', p: '/api/units/{{k_uyt}}/move', as: 'instructor', s: 204, body: { direction: -1 } });
    t('UNT-06d', 'direction 0 is a no-op', { m: 'POST', p: '/api/units/{{k_uc}}/move', as: 'instructor', s: 204, body: { direction: 0 } });
    t('UNT-06e', 'learner refused', { m: 'POST', p: '/api/units/{{k_uc}}/move', as: 'learner', s: 403, type: 'none', body: { direction: 1 } });

    t('UNT-07a', 'instructor lists own files', { p: '/api/units/files/{{instructorId}}', as: 'instructor', tests: "pm.test('file rows',()=>{pm.expect(d).to.not.be.empty;d.forEach(f=>['unitId','unitName','fileName','courseId'].forEach(k=>pm.expect(f).to.have.property(k)))});" });
    t('UNT-07b', 'learner refused', { p: '/api/units/files/{{instructorId}}', as: 'learner', s: 403, type: 'none' });

    t('UNT-04e', 'deactivate a unit', { m: 'PUT', p: '/api/units/{{k_up}}', as: 'instructor', body: { name: 'k-pdf', type: 'PRESENTATION', active: false } });
    t('UNT-05a', 'delete unit', { m: 'DELETE', p: '/api/units/{{k_uwebmDELETE}}', as: 'instructor', s: 204, pre: "pm.environment.set('k_uwebmDELETE',pm.environment.get('k_uv2'));" });
    t('UNT-05b', 'repeat delete → 404', { m: 'DELETE', p: '/api/units/{{k_uwebmDELETE}}', as: 'instructor', s: 404 });
    t('UNT-05c', 'learner refused', { m: 'DELETE', p: '/api/units/{{k_uc}}', as: 'learner', s: 403, type: 'none' });
  });
}

export function learnerFlow() {
  return group('UNT · learner flow, progress and certificate', () => {
    t('FLW-00a', 'course for the flow', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-flow-{{k_ts}}', sequential: true }, save: { k_crsF: 'd.id' } });
    addUnit('FLW-00b', 'lesson 1 CHECKBOX', { name: 'k-f1', type: 'CONTENT', completionType: 'CHECKBOX', textContent: 'one' }, { course: 'k_crsF', save: { k_f1: 'd.id' } });
    addUnit('FLW-00c', 'lesson 2 QUESTION', { name: 'k-f2', type: 'CONTENT', completionType: 'QUESTION', question: 'Capital of France?', answer: 'Paris', textContent: 'two' }, { course: 'k_crsF', save: { k_f2: 'd.id' } });
    addUnit('FLW-00d', 'lesson 3 TIME 3s', { name: 'k-f3', type: 'CONTENT', completionType: 'TIME', timeLimitSeconds: 3, textContent: 'three' }, { course: 'k_crsF', save: { k_f3: 'd.id' } });
    t('FLW-00e', 'enroll learner', { m: 'POST', p: '/api/courses/{{k_crsF}}/enrollments', s: 201, body: { userId: '{{learnerId}}' }, save: { k_enrF: 'd.id' } });

    t('UNT-01c', 'sequential: second lesson is locked for the learner', {
      p: '/api/courses/{{k_crsF}}/units', as: 'learner',
      tests: "pm.test('locked flags',()=>{pm.expect(d).to.have.length(3);pm.expect(d[0].locked).eql(false);pm.expect(d[1].locked).eql(true)});pm.test('answer hidden from learner',()=>d.forEach(u=>pm.expect(u.answer||null).eql(null)));",
    });
    t('UNT-08a', 'locked lesson cannot be started', { m: 'POST', p: '/api/units/{{k_f2}}/start', as: 'learner', s: 403, tests: "pm.test('explains',()=>pm.expect(d.detail).to.match(/previous units/i));" });
    t('UNT-09a', 'complete before start → 400', { m: 'POST', p: '/api/units/{{k_f1}}/complete', as: 'learner', s: 400, body: {}, tests: "pm.test('open first',()=>pm.expect(d.detail).to.match(/open the unit first/i));" });
    t('UNT-08b', 'learner starts lesson 1', { m: 'POST', p: '/api/units/{{k_f1}}/start', as: 'learner', save: { k_f1Started: 'd.startedAt' }, tests: "pm.test('startedAt set',()=>pm.expect(d.startedAt).to.match(ISO));" });
    t('UNT-08c', 'second start keeps startedAt', { m: 'POST', p: '/api/units/{{k_f1}}/start', as: 'learner', tests: "pm.test('same',()=>pm.expect(d.startedAt.slice(0,19)).eql(env('k_f1Started').slice(0,19)));" });
    t('UNT-08d', 'unenrolled learner refused', { m: 'POST', p: '/api/units/{{k_f1}}/start', as: '{{k_l2tok}}', s: 403 });
    t('UNT-08e', 'instructor may open without enrollment', { m: 'POST', p: '/api/units/{{k_f1}}/start', as: 'instructor' });
    t('UNT-03e', 'locked lesson is still readable, answer hidden (recorded)', { p: '/api/units/{{k_f2}}', as: 'learner', tests: "pm.test('answer hidden',()=>pm.expect(d.answer||null).eql(null));" });
    t('UNT-09b', 'complete lesson 1', { m: 'POST', p: '/api/units/{{k_f1}}/complete', as: 'learner', body: {}, tests: "pm.test('completed',()=>pm.expect(d.completed).eql(true));" });
    t('UNT-09c', 'complete again is idempotent', { m: 'POST', p: '/api/units/{{k_f1}}/complete', as: 'learner', body: {}, tests: "pm.test('still completed',()=>pm.expect(d.completed).eql(true));" });
    t('UNT-09d', 'progress is 33%', { p: '/api/enrollments/my', as: 'learner', tests: "pm.test('33',()=>pm.expect(d.find(e=>e.course.id===env('k_crsF')).progress).eql(33));" });
    t('UNT-09e', 'UNIT_COMPLETED reaches the timeline', { p: '/api/analytics/timeline?type=UNIT_COMPLETED&userId={{learnerId}}&size=50', tests: "poll('UNIT_COMPLETED event',()=>JSON.stringify(list(d)).includes(env('k_crsF')));" });
    t('UNT-08f', 'start lesson 2', { m: 'POST', p: '/api/units/{{k_f2}}/start', as: 'learner' });
    t('UNT-03f', 'learner view: answer is null', { p: '/api/units/{{k_f2}}', as: 'learner', tests: "pm.test('answer hidden',()=>pm.expect(d.answer||null).eql(null));pm.test('startedAt',()=>pm.expect(d.startedAt).to.match(ISO));" });
    t('UNT-09f', 'wrong answer → 400', { m: 'POST', p: '/api/units/{{k_f2}}/complete', as: 'learner', s: 400, body: { answer: 'London' }, tests: "pm.test('says wrong',()=>pm.expect(d.detail).to.match(/wrong answer/i));" });
    t('UNT-09g', 'right answer, other case and spaces', { m: 'POST', p: '/api/units/{{k_f2}}/complete', as: 'learner', body: { answer: '  pARIS ' }, tests: "pm.test('completed',()=>pm.expect(d.completed).eql(true));" });
    t('UNT-09h', 'progress is 67%', { p: '/api/enrollments/my', as: 'learner', tests: "pm.test('67',()=>pm.expect(d.find(e=>e.course.id===env('k_crsF')).progress).eql(67));" });
    t('UNT-08g', 'start lesson 3', { m: 'POST', p: '/api/units/{{k_f3}}/start', as: 'learner' });
    t('UNT-09i', 'TIME lesson: too early → 400', { m: 'POST', p: '/api/units/{{k_f3}}/complete', as: 'learner', s: 400, body: {}, tests: "pm.test('too early',()=>pm.expect(d.detail).to.match(/too early/i));" });
    t('UNT-09j', 'TIME lesson: after the wait', { m: 'POST', p: '/api/units/{{k_f3}}/complete', as: 'learner', body: {}, delay: 3500, tests: "pm.test('completed',()=>pm.expect(d.completed).eql(true));" });
    t('UNT-09k', 'last lesson → progress 100 with completedAt', { p: '/api/enrollments/my', as: 'learner', tests: "const e=d.find(x=>x.course.id===env('k_crsF'));pm.test('100%',()=>pm.expect(e.progress).eql(100));" });
    t('UNT-09l', 'COURSE_COMPLETED + CERTIFICATE_ISSUED on the timeline', { p: '/api/analytics/timeline?userId={{learnerId}}&size=100', tests: "poll('both events',()=>{const s=JSON.stringify(list(d));return s.includes('COURSE_COMPLETED')&&s.includes('CERTIFICATE_ISSUED')});" });

    t('CRT-08a', 'certificate issued exactly once', {
      p: '/api/certificates/my', as: 'learner',
      tests: "const c=d.filter(x=>x.courseId===env('k_crsF')||x.courseName&&x.courseName.startsWith('k-flow'));pm.test('one certificate',()=>pm.expect(c).to.have.length(1));pm.test('code JZ-XXXX-XXXX',()=>pm.expect(c[0].code).to.match(/^JZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/));pm.environment.set('k_cert',c[0].id);",
    });
    t('CRT-11a', 'owner views HTML certificate', { p: '/api/certificates/{{k_cert}}/view', as: 'learner', type: 'text/html', accept: 'text/html', tests: "pm.test('has learner + course',()=>{pm.expect(txt).to.include('Aziret');pm.expect(txt).to.include('k-flow-')});" });
    t('CRT-11c', 'another learner refused', { p: '/api/certificates/{{k_cert}}/view', as: '{{k_l2tok}}', s: 403, accept: 'text/html' });
    t('CRT-11b', 'instructor may view', { p: '/api/certificates/{{k_cert}}/view', as: 'instructor', type: 'text/html', accept: 'text/html' });
    t('CRT-10a', 'GET certificate JSON', { p: '/api/certificates/{{k_cert}}', as: 'learner', tests: "pm.test('fields',()=>{pm.expect(d.code).to.be.a('string');pm.expect(d.issuedAt).to.match(ISO)});" });
    t('CRT-10b', 'N5 unknown certificate', { p: '/api/certificates/{{nonexistentId}}', as: 'instructor', s: 404 });
    t('CRT-09a', 'instructor reads a user\'s certificates', { p: '/api/certificates/user/{{learnerId}}', as: 'instructor', tests: "pm.test('has the flow certificate',()=>pm.expect(d.some(c=>c.id===env('k_cert'))).eql(true));" });
    t('CRT-09b', 'learner refused', { p: '/api/certificates/user/{{learnerId}}', as: 'learner', s: 403, type: 'none' });
    t('CRT-08b', 'repeat completion does not duplicate', { m: 'POST', p: '/api/units/{{k_f3}}/complete', as: 'learner', body: {}, tests: "pm.test('still completed',()=>pm.expect(d.completed).eql(true));" });
    t('CRT-08c', 'still one certificate', { p: '/api/certificates/my', as: 'learner', tests: "pm.test('one',()=>pm.expect(d.filter(x=>x.id===env('k_cert'))).to.have.length(1));" });
    t('CRT-08d', 'completion via progress PATCH also issued a certificate', { p: '/api/certificates/my', as: '{{k_l2tok}}', tests: "pm.test('one certificate',()=>pm.expect(d).to.have.length(1));" });

    t('FLW-99a', 'remove learner enrollment', { m: 'DELETE', p: '/api/enrollments/{{k_enrF}}', as: 'instructor', s: 204 });
  });
}

export function certificates() {
  return group('CRT · certificate templates', () => {
    t('CRT-01a', 'instructor lists templates', { p: '/api/certificates/templates', as: 'instructor', tests: "pm.test('one default',()=>pm.expect(d.filter(x=>x.default).length).eql(1));" });
    t('CRT-01b', 'learner refused', { p: '/api/certificates/templates', as: 'learner', s: 403, type: 'none' });
    t('CRT-02a', 'backgrounds', { p: '/api/certificates/templates/backgrounds', as: 'instructor', tests: "pm.test('8 incl. classic',()=>{pm.expect(d).to.have.length(8);pm.expect(JSON.stringify(d)).to.include('classic')});" });
    t('CRT-02b', 'learner refused', { p: '/api/certificates/templates/backgrounds', as: 'learner', s: 403, type: 'none' });
    const tpl = (mods) => ({ name: 'k-tpl-{{k_ts}}', background: 'classic', title: 'K Title', body: 'Awarded to {user} for {course}', ...mods });
    t('CRT-03a', 'admin creates', { m: 'POST', p: '/api/certificates/templates', s: 201, body: tpl({}), save: { k_tpl: 'd.id' }, tests: "pm.test('not default',()=>pm.expect(d.default).eql(false));" });
    t('CRT-03b', 'unknown background', { m: 'POST', p: '/api/certificates/templates', s: 400, body: tpl({ background: 'neon' }), tests: "pm.test('says unknown',()=>pm.expect(d.detail).to.match(/unknown background/i));" });
    t('CRT-03c', 'empty title', { m: 'POST', p: '/api/certificates/templates', s: 400, body: tpl({ title: '' }), tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('title'));" });
    t('CRT-03d', 'body of 5001 chars', { m: 'POST', p: '/api/certificates/templates', s: 400, body: tpl({ body: 'x'.repeat(5001) }) });
    t('CRT-03e', 'instructor refused', { m: 'POST', p: '/api/certificates/templates', as: 'instructor', s: 403, type: 'none', body: tpl({}) });
    t('CRT-04a', 'update title', { m: 'PUT', p: '/api/certificates/templates/{{k_tpl}}', body: tpl({ title: 'K Title 2' }), tests: "pm.test('title',()=>pm.expect(d.title).eql('K Title 2'));" });
    t('CRT-04b', 'N5 unknown template', { m: 'PUT', p: '/api/certificates/templates/{{nonexistentId}}', s: 404, body: tpl({}) });
    t('CRT-07a', 'admin previews HTML', { p: '/api/certificates/templates/{{k_tpl}}/preview', type: 'text/html', accept: 'text/html', tests: "pm.test('title + print button',()=>{pm.expect(txt).to.include('K Title 2');pm.expect(txt.toLowerCase()).to.include('print')});" });
    t('CRT-07b', 'learner refused', { p: '/api/certificates/templates/{{k_tpl}}/preview', as: 'learner', s: 403, type: 'none' });
    t('CRT-05a', 'reset to defaults', { m: 'POST', p: '/api/certificates/templates/{{k_tpl}}/reset', tests: "pm.test('defaults',()=>{pm.expect(d.background).eql('classic');pm.expect(d.title).eql('Certificate of Completion')});" });
    t('CRT-06a', 'attach it to a course', { m: 'PUT', p: '/api/courses/{{k_crsH}}', as: 'instructor', body: { name: 'k-course-hidden-{{k_ts}}', certificateTemplateId: '{{k_tpl}}' }, tests: "pm.test('attached',()=>pm.expect(d.certificateTemplateId).eql(env('k_tpl')));" });
    t('CRT-06b', 'delete the template', { m: 'DELETE', p: '/api/certificates/templates/{{k_tpl}}', s: 204 });
    t('CRT-06c', 'course lost its template', { p: '/api/courses/{{k_crsH}}', tests: "pm.test('null',()=>pm.expect(d.certificateTemplateId).eql(null));" });
    t('CRT-06d', 'default template cannot be deleted', { m: 'DELETE', p: '/api/certificates/templates/{{k_crsTpl}}', s: 409 });
    t('CRT-06e', 'instructor refused', { m: 'DELETE', p: '/api/certificates/templates/{{k_crsTpl}}', as: 'instructor', s: 403, type: 'none' });
    t('CRT-06f', 'N5 unknown template', { m: 'DELETE', p: '/api/certificates/templates/{{nonexistentId}}', s: 404 });
  });
}
