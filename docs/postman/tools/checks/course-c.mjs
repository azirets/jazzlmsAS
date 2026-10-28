import { group, t } from '../lib.mjs';

const C = '/api/courses/{{k_crsT}}';
const mc = (n, extra = {}) => ({ type: 'MULTIPLE_CHOICE', text: `k-mc-${n}`, data: { answers: [{ text: 'right', correct: true }, { text: 'wrong', correct: false }] }, ...extra });
const answersPre = (map) => `const a={};${Object.entries(map).map(([v, lit]) => `a[pm.environment.get('${v}')]=${lit};`).join('')}pm.environment.set('k_ans',JSON.stringify({answers:a}));`;
const postQ = (id, title, body, s, o = {}) => t(id, title, { m: 'POST', p: `${C}/questions`, as: o.as || 'instructor', s, body, save: o.save, tests: o.tests, type: o.type });

export function questions() {
  return group('QST · question bank', () => {
    t('QST-00a', 'course for question and test checks', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-tests-{{k_ts}}' }, save: { k_crsT: 'd.id' } });
    t('QST-00b', 'enroll the Setup learner', { m: 'POST', p: `${C}/enrollments`, s: 201, body: { userId: '{{learnerId}}' }, save: { k_enrT: 'd.id' } });

    postQ('QST-02a', 'MULTIPLE_CHOICE: one correct', mc('one'), 201, { save: { k_qmc: 'd.id' }, tests: "pm.test('stored',()=>{pm.expect(d.type).eql('MULTIPLE_CHOICE');pm.expect(d.data.answers).to.have.length(2)});" });
    postQ('QST-02b', 'MULTIPLE_CHOICE: two correct', { type: 'MULTIPLE_CHOICE', text: 'k-mc-two', data: { answers: [{ text: 'a', correct: true }, { text: 'b', correct: true }, { text: 'c', correct: false }] } }, 201, { save: { k_qmc2: 'd.id' } });
    postQ('QST-02c', 'MULTIPLE_CHOICE: single answer → 400', { type: 'MULTIPLE_CHOICE', text: 'x', data: { answers: [{ text: 'a', correct: true }] } }, 400);
    postQ('QST-02d', 'MULTIPLE_CHOICE: nothing correct → 400', { type: 'MULTIPLE_CHOICE', text: 'x', data: { answers: [{ text: 'a', correct: false }, { text: 'b', correct: false }] } }, 400, { tests: "pm.test('asks for a correct answer',()=>pm.expect(d.detail).to.match(/correct/i));" });
    postQ('QST-02e', 'MULTIPLE_CHOICE: blank texts → 400', { type: 'MULTIPLE_CHOICE', text: 'x', data: { answers: [{ text: '', correct: true }, { text: ' ', correct: false }] } }, 400);
    postQ('QST-02f', 'FILL_GAP: [fox]', { type: 'FILL_GAP', text: 'The quick brown [fox] jumps', data: {} }, 201, { save: { k_qfg: 'd.id' } });
    postQ('QST-02g', 'FILL_GAP: alternatives [a|b|c]', { type: 'FILL_GAP', text: 'Pick [a|b|c]', data: {} }, 201);
    postQ('QST-02h', 'FILL_GAP: no gap → 400', { type: 'FILL_GAP', text: 'No gaps here', data: {} }, 400);
    postQ('QST-02i', 'ORDERING: three items', { type: 'ORDERING', text: 'Order', data: { items: ['one', 'two', 'three'] } }, 201, { save: { k_qor: 'd.id' } });
    postQ('QST-02j', 'ORDERING: one item → 400', { type: 'ORDERING', text: 'Order', data: { items: ['one'] } }, 400);
    postQ('QST-02k', 'DRAG_DROP: two pairs', { type: 'DRAG_DROP', text: 'Match', data: { pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }] } }, 201, { save: { k_qdd: 'd.id' } });
    postQ('QST-02l', 'DRAG_DROP: one pair → 400', { type: 'DRAG_DROP', text: 'Match', data: { pairs: [{ left: 'a', right: '1' }] } }, 400);
    postQ('QST-02m', 'DRAG_DROP: empty right side → 400', { type: 'DRAG_DROP', text: 'Match', data: { pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '' }] } }, 400);
    postQ('QST-02n', 'FREE_TEXT: keywords + threshold', { type: 'FREE_TEXT', text: 'Describe Java', data: { options: [{ word: 'java|jvm', mode: 'contains', points: 1 }, { word: 'bytecode', mode: 'contains', points: 1 }], threshold: 2 } }, 201, { save: { k_qft: 'd.id' } });
    postQ('QST-02o', 'FREE_TEXT: no options → 400', { type: 'FREE_TEXT', text: 'Describe', data: {} }, 400);
    postQ('QST-02p', 'RANDOMIZED: pool of 2', { type: 'RANDOMIZED', text: 'Random', data: { pool: ['{{k_qmc}}', '{{k_qmc2}}'] } }, 201, { save: { k_qrn: 'd.id' } });
    postQ('QST-02q', 'RANDOMIZED: empty pool → 400', { type: 'RANDOMIZED', text: 'Random', data: { pool: [] } }, 400);
    postQ('QST-02r', 'RANDOMIZED: nested RANDOMIZED → 400', { type: 'RANDOMIZED', text: 'Random', data: { pool: ['{{k_qrn}}', '{{k_qmc}}'] } }, 400);
    postQ('QST-02s', 'RANDOMIZED: unknown id → 404', { type: 'RANDOMIZED', text: 'Random', data: { pool: ['{{nonexistentId}}', '{{k_qmc}}'] } }, 404);
    postQ('QST-02t', 'text of 5001 chars → 400', mc('long', { text: 'x'.repeat(5001) }), 400);
    postQ('QST-02u', 'unknown type → 400', { type: 'ESSAY', text: 'x', data: {} }, 400);
    postQ('QST-02v', 'learner refused', mc('l'), 403, { as: 'learner', type: 'none' });

    t('QST-01a', 'owner lists questions', {
      p: `${C}/questions`, as: 'instructor',
      tests: "pm.test('fields',()=>{pm.expect(d).to.not.be.empty;d.forEach(q=>['id','type','text','data','usedInTests','courseName'].forEach(k=>pm.expect(q).to.have.property(k)))});",
    });
    t('QST-01b', 'all=true as instructor', { p: `${C}/questions?all=true`, as: 'instructor', tests: "pm.test('includes this course',()=>pm.expect(d.map(q=>q.id)).to.include(env('k_qmc')));" });
    t('QST-01c', 'all=true as admin', { p: `${C}/questions?all=true`, tests: "pm.test('includes this course',()=>pm.expect(d.map(q=>q.id)).to.include(env('k_qmc')));" });
    t('QST-01d', 'search is case-insensitive', { p: `${C}/questions?search=ORDER`, as: 'instructor', tests: "pm.test('matches',()=>{pm.expect(d).to.not.be.empty;d.forEach(q=>pm.expect((q.text+(q.tags||'')).toLowerCase()).to.include('order'))});" });
    t('QST-01e', 'learner refused (answers inside)', { p: `${C}/questions`, as: 'learner', s: 403, type: 'none' });
    t('QST-01f', 'other instructor refused', { p: `${C}/questions`, as: '{{k_i2tok}}', s: 403 });

    t('QST-03a', 'service returns one question with correct flags (direct; gateway route missing, see DEF-GW-02)', { base: '{{courseSvc}}', p: '/api/questions/{{k_qmc}}', as: 'admin', tests: "pm.test('correct flag visible',()=>pm.expect(d.data.answers.some(a=>a.correct===true)).eql(true));" });
    t('QST-03b', 'learner token is refused directly', { base: '{{courseSvc}}', p: '/api/questions/{{k_qmc}}', as: 'learner', s: 401, type: 'none' });
    t('QST-03c', 'update text (direct)', { base: '{{courseSvc}}', m: 'PUT', p: '/api/questions/{{k_qmc2}}', as: 'admin', body: { ...mc('two-renamed'), type: 'MULTIPLE_CHOICE', data: { answers: [{ text: 'a', correct: true }, { text: 'b', correct: false }] } }, tests: "pm.test('renamed',()=>pm.expect(d.text).eql('k-mc-two-renamed'));" });
    t('QST-03d', 'type cannot change (direct)', { base: '{{courseSvc}}', m: 'PUT', p: '/api/questions/{{k_qmc2}}', as: 'admin', s: 400, body: { type: 'FILL_GAP', text: 'x [y]', data: {} } });

    const aiken = 'What is 2+2?\\nA. 3\\nB. 4\\nANSWER: B\\n\\nCapital of France?\\nA. Paris\\nB. Rome\\nANSWER: A';
    t('QST-04a', 'AIKEN dry run creates nothing', {
      m: 'POST', p: `${C}/questions/import?dryRun=true`, as: 'instructor', raw: JSON.stringify({ data: aiken.replace(/\\n/g, '\n') }),
      tests: "pm.test('2 parsed with answers',()=>{pm.expect(d).to.have.length(2);d.forEach(q=>pm.expect(q.data.answers).to.be.an('array'))});", save: {},
    });
    t('QST-04b', 'bank unchanged after dry run', { p: `${C}/questions?search=imported`, as: 'instructor', tests: "pm.test('nothing tagged imported',()=>pm.expect(d).to.eql([]));" });
    t('QST-04c', 'real import', { m: 'POST', p: `${C}/questions/import`, as: 'instructor', raw: JSON.stringify({ data: aiken.replace(/\\n/g, '\n') }), tests: "pm.test('2 created, tagged',()=>{pm.expect(d).to.have.length(2);d.forEach(q=>pm.expect(q.tags).to.include('imported'))});", save: { k_qimp: 'd[0].id' } });
    t('QST-04d', 'unknown answer letter', { m: 'POST', p: `${C}/questions/import`, as: 'instructor', s: 400, raw: JSON.stringify({ data: 'Q?\nA. x\nB. y\nANSWER: Z' }) });
    t('QST-04e', 'question without ANSWER', { m: 'POST', p: `${C}/questions/import`, as: 'instructor', s: 400, raw: JSON.stringify({ data: 'Q?\nA. x\nB. y' }) });
    t('QST-04f', 'empty data', { m: 'POST', p: `${C}/questions/import`, as: 'instructor', s: 400, raw: JSON.stringify({ data: '' }), tests: "pm.test('nothing to import',()=>pm.expect(d.detail).to.match(/nothing to import/i));" });
    t('QST-04g', 'multi-line question text is joined', { m: 'POST', p: `${C}/questions/import?dryRun=true`, as: 'instructor', raw: JSON.stringify({ data: 'First line\nsecond line?\nA. x\nB. y\nANSWER: A' }), tests: "pm.test('one text',()=>{pm.expect(d).to.have.length(1);pm.expect(d[0].text).to.include('First line');pm.expect(d[0].text).to.include('second line')});" });
  });
}

export function tests() {
  return group('TST · tests', () => {
    const mk = (id, title, body, s = 201, o = {}) => t(id, title, { m: 'POST', p: `${C}/tests`, as: o.as || 'instructor', s, body, save: o.save, tests: o.tests, type: o.type });
    const full = [{ questionId: '{{k_qmc}}', weight: 2 }, { questionId: '{{k_qfg}}', weight: 1 }, { questionId: '{{k_qor}}', weight: 1 }, { questionId: '{{k_qdd}}', weight: 1 }, { questionId: '{{k_qft}}', weight: 1 }];
    mk('TST-01a', 'create test with 5 questions', { name: 'k-test-full', passScore: 60, repetitions: 'ALWAYS', showCorrectAnswers: 'WHEN_PASSED', questions: full }, 201, {
      save: { k_tA: 'd.unitId' },
      tests: "pm.test('questionCount/totalWeight',()=>{pm.expect(d.questionCount).eql(5);pm.expect(d.totalWeight).eql(6)});",
    });
    t('TST-01b', 'test shows up as a TEST lesson', { p: `${C}/units`, as: 'instructor', tests: "pm.test('TEST unit present',()=>pm.expect(d.some(u=>u.id===env('k_tA')&&u.type==='TEST')).eql(true));" });
    mk('TST-01c', 'duplicate question counted once', { name: 'k-test-dup', questions: [{ questionId: '{{k_qmc}}', weight: 1 }, { questionId: '{{k_qmc}}', weight: 1 }] }, 201, { save: { k_tDup: 'd.unitId' }, tests: "pm.test('1 question',()=>pm.expect(d.questionCount).eql(1));" });
    mk('TST-01d', 'weight 0 becomes 1', { name: 'k-test-w0', questions: [{ questionId: '{{k_qmc}}', weight: 0 }] }, 201, { save: { k_tW0: 'd.unitId' }, tests: "pm.test('totalWeight 1',()=>pm.expect(d.totalWeight).eql(1));" });
    mk('TST-01e', 'inactive test', { name: 'k-test-off', active: false, questions: [{ questionId: '{{k_qmc}}', weight: 1 }] }, 201, { save: { k_tOff: 'd.unitId' } });
    mk('TST-01f', 'passScore 101 → 400', { name: 'k-test-bad', passScore: 101 }, 400, { tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('passScore'));" });
    mk('TST-01g', 'durationMinutes 0 → 400', { name: 'k-test-bad', durationMinutes: 0 }, 400);
    mk('TST-01h', 'unknown questionId → 404', { name: 'k-test-bad', questions: [{ questionId: '{{nonexistentId}}', weight: 1 }] }, 404);
    mk('TST-01i', 'learner refused', { name: 'k-test-bad' }, 403, { as: 'learner', type: 'none' });
    t('TST-01j', 'inactive test hidden from learner', { p: `${C}/units`, as: 'learner', tests: "pm.test('not listed',()=>pm.expect(d.map(u=>u.id)).to.not.include(env('k_tOff')));" });
    t('TST-01k', 'UNIT_ADDED unitType TEST on timeline', { p: '/api/analytics/timeline?type=UNIT_ADDED&size=50', tests: "poll('TEST unit event',()=>JSON.stringify(list(d)).includes('TEST')&&JSON.stringify(list(d)).includes(env('k_crsT')));" });

    t('TST-02a', 'instructor sees questions with correct data and all attempts', { p: '/api/units/{{k_tA}}/test', as: 'instructor', tests: "pm.test('questions + attempts',()=>{pm.expect(d.questions).to.have.length(5);pm.expect(d.attempts).to.be.an('array');pm.expect(JSON.stringify(d.questions)).to.include('correct')});" });
    t('TST-02b', 'learner sees settings only', {
      p: '/api/units/{{k_tA}}/test', as: 'learner',
      tests: "pm.test('no questions, has flags',()=>{pm.expect(d).to.not.have.property('questions');pm.expect(d.questionCount).eql(5);pm.expect(d.canStart).eql(true);pm.expect(d).to.have.property('passed')});",
    });
    t('TST-02c', 'unenrolled learner refused', { p: '/api/units/{{k_tA}}/test', as: '{{k_l2tok}}', s: 403 });
    t('TST-02d', 'regular lesson id → 400', { p: '/api/units/{{k_f1}}/test', as: 'instructor', s: 400, tests: "pm.test('not a test',()=>pm.expect(d.detail).to.match(/not a test/i));" });

    t('TST-03a', 'update name, passScore', { m: 'PUT', p: '/api/units/{{k_tDup}}/test', as: 'instructor', body: { name: 'k-test-dup-renamed', passScore: 40 }, tests: "pm.test('changed',()=>pm.expect(d.passScore).eql(40));" });
    t('TST-03b', 'questions omitted → composition kept', { p: '/api/units/{{k_tDup}}/test', as: 'instructor', tests: "pm.test('still 1',()=>pm.expect(d.questions).to.have.length(1));" });
    t('TST-03c', 'empty list clears composition', { m: 'PUT', p: '/api/units/{{k_tDup}}/test', as: 'instructor', body: { name: 'k-test-dup-renamed', questions: [] }, tests: "pm.test('0 questions',()=>pm.expect(d.questionCount).eql(0));" });
    t('TST-03d', 'learner refused', { m: 'PUT', p: '/api/units/{{k_tDup}}/test', as: 'learner', s: 403, type: 'none', body: { name: 'z' } });
    t('TST-04z', 'empty test cannot be started', { m: 'POST', p: '/api/units/{{k_tDup}}/test/attempts', as: 'learner', s: 400 });

    // ---- attempts and grading
    t('TST-04a', 'learner starts an attempt', {
      m: 'POST', p: '/api/units/{{k_tA}}/test/attempts', as: 'learner', s: 201, save: { k_att: 'd.id' },
      tests: `pm.test('no "correct" anywhere',()=>pm.expect(JSON.stringify(d)).to.not.include('"correct"'));
pm.test('5 questions, MC options have ids',()=>{pm.expect(d.questions).to.have.length(5);const m=d.questions.find(q=>q.type==='MULTIPLE_CHOICE');m.options.forEach(o=>pm.expect(o).to.have.property('id'))});
pm.test('FILL_GAP template with gaps',()=>{const g=d.questions.find(q=>q.type==='FILL_GAP');pm.expect(g.text).to.include('{{0}}');pm.expect(g.gaps).to.be.an('array')});
pm.test('DRAG_DROP lefts/rights',()=>{const g=d.questions.find(q=>q.type==='DRAG_DROP');pm.expect(g.lefts).to.be.an('array');pm.expect(g.rights).to.be.an('array')});`,
    });
    t('TST-04b', 'second start returns the open attempt', { m: 'POST', p: '/api/units/{{k_tA}}/test/attempts', as: 'learner', s: 201, tests: "pm.test('same id',()=>pm.expect(d.id).eql(env('k_att')));" });
    t('TST-04c', 'unenrolled learner refused', { m: 'POST', p: '/api/units/{{k_tA}}/test/attempts', as: '{{k_l2tok}}', s: 403 });

    const submit = (id, title, map, tests, s = 200, o = {}) => t(id, title, {
      m: 'POST', p: `/api/units/{{${o.unit || 'k_tA'}}}/test/attempts/{{${o.att || 'k_att'}}}/submit`, as: o.as || 'learner', s,
      pre: answersPre(map), raw: '{{k_ans}}', tests, type: o.type,
    });
    submit('TST-05a', 'empty answers → 0, not passed', {}, "pm.test('score 0',()=>{pm.expect(d.score).eql(0);pm.expect(d.passed).eql(false)});pm.test('WHEN_PASSED hides correctAnswer on fail',()=>d.results.forEach(r=>pm.expect(r).to.not.have.property('correctAnswer')));");
    t('TST-05b', 'resubmitting the same attempt → 409', { m: 'POST', p: '/api/units/{{k_tA}}/test/attempts/{{k_att}}/submit', as: 'learner', s: 409, body: { answers: {} } });
    t('TST-05c', 'N5 unknown attempt', { m: 'POST', p: '/api/units/{{k_tA}}/test/attempts/{{nonexistentId}}/submit', as: 'learner', s: 404, body: { answers: {} } });
    t('TST-04d', 'new attempt after a failure (ALWAYS)', { m: 'POST', p: '/api/units/{{k_tA}}/test/attempts', as: 'learner', s: 201, save: { k_att2: 'd.id' }, tests: "pm.test('fresh attempt',()=>pm.expect(d.id).to.not.eql(env('k_att')));" });
    t('TST-05d', 'someone else\'s attempt → 403', { m: 'POST', p: '/api/units/{{k_tA}}/test/attempts/{{k_att2}}/submit', as: '{{k_l2tok}}', s: 403, body: { answers: {} } });
    submit('TST-05e', 'weight: only MC (w2) right → 2/6 = 33', { k_qmc: '[0]' }, "pm.test('weighted score',()=>pm.expect(d.score).eql(33));pm.test('not passed',()=>pm.expect(d.passed).eql(false));", 200, { att: 'k_att2' });
    t('TST-04e', 'attempt for the full-marks run', { m: 'POST', p: '/api/units/{{k_tA}}/test/attempts', as: 'learner', s: 201, save: { k_att3: 'd.id' } });
    submit('TST-05f', 'everything right → 100, passed, correctAnswer shown', {
      k_qmc: '[0]', k_qfg: "['FOX']", k_qor: '[0,1,2]', k_qdd: "{'0':0,'1':1}", k_qft: "'I like JAVA and its bytecode'",
    }, "pm.test('100 and passed',()=>{pm.expect(d.score).eql(100);pm.expect(d.passed).eql(true)});pm.test('correctAnswer revealed after passing',()=>d.results.forEach(r=>pm.expect(r).to.have.property('correctAnswer')));pm.test('every result correct',()=>d.results.forEach(r=>pm.expect(r.correct).eql(true)));", 200, { att: 'k_att3' });

    t('TST-04f', 'attempt for per-type checks', { m: 'POST', p: '/api/units/{{k_tA}}/test/attempts', as: 'learner', s: 201, save: { k_att4: 'd.id' } });
    submit('TST-05g', 'FREE_TEXT one keyword < threshold, ORDERING swapped, DRAG_DROP crossed → wrong', {
      k_qmc: '[0,1]', k_qfg: "['fox']", k_qor: '[1,0,2]', k_qdd: "{'0':1,'1':0}", k_qft: "'only java'",
    }, "pm.test('only FILL_GAP is right',()=>{const by=Object.fromEntries(d.results.map(r=>[r.questionId,r.correct]));pm.expect(by[env('k_qfg')]).eql(true);[ 'k_qmc','k_qor','k_qdd','k_qft'].forEach(k=>pm.expect(by[env(k)]).eql(false))});", 200, { att: 'k_att4' });
    t('TST-06a', 'learner lists own attempts', { p: '/api/units/{{k_tA}}/test/attempts', as: 'learner', tests: "pm.test('4 attempts with fields',()=>{pm.expect(d).to.have.length(4);d.forEach(a=>['score','passed','startedAt','submittedAt'].forEach(k=>pm.expect(a).to.have.property(k)))});" });
    t('TST-06b', 'instructor filters by userId', { p: '/api/units/{{k_tA}}/test/attempts?userId={{learnerId}}', as: 'instructor', tests: "pm.test('learner attempts',()=>pm.expect(d).to.have.length(4));" });
    t('TST-06c', 'learner userId filter is ignored', { p: '/api/units/{{k_tA}}/test/attempts?userId={{k_l2}}', as: 'learner', tests: "pm.test('still own',()=>pm.expect(d).to.have.length(4));" });
    t('TST-07a', 'instructor sees full results', { p: '/api/units/{{k_tA}}/test/attempts/{{k_att}}', as: 'instructor', tests: "pm.test('results with correctAnswer',()=>d.results.forEach(r=>pm.expect(r).to.have.property('correctAnswer')));" });
    t('TST-07b', 'other learner refused', { p: '/api/units/{{k_tA}}/test/attempts/{{k_att}}', as: '{{k_l2tok}}', s: 403 });
    t('TST-02e', 'learner state after passing', { p: '/api/units/{{k_tA}}/test', as: 'learner', tests: "pm.test('passed with bestScore 100',()=>{pm.expect(d.passed).eql(true);pm.expect(d.bestScore).eql(100)});" });
    t('TST-05h', 'TEST_COMPLETED events on the timeline', { p: '/api/analytics/timeline?type=TEST_COMPLETED&userId={{learnerId}}&size=50', tests: "poll('passed=true and passed=false events',()=>{const s=JSON.stringify(list(d));return s.includes('TEST_COMPLETED')&&list(d).length>=3});" });

    // ---- display flags
    mk('TST-05i', 'test with showScore=false and showLabels=false', { name: 'k-test-hide', showScore: false, showLabels: false, showCorrectAnswers: 'NEVER', repetitions: 'ALWAYS', passScore: 50, questions: [{ questionId: '{{k_qmc}}', weight: 1 }] }, 201, { save: { k_tHide: 'd.unitId' } });
    t('TST-05j', 'start hidden-score attempt', { m: 'POST', p: '/api/units/{{k_tHide}}/test/attempts', as: 'learner', s: 201, save: { k_attH: 'd.id' } });
    submit('TST-05k', 'score and per-question labels are not returned', { k_qmc: '[0]' }, "pm.test('no score',()=>pm.expect(d).to.not.have.property('score'));pm.test('no correct label',()=>d.results.forEach(r=>pm.expect(r).to.not.have.property('correct')));pm.test('no correctAnswer (NEVER)',()=>d.results.forEach(r=>pm.expect(r).to.not.have.property('correctAnswer')));", 200, { unit: 'k_tHide', att: 'k_attH' });

    // ---- repetition policies
    const policy = (key, title, settings, secondStatus) => {
      mk(`TST-04-${key}-1`, `${title}: create`, { name: `k-test-${key}`, passScore: 50, questions: [{ questionId: '{{k_qmc}}', weight: 1 }], ...settings }, 201, { save: { [`k_t${key}`]: 'd.unitId' } });
      t(`TST-04-${key}-2`, `${title}: first attempt`, { m: 'POST', p: `/api/units/{{k_t${key}}}/test/attempts`, as: 'learner', s: 201, save: { [`k_a${key}`]: 'd.id' } });
      submit(`TST-04-${key}-3`, `${title}: pass it`, { k_qmc: '[0]' }, "pm.test('passed',()=>pm.expect(d.passed).eql(true));", 200, { unit: `k_t${key}`, att: `k_a${key}` });
      t(`TST-04-${key}-4`, `${title}: second attempt → ${secondStatus}`, { m: 'POST', p: `/api/units/{{k_t${key}}}/test/attempts`, as: 'learner', s: secondStatus });
    };
    policy('never', 'repetitions NEVER', { repetitions: 'NEVER' }, 403);
    policy('max1', 'maxAttempts 1', { repetitions: 'ALWAYS', maxAttempts: 1 }, 403);
    policy('inp', 'IF_NOT_PASSED after passing', { repetitions: 'IF_NOT_PASSED' }, 403);
    policy('always', 'ALWAYS after passing', { repetitions: 'ALWAYS' }, 201);

    mk('TST-04g', 'time-limited test', { name: 'k-test-timed', durationMinutes: 10, questions: [{ questionId: '{{k_qmc}}', weight: 1 }] }, 201, { save: { k_tTimed: 'd.unitId' } });
    t('TST-04h', 'attempt carries a deadline', {
      m: 'POST', p: '/api/units/{{k_tTimed}}/test/attempts', as: 'learner', s: 201,
      tests: "pm.test('deadline = startedAt + 10 min',()=>{pm.expect(new Date(d.deadline)-new Date(d.startedAt)).eql(10*60*1000)});",
    });

    t('TST-99a', 'PUT test with shuffle flags', { m: 'PUT', p: '/api/units/{{k_tA}}/test', as: 'instructor', body: { name: 'k-test-full', shuffleQuestions: true, shuffleAnswers: true }, tests: "pm.test('flags saved',()=>pm.expect(d.shuffleQuestions).eql(true));" });
    t('QST-03e', 'deleting a question removes it from tests (direct)', { base: '{{courseSvc}}', m: 'DELETE', p: '/api/questions/{{k_qft}}', as: 'admin', s: 204 });
    t('QST-03f', 'test lost one question', { p: '/api/units/{{k_tA}}/test', as: 'instructor', tests: "pm.test('4 left',()=>pm.expect(d.questions).to.have.length(4));" });
    t('QST-03g', 'repeat delete → 404 (direct)', { base: '{{courseSvc}}', m: 'DELETE', p: '/api/questions/{{k_qft}}', as: 'admin', s: 404 });
  });
}

export function cleanup() {
  return group('CRS-99 · cleanup', () => {
    t('CRS-99a', 'remove learner enrollment from the test course', { m: 'DELETE', p: '/api/enrollments/{{k_enrT}}', as: 'instructor', s: 204 });
    for (const v of ['k_crs', 'k_crsA', 'k_crsNC', 'k_crsH', 'k_crsI', 'k_crsCap', 'k_crsF', 'k_crsT']) {
      t(`CRS-99-${v}`, `soft-delete ${v}`, { m: 'DELETE', p: `/api/courses/{{${v}}}`, s: 204 });
    }
    for (const v of ['k_crs', 'k_crsA', 'k_crsNC', 'k_crsH', 'k_crsI', 'k_crsCap', 'k_crsF', 'k_crsT']) {
      t(`CRS-99p-${v}`, `purge ${v}`, { m: 'DELETE', p: `/api/courses/{{${v}}}/permanent`, s: 204 });
    }
    t('CAT-99a', 'delete category', { m: 'DELETE', p: '/api/categories/{{k_cat1}}', s: 204 });
    t('CAT-99b', 'delete child category', { m: 'DELETE', p: '/api/categories/{{k_cat3}}', s: 204 });
    for (const v of ['k_i2', 'k_l2']) t(`CRS-99u-${v}`, `delete fixture user ${v}`, { m: 'DELETE', p: `/api/users/{{${v}}}`, s: 204 });
  });
}
