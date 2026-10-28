import { group, t } from '../lib.mjs';

const hasEvent = (type, idVar) => `poll('${type} event for this course',()=>JSON.stringify(list(d)).includes(env('${idVar}')));`;

export function fixtures() {
  group('CRS-00 · fixtures', () => {
    t('CRS-00a', 'init run suffix', { p: '/api/auth/settings', as: 'none', pre: "pm.environment.set('k_ts',String(Date.now()));" });
    t('CRS-00b', 'second instructor', {
      m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Second', lastName: 'Trainer', email: 'k_i2_{{k_ts}}@example.test', username: 'k_i2_{{k_ts}}', password: 'Aziret123!', userType: 'TRAINER' },
      save: { k_i2: 'd.id' },
    });
    t('CRS-00c', 'second instructor logs in', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_i2_{{k_ts}}', password: 'Aziret123!' }, save: { k_i2tok: 'd.token' } });
    t('CRS-00d', 'unenrolled learner', {
      m: 'POST', p: '/api/users', s: 201, body: { firstName: 'Other', lastName: 'Learner', email: 'k_l2_{{k_ts}}@example.test', username: 'k_l2_{{k_ts}}', password: 'Aziret123!' },
      save: { k_l2: 'd.id' },
    });
    t('CRS-00e', 'unenrolled learner logs in', { m: 'POST', p: '/api/auth/login', as: 'none', body: { username: 'k_l2_{{k_ts}}', password: 'Aziret123!' }, save: { k_l2tok: 'd.token' } });
  });
}

export function categories() {
  return group('CAT · categories', () => {
    t('CAT-01a', 'learner can list', {
      p: '/api/categories', as: 'learner',
      tests: "pm.test('array of {id,name,parentId,price}',()=>{pm.expect(d).to.be.an('array');d.forEach(c=>{pm.expect(c).to.have.property('id');pm.expect(c).to.have.property('name');pm.expect(c).to.have.property('parentId')})});",
    });
    t('CAT-02a', 'admin creates', { m: 'POST', p: '/api/categories', s: 201, body: { name: 'k-cat-a-{{k_ts}}' }, save: { k_cat1: 'd.id' }, tests: "pm.test('has id',()=>pm.expect(d.id).to.match(UUID));" });
    t('CAT-02b', 'instructor creates', { m: 'POST', p: '/api/categories', as: 'instructor', s: 201, body: { name: 'k-cat-b-{{k_ts}}' }, save: { k_cat2: 'd.id' } });
    t('CAT-02c', 'learner refused', { m: 'POST', p: '/api/categories', as: 'learner', s: 403, type: 'none', body: { name: 'x' } });
    t('CAT-02d', 'empty name', { m: 'POST', p: '/api/categories', s: 400, body: { name: '' }, tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('name'));" });
    t('CAT-02e', 'with existing parent', { m: 'POST', p: '/api/categories', s: 201, body: { name: 'k-cat-c-{{k_ts}}', parentId: '{{k_cat1}}' }, save: { k_cat3: 'd.id' }, tests: "pm.test('parent stored',()=>pm.expect(d.parentId).eql(env('k_cat1')));" });
    t('CAT-02f', 'with unknown parent', { m: 'POST', p: '/api/categories', s: 404, body: { name: 'k-cat-d-{{k_ts}}', parentId: '{{nonexistentId}}' } });
    t('CAT-03a', 'rename', { m: 'PUT', p: '/api/categories/{{k_cat2}}', body: { name: 'k-cat-b2-{{k_ts}}' }, tests: "pm.test('renamed',()=>pm.expect(d.name).to.include('k-cat-b2-'));" });
    t('CAT-03b', 'learner cannot rename', { m: 'PUT', p: '/api/categories/{{k_cat2}}', as: 'learner', s: 403, type: 'none', body: { name: 'z' } });
    t('CAT-03c', 'N5 unknown id', { m: 'PUT', p: '/api/categories/{{nonexistentId}}', s: 404, body: { name: 'z' } });
    t('CAT-04a', 'delete empty category', { m: 'DELETE', p: '/api/categories/{{k_cat2}}', s: 204 });
    t('CAT-04b', 'learner cannot delete', { m: 'DELETE', p: '/api/categories/{{k_cat1}}', as: 'learner', s: 403, type: 'none' });
    t('CAT-04c', 'repeat delete → 404', { m: 'DELETE', p: '/api/categories/{{k_cat2}}', s: 404 });
  });
}

export function courses() {
  return group('CRS · courses', () => {
    t('CRS-01a', 'admin list: fields, no deleted', {
      p: '/api/courses',
      tests: "pm.test('fields present',()=>{pm.expect(d).to.not.be.empty;['learnersCount','sequential','certificateTemplateId','hiddenFromCatalog'].forEach(k=>pm.expect(d[0]).to.have.property(k))});",
    });
    t('CRS-01b', 'learner can read', { p: '/api/courses', as: 'learner' });
    t('CRS-01c', 'instructor search', { p: '/api/courses?search=Aziret', as: 'instructor', tests: "pm.test('names match',()=>d.forEach(c=>pm.expect(c.name.toLowerCase()).to.include('aziret')));" });

    t('CRS-02a', 'instructor creates (minimal)', {
      m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-course-{{k_ts}}' },
      save: { k_crs: 'd.id', k_crsTpl: 'd.certificateTemplateId' },
      tests: "pm.test('creator + default certificate',()=>{pm.expect(d.createdBy).eql(env('instructorId'));pm.expect(d.certificateTemplateId).to.match(UUID)});",
    });
    t('CRS-02b', 'creator is INSTRUCTOR on it', {
      p: '/api/courses/{{k_crs}}/enrollments', as: 'instructor',
      tests: "pm.test('creator enrolled as INSTRUCTOR',()=>pm.expect(d.some(e=>e.role==='INSTRUCTOR')).eql(true));",
    });
    t('CRS-02c', 'admin creates (full body)', {
      m: 'POST', p: '/api/courses', s: 201, save: { k_crsA: 'd.id' },
      body: { name: 'k-course-full-{{k_ts}}', code: 'K{{k_ts}}'.slice(0, 20), description: 'full', categoryId: '{{k_cat1}}', price: 12.5, capacity: 5, level: 'Beginner', active: true, sequential: true, hiddenFromCatalog: false, certificateTemplateId: '{{templateId}}' },
      pre: '',
      tests: "pm.test('stored',()=>{pm.expect(d.categoryId).eql(env('k_cat1'));pm.expect(d.capacity).eql(5);pm.expect(d.sequential).eql(true);pm.expect(d.certificateTemplateId).eql(env('templateId'));pm.expect(d.createdBy).eql(env('adminId'))});",
    });
    t('CRS-02d', 'noCertificate=true', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-course-nocert-{{k_ts}}', noCertificate: true }, save: { k_crsNC: 'd.id' }, tests: "pm.test('no template',()=>pm.expect(d.certificateTemplateId).eql(null));" });
    t('CRS-02e', 'hidden course', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-course-hidden-{{k_ts}}', hiddenFromCatalog: true, active: true }, save: { k_crsH: 'd.id' } });
    t('CRS-02f', 'inactive course', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-course-inactive-{{k_ts}}', active: false }, save: { k_crsI: 'd.id' } });
    t('CRS-02g', 'capacity-1 course', { m: 'POST', p: '/api/courses', as: 'instructor', s: 201, body: { name: 'k-course-cap-{{k_ts}}', capacity: 1, active: true }, save: { k_crsCap: 'd.id' } });
    t('CRS-02h', 'learner refused', { m: 'POST', p: '/api/courses', as: 'learner', s: 403, type: 'none', body: { name: 'x' } });
    t('CRS-02i', 'empty name', { m: 'POST', p: '/api/courses', as: 'instructor', s: 400, body: { name: '' }, tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('name'));" });
    t('CRS-02j', 'name of 101 chars', { m: 'POST', p: '/api/courses', as: 'instructor', s: 400, body: { name: 'x'.repeat(101) } });
    t('CRS-02k', 'code of 21 chars', { m: 'POST', p: '/api/courses', as: 'instructor', s: 400, body: { name: 'k-code-{{k_ts}}', code: 'x'.repeat(21) }, tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('code'));" });
    t('CRS-02l', 'unknown category', { m: 'POST', p: '/api/courses', as: 'instructor', s: 404, body: { name: 'k-badcat-{{k_ts}}', categoryId: '{{nonexistentId}}' } });
    t('CRS-02m', 'COURSE_CREATED reaches the timeline', { p: '/api/analytics/timeline?type=COURSE_CREATED&size=50', tests: hasEvent('COURSE_CREATED', 'k_crs') });

    t('CRS-03a', 'get with category name', { p: '/api/courses/{{k_crsA}}', tests: "pm.test('categoryName filled',()=>pm.expect(d.categoryName).to.be.a('string').and.not.empty);" });
    t('CRS-03b', 'N5 unknown id', { p: '/api/courses/{{nonexistentId}}', s: 404 });

    t('CRS-04a', 'owner renames', {
      m: 'PUT', p: '/api/courses/{{k_crs}}', as: 'instructor', body: { name: 'k-course-renamed-{{k_ts}}' },
      tests: "pm.test('renamed, updatedAt not before createdAt',()=>{pm.expect(d.name).to.include('renamed');pm.expect(new Date(d.updatedAt)>=new Date(d.createdAt)).eql(true)});",
    });
    t('CRS-04b', 'admin edits a course they do not own', { m: 'PUT', p: '/api/courses/{{k_crs}}', body: { name: 'k-course-renamed-{{k_ts}}', description: 'by admin' }, tests: "pm.test('description',()=>pm.expect(d.description).eql('by admin'));" });
    t('CRS-04d', 'learner refused', { m: 'PUT', p: '/api/courses/{{k_crs}}', as: 'learner', s: 403, type: 'none', body: { name: 'hijack' } });
    t('CRS-04e', 'sequential on', { m: 'PUT', p: '/api/courses/{{k_crs}}', as: 'instructor', body: { name: 'k-course-renamed-{{k_ts}}', sequential: true }, tests: "pm.test('sequential',()=>pm.expect(d.sequential).eql(true));" });
    t('CRS-04f', 'body without template keeps it', { m: 'PUT', p: '/api/courses/{{k_crs}}', as: 'instructor', body: { name: 'k-course-renamed-{{k_ts}}', sequential: false }, tests: "pm.test('template kept',()=>pm.expect(d.certificateTemplateId).eql(env('k_crsTpl')));" });
    t('CRS-04g', 'noCertificate clears template', { m: 'PUT', p: '/api/courses/{{k_crsNC}}', as: 'instructor', body: { name: 'k-course-nocert-{{k_ts}}', noCertificate: true }, tests: "pm.test('null',()=>pm.expect(d.certificateTemplateId).eql(null));" });
    t('CRS-04h', 'empty name', { m: 'PUT', p: '/api/courses/{{k_crs}}', as: 'instructor', s: 400, body: { name: '' } });
    t('CRS-04i', 'COURSE_UPDATED reaches the timeline', { p: '/api/analytics/timeline?type=COURSE_UPDATED&size=50', tests: hasEvent('COURSE_UPDATED', 'k_crs') });

    t('CRS-09a', 'owner clones', {
      m: 'POST', p: '/api/courses/{{k_crs}}/clone', as: 'instructor', s: 201, save: { k_clone: 'd.id' },
      tests: "pm.test('copy is inactive with (copy) suffix',()=>{pm.expect(d.active).eql(false);pm.expect(d.name).to.match(/\\(copy\\)$/)});",
    });
    t('CRS-09c', 'N5 unknown id', { m: 'POST', p: '/api/courses/{{nonexistentId}}/clone', as: 'instructor', s: 404 });

    t('CRS-12a', 'stats', { p: '/api/courses/stats', tests: "pm.test('stat counters are numbers',()=>['courseCompletions','trainingSeconds','inProgress','activeCourses','assignedCourses'].forEach(k=>pm.expect(d[k]).to.be.a('number')));" });

    t('CRS-05a', 'owner soft-deletes the clone', { m: 'DELETE', p: '/api/courses/{{k_clone}}', as: 'instructor', s: 204 });
    t('CRS-05b', 'GET → 404', { p: '/api/courses/{{k_clone}}', s: 404 });
    t('CRS-05c', 'appears in /deleted', { p: '/api/courses/deleted', tests: "pm.test('listed',()=>pm.expect(d.map(c=>c.id)).to.include(env('k_clone')));" });
    t('CRS-05d', 'repeat delete → 404', { m: 'DELETE', p: '/api/courses/{{k_clone}}', as: 'instructor', s: 404 });
    t('CRS-05e', 'other instructor cannot delete', { m: 'DELETE', p: '/api/courses/{{k_crsH}}', as: '{{k_i2tok}}', s: 403 });
    t('CRS-05f', 'learner cannot delete', { m: 'DELETE', p: '/api/courses/{{k_crsH}}', as: 'learner', s: 403, type: 'none' });
    t('CRS-05g', 'COURSE_DELETED reaches the timeline', { p: '/api/analytics/timeline?type=COURSE_DELETED&size=50', tests: hasEvent('COURSE_DELETED', 'k_clone') });
    t('CRS-06a', 'instructor cannot read the bin', { p: '/api/courses/deleted', as: 'instructor', s: 403, type: 'none' });
    t('CRS-07a', 'restore a course that is not deleted → 404 (recorded)', { m: 'POST', p: '/api/courses/{{k_crs}}/restore', s: 404 });
    t('CRS-07c', 'admin restores', { m: 'POST', p: '/api/courses/{{k_clone}}/restore', tests: "pm.test('back',()=>pm.expect(d.id).eql(env('k_clone')));" });
    t('CRS-07d', 'visible in list again', { p: '/api/courses', tests: "pm.test('listed',()=>pm.expect(d.map(c=>c.id)).to.include(env('k_clone')));" });
    t('CRS-07e', 'COURSE_RESTORED reaches the timeline', { p: '/api/analytics/timeline?type=COURSE_RESTORED&size=50', tests: hasEvent('COURSE_RESTORED', 'k_clone') });
    t('CRS-08a', 'permanent delete of a live course → 404 (recorded)', { m: 'DELETE', p: '/api/courses/{{k_clone}}/permanent', s: 404 });
    t('CRS-08b', 'soft-delete again', { m: 'DELETE', p: '/api/courses/{{k_clone}}', as: 'instructor', s: 204 });
    t('CRS-08d', 'admin purges', { m: 'DELETE', p: '/api/courses/{{k_clone}}/permanent', s: 204 });
    t('CRS-08e', 'gone from bin', { p: '/api/courses/deleted', tests: "pm.test('not listed',()=>pm.expect(d.map(c=>c.id)).to.not.include(env('k_clone')));" });
  });
}

export function enrollments() {
  return group('ENR · enrollments and catalog', () => {
    t('CRS-10a', 'catalog for learner', {
      p: '/api/courses/catalog', as: 'learner',
      tests: "pm.test('only active and visible, with enrolled flag',()=>{d.forEach(x=>{pm.expect(x.course.active).eql(true);pm.expect(x.course.hiddenFromCatalog).eql(false);pm.expect(x.enrolled).to.be.a('boolean')});const ids=d.map(x=>x.course.id);pm.expect(ids).to.not.include(env('k_crsH'));pm.expect(ids).to.not.include(env('k_crsI'))});",
    });
    t('CRS-11a', 'learner self-enrolls', {
      m: 'POST', p: '/api/courses/{{k_crs}}/enroll', as: 'learner', s: 201, save: { k_enr: 'd.id' },
      tests: "pm.test('LEARNER at 0%',()=>{pm.expect(d.role).eql('LEARNER');pm.expect(d.progress).eql(0)});",
    });
    t('CRS-11b', 'enroll twice → 409', { m: 'POST', p: '/api/courses/{{k_crs}}/enroll', as: 'learner', s: 409 });
    t('CRS-11c', 'hidden course is not enrollable → 404 (recorded)', { m: 'POST', p: '/api/courses/{{k_crsH}}/enroll', as: 'learner', s: 404 });
    t('CRS-11d', 'inactive course is not enrollable → 404 (recorded)', { m: 'POST', p: '/api/courses/{{k_crsI}}/enroll', as: 'learner', s: 404 });
    t('CRS-11e', 'fill the single seat', { m: 'POST', p: '/api/courses/{{k_crsCap}}/enroll', as: 'learner', s: 201, save: { k_enrCap: 'd.id' } });
    t('CRS-11f', 'capacity exhausted → 409', { m: 'POST', p: '/api/courses/{{k_crsCap}}/enroll', as: '{{k_l2tok}}', s: 409 });
    t('CRS-11g', 'USER_ENROLLED reaches the timeline', { p: '/api/analytics/timeline?type=USER_ENROLLED&size=50', tests: hasEvent('USER_ENROLLED', 'k_crs') });
    t('CRS-11h', 'enrollment email is recorded', { p: '/api/notifications/history', tests: "poll('USER_ENROLLED mail exists',()=>d.some(m=>m.eventType==='USER_ENROLLED'));" });

    t('ENR-01a', 'instructor lists enrollments', {
      p: '/api/courses/{{k_crs}}/enrollments', as: 'instructor',
      tests: "pm.test('row fields',()=>{pm.expect(d).to.not.be.empty;d.forEach(e=>['userFullName','userEmail','role','progress','enrolledAt'].forEach(k=>pm.expect(e).to.have.property(k)))});",
    });
    t('ENR-02a', 'admin enrolls second learner', { m: 'POST', p: '/api/courses/{{k_crs}}/enrollments', s: 201, body: { userId: '{{k_l2}}' }, save: { k_enr2: 'd.id' }, tests: "pm.test('LEARNER',()=>pm.expect(d.role).eql('LEARNER'));" });
    t('ENR-02b', 'enroll second instructor as INSTRUCTOR', { m: 'POST', p: '/api/courses/{{k_crs}}/enrollments', s: 201, body: { userId: '{{k_i2}}', role: 'INSTRUCTOR' }, save: { k_enrI2: 'd.id' } });
    t('ENR-02c', 'that instructor can now edit', { m: 'PUT', p: '/api/courses/{{k_crs}}', as: '{{k_i2tok}}', body: { name: 'k-course-renamed-{{k_ts}}' } });
    t('ENR-02d', 'duplicate enrollment → 409', { m: 'POST', p: '/api/courses/{{k_crs}}/enrollments', s: 409, body: { userId: '{{k_l2}}' } });
    t('ENR-02e', 'unknown user → 404', { m: 'POST', p: '/api/courses/{{k_crs}}/enrollments', s: 404, body: { userId: '{{nonexistentId}}' } });
    t('ENR-02f', 'learner refused', { m: 'POST', p: '/api/courses/{{k_crs}}/enrollments', as: 'learner', s: 403, type: 'none', body: { userId: '{{k_l2}}' } });
    t('ENR-02g', 'missing userId', { m: 'POST', p: '/api/courses/{{k_crs}}/enrollments', s: 400, body: {}, tests: "pm.test('names field',()=>pm.expect(d.detail).to.include('userId'));" });

    t('ENR-03a', 'my enrollments', {
      p: '/api/enrollments/my', as: 'learner',
      tests: "pm.test('shape',()=>{const e=d.find(x=>x.course&&x.course.id===env('k_crs'));pm.expect(e).to.be.an('object');['enrollmentId','role','progress','enrolledAt','course','instructors'].forEach(k=>pm.expect(e).to.have.property(k))});",
    });
    t('ENR-03b', 'role filter', { p: '/api/enrollments/my?role=INSTRUCTOR', as: 'learner', tests: "pm.test('no learner rows',()=>d.forEach(e=>pm.expect(e.role).eql('INSTRUCTOR')));" });
    t('ENR-03c', 'new user has none', { p: '/api/enrollments/my', as: '{{k_i2tok}}', tests: "pm.test('instructor-only rows',()=>d.forEach(e=>pm.expect(e.role).eql('INSTRUCTOR')));" });
    t('ENR-04a', 'my stats', { p: '/api/enrollments/my/stats', as: 'learner', tests: "pm.test('numbers',()=>{pm.expect(d.trainingSeconds).to.be.a('number').and.at.least(0)});" });
    t('ENR-05a', 'staff reads a user\'s enrollments', { p: '/api/enrollments/user/{{learnerId}}', as: 'instructor' });
    t('ENR-05b', 'learner refused', { p: '/api/enrollments/user/{{learnerId}}', as: 'learner', s: 403, type: 'none' });

    t('ENR-06a', 'progress 50', { m: 'PATCH', p: '/api/enrollments/{{k_enr2}}/progress', as: 'instructor', body: { progress: 50 }, tests: "pm.test('50 and not completed',()=>{pm.expect(d.progress).eql(50);pm.expect(d.completedAt).eql(null)});" });
    t('ENR-06b', 'progress 150 is capped', { m: 'PATCH', p: '/api/enrollments/{{k_enr2}}/progress', as: 'instructor', body: { progress: 150 }, tests: "pm.test('100',()=>pm.expect(d.progress).eql(100));pm.test('completedAt set',()=>pm.expect(d.completedAt).to.match(ISO));pm.environment.set('k_completedAt',d.completedAt);" });
    t('ENR-06c', 'second 100 keeps completedAt', { m: 'PATCH', p: '/api/enrollments/{{k_enr2}}/progress', as: 'instructor', body: { progress: 100 }, tests: "pm.test('unchanged',()=>pm.expect(d.completedAt.slice(0,19)).eql(env('k_completedAt').slice(0,19)));" });
    t('ENR-06d', 'progress -5 floors at 0', { m: 'PATCH', p: '/api/enrollments/{{k_enr2}}/progress', as: 'instructor', body: { progress: -5 }, tests: "pm.test('0',()=>pm.expect(d.progress).eql(0));" });
    t('ENR-06f', 'N5 unknown id', { m: 'PATCH', p: '/api/enrollments/{{nonexistentId}}/progress', as: 'instructor', s: 404, body: { progress: 10 } });
    t('ENR-06g', 'COURSE_COMPLETED reaches the timeline', { p: '/api/analytics/timeline?type=COURSE_COMPLETED&size=50', tests: hasEvent('COURSE_COMPLETED', 'k_crs') });

    t('ENR-07a', 'learner cannot remove', { m: 'DELETE', p: '/api/enrollments/{{k_enr2}}', as: 'learner', s: 403, type: 'none' });
    t('ENR-07b', 'staff removes', { m: 'DELETE', p: '/api/enrollments/{{k_enr2}}', as: 'instructor', s: 204 });
    t('ENR-07c', 'repeat → 404', { m: 'DELETE', p: '/api/enrollments/{{k_enr2}}', as: 'instructor', s: 404 });
    t('ENR-07d', 'removed from learner\'s list', { p: '/api/enrollments/my', as: '{{k_l2tok}}', tests: "pm.test('not listed',()=>pm.expect(d.map(e=>e.course&&e.course.id)).to.not.include(env('k_crs')));" });
    t('ENR-07e', 'cleanup capacity enrollment', { m: 'DELETE', p: '/api/enrollments/{{k_enrCap}}', as: 'instructor', s: 204 });
  });
}

export function reports() {
  return group('RPT · course reports', () => {
    t('RPT-01a', 'overview', {
      p: '/api/courses/{{k_crs}}/report/overview', as: 'instructor',
      tests: "pm.test('fields',()=>['assignedLearners','completedLearners','learnersInProgress','notStarted','instructors','trainingSeconds','units'].forEach(k=>pm.expect(d).to.have.property(k)));pm.test('assigned = completed + inProgress + notStarted',()=>pm.expect(d.assignedLearners).eql(d.completedLearners+d.learnersInProgress+d.notStarted));",
    });
    t('RPT-02a', 'users report', { p: '/api/courses/{{k_crs}}/report/users', as: 'instructor', tests: "pm.test('row fields',()=>{pm.expect(d).to.not.be.empty;d.forEach(r=>['name','email','role','progress','score','completedAt','seconds'].forEach(k=>pm.expect(r).to.have.property(k)))});" });
    t('RPT-03a', 'matrix', { p: '/api/courses/{{k_crs}}/report/matrix', as: 'instructor', tests: "pm.test('units + rows',()=>{pm.expect(d.units).to.be.an('array');pm.expect(d.rows).to.be.an('array')});" });
    t('RPT-04a', 'files', { p: '/api/courses/{{k_crs}}/files', as: 'instructor', tests: "pm.test('array',()=>pm.expect(d).to.be.an('array'));" });
    for (const [id, path] of [['01', 'report/overview'], ['02', 'report/users'], ['03', 'report/matrix'], ['04', 'files']]) {
      t(`RPT-${id}b`, `${path}: learner refused`, { p: `/api/courses/{{k_crs}}/${path}`, as: 'learner', s: 403, type: 'none' });
      t(`RPT-${id}c`, `${path}: N5 unknown course`, { p: `/api/courses/{{nonexistentId}}/${path}`, as: 'instructor', s: 404 });
    }
  });
}
