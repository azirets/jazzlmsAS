import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page.jsx'
import EnrollmentsTab from '../components/EnrollmentsTab.jsx'
import { fmtDate, fmtDateTime, useApi } from '../components/useApi'
import { api, auth, mode } from '../api/client'

export const UNIT_ICON = { VIDEO: '▶', PRESENTATION: '🖥', CONTENT: '📄', TEST: '☑' }
const COMPLETION = { CHECKBOX: 'checkbox', QUESTION: 'question', TIME: 'timer' }

/**
 * Страница курса. Боковая панель как в TalentLMS: Content, Users & progress, Files, Rules & path, Reports.
 * Rules & path (sequential) — бизнес-правило на сервере: ученик не откроет урок, пока не пройдёт предыдущие.
 */
export default function CourseDetails() {
  const { id } = useParams()
  const nav = useNavigate()
  const staffType = ['SUPER_ADMIN', 'ADMIN', 'TRAINER'].includes(auth.user()?.userType)
  const manage = staffType && mode.canManage()
  const [tab, setTab] = useState('content')
  const [menu, setMenu] = useState(null)      // 'add' | 'more'
  const [reorder, setReorder] = useState(false)
  const menuRef = useRef(null)
  const { data: course, error, reload: reloadCourse } = useApi(`/api/courses/${id}`)
  const { data: units, error: unitsError, reload: reloadUnits } = useApi(`/api/courses/${id}/units`)
  const { data: enrollments } = useApi(manage ? `/api/courses/${id}/enrollments` : null)   // list holds other users' names and emails: staff only
  const { data: files } = useApi(manage ? `/api/courses/${id}/files` : null)

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null) }
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close)
  }, [])

  const removeUnit = async (u) => { if (!confirm(`Delete unit "${u.name}"?`)) return; try { await api.delete(`/api/units/${u.id}`); reloadUnits() } catch (e) { alert(e.message) } }
  const move = async (u, direction) => { try { await api.post(`/api/units/${u.id}/move`, { direction }); reloadUnits() } catch (e) { alert(e.message) } }
  const viewAsLearner = () => { mode.set('learner'); nav(0) }
  const patchCourse = async (patch) => {
    setMenu(null)
    const body = { name: course.name, code: course.code, description: course.description, categoryId: course.categoryId, price: course.price,
      capacity: course.capacity, level: course.level, active: course.active, hiddenFromCatalog: course.hiddenFromCatalog, sequential: course.sequential, ...patch }
    try { await api.put(`/api/courses/${id}`, body); reloadCourse() } catch (e) { alert(e.message) }
  }

  const learners = manage ? (enrollments || []).filter((e) => e.role === 'LEARNER').length : (course?.learnersCount ?? 0)
  const instructors = (enrollments || []).filter((e) => e.role === 'INSTRUCTOR').length
  const done = (units || []).filter((u) => u.completed).length

  return (
    <Page crumbs={manage ? [{ to: '/courses', label: 'Courses' }] : []} title={course?.name || '…'}>
      {error && <div className="error">{error}</div>}
      <div className="course-layout">
        <div>
          <div className="course-head">
            <div className="thumb big">🎓</div>
            <div>
              <h2 style={{ margin: '4px 0' }}>{course?.name}{course && !course.active && <span className="badge">inactive</span>}{course?.sequential && <span className="badge gray" title="Sequential rule set">locked path</span>}</h2>
              <p className="hint" style={{ margin: 0 }}>{course?.description || '-'}</p>
              <p className="hint">{course?.categoryName || 'General'}{course?.level ? ` · ${course.level}` : ''} · updated {fmtDate(course?.updatedAt)}</p>
            </div>
          </div>

          {manage && (
            <div className="toolbar" style={{ margin: '14px 0' }} ref={menuRef}>
              <div className="dropdown">
                <button className="btn btn-primary dropdown-caret" onClick={() => setMenu(menu === 'add' ? null : 'add')}>Add</button>
                {menu === 'add' && (
                  <div className="dropdown-menu add-menu">
                    {/* Полное меню TalentLMS; серые пункты в JazzLMS не реализованы */}
                    <Link to={`/courses/${id}/units/new?type=CONTENT`}>📄 Content</Link>
                    <a className="disabled">☁ Web content</a><hr />
                    <Link to={`/courses/${id}/units/new?type=VIDEO`}>▶ Video</Link>
                    <a className="disabled">🔊 Audio</a>
                    <Link to={`/courses/${id}/units/new?type=PRESENTATION`}>🖥 Presentation | Document</Link><hr />
                    <a className="disabled">📦 SCORM | xAPI | cmi5</a>
                    <a className="disabled">‹/› iFrame</a><hr />
                    <Link to={`/courses/${id}/tests/new`}>☑ Test</Link>
                    <a className="disabled">☑ Survey</a>
                    <a className="disabled">✎ Assignment</a>
                    <a className="disabled">📅 Instructor-led training</a><hr />
                    <a className="disabled">▤ Section</a>
                    <a className="disabled">⧉ Clone from another course</a>
                    <a className="disabled">🔗 Link from another course</a>
                  </div>
                )}
              </div>
              <button className={`btn ${reorder ? 'btn-light' : 'btn-primary'}`} onClick={() => setReorder(!reorder)}>↕ Reorder</button>
              <Link to={`/courses/${id}/edit`} className="btn btn-primary">Edit course</Link>
              <button className="btn btn-primary" onClick={viewAsLearner}>View as Learner</button>
              <div className="dropdown">
                <button className="btn btn-primary" onClick={() => setMenu(menu === 'more' ? null : 'more')}>•••</button>
                {menu === 'more' && course && (
                  <div className="dropdown-menu" style={{ minWidth: 280 }}>
                    <a href="#" className="disabled" onClick={(e) => e.preventDefault()}>✉ Message users <small className="hint">(no messaging yet)</small></a>
                    <a href="#" onClick={(e) => { e.preventDefault(); patchCourse({ hiddenFromCatalog: !course.hiddenFromCatalog }) }}>{course.hiddenFromCatalog ? '🔗 Make course public' : '🙈 Hide from catalog'}</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); patchCourse({ sequential: !course.sequential }) }}>{course.sequential ? '🔓 Unlock course content' : '🔒 Lock course content'}</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); patchCourse({ active: !course.active }) }}>{course.active ? '⏸ Deactivate course' : '▶ Activate course'}</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'content' && (
            <>
              {unitsError && <div className="error">{unitsError}</div>}
              {units?.length === 0 && (
                <div className="dropzone">
                  <div style={{ fontSize: 56 }}>🧩</div>
                  <h3 style={{ color: 'var(--blue-light)' }}>{manage ? 'Add content to your course' : 'No content yet'}</h3>
                  {manage && <p>Click the <b>Add</b> button above to start building your course: video lessons, presentations, text.</p>}
                </div>
              )}
              {!manage && units?.length > 0 && <p className="hint">{done} of {units.length} units completed{course?.sequential ? ' · units open one after another' : ''}</p>}
              {(units || []).map((u, i) => (
                <div className={`unit-row ${u.locked ? 'locked' : ''}`} key={u.id}>
                  <span className="unit-icon">{u.locked ? '🔒' : UNIT_ICON[u.type]}</span>
                  {u.locked ? <span className="hint">{i + 1}. {u.name}</span> : <Link to={`/units/${u.id}`}>{i + 1}. {u.name}</Link>}
                  {!u.active && <span className="badge">inactive</span>}
                  {manage && <span className="hint">&nbsp;{u.type === 'TEST' ? 'test · completed by passing' : `${u.type === 'VIDEO' ? (u.sourceType === 'YOUTUBE' ? 'YouTube' : u.fileName) : u.fileName || 'text'} · ${COMPLETION[u.completionType]}`}</span>}
                  <span className="right">
                    {u.completed && <span className="badge ok">completed</span>}
                    {manage && reorder && <>
                      <button className="link-btn" title="Move up" onClick={() => move(u, -1)}>↑</button>
                      <button className="link-btn" title="Move down" onClick={() => move(u, 1)}>↓</button>
                    </>}
                    {manage && !reorder && <>
                      <Link to={u.type === 'TEST' ? `/units/${u.id}/test/edit` : `/units/${u.id}/edit`}>✎</Link>
                      <button className="link-btn danger" onClick={() => removeUnit(u)}>✕</button>
                    </>}
                  </span>
                </div>
              ))}
            </>
          )}
          {tab === 'users' && <EnrollmentsTab courseId={id} manage={manage} />}
          {tab === 'files' && (
            <table className="grid">
              <thead><tr><th>Name</th><th>Unit</th><th>Type</th><th>Size</th><th>Uploaded</th></tr></thead>
              <tbody>
                {(files || []).map((f) => <tr key={f.unitId}><td><Link to={`/units/${f.unitId}`}>{f.fileName}</Link></td><td>{f.unitName}</td><td>{f.contentType}</td><td>{(f.size / 1024 / 1024).toFixed(1)} MB</td><td>{fmtDateTime(f.uploadedAt)}</td></tr>)}
                {files?.length === 0 && <tr><td colSpan={5} className="hint">No files in this course</td></tr>}
              </tbody>
            </table>
          )}
          {tab === 'rules' && course && (
            <div className="rules-pane">
              <h3>Rules &amp; Path</h3>
              <label className="check" style={{ fontSize: 16 }}>
                <input type="checkbox" checked={course.sequential} onChange={() => patchCourse({ sequential: !course.sequential })} />
                &nbsp;Sequential rule set — learners must complete units in order
              </label>
              <p className="hint">When enabled, course-service refuses to open a unit until every active unit before it is completed
                (<code>UnitService.requireUnlocked</code>). The learner sees a lock icon on the units that are not available yet.</p>
              <p className="hint">Course completion = all active units completed (100 %).</p>
            </div>
          )}
        </div>

        <aside className="course-side">
          <SideItem icon="▦" title="Content" active={tab === 'content'} onClick={() => setTab('content')}
            sub={`${units?.length ?? 0} units · ${(units || []).filter((u) => !u.active).length} inactive`} />
          <SideItem icon="👤" title="Users & progress" active={tab === 'users'} onClick={() => setTab('users')}
            sub={manage ? `${instructors} instructor · ${learners} learners` : `${learners} learners`} />
          {manage && <SideItem icon="📂" title="Files" active={tab === 'files'} onClick={() => setTab('files')} sub={`${files?.length ?? 0} files`} />}
          {manage && <SideItem icon="⛓" title="Rules & path" active={tab === 'rules'} onClick={() => setTab('rules')} sub={course?.sequential ? 'Sequential rule set' : 'Free order'} />}
          {manage && <SideItem icon="◔" title="Reports" active={false} onClick={() => nav(`/courses/${id}/reports`)} sub="Overview · Users · Unit matrix" />}
        </aside>
      </div>
    </Page>
  )
}

function SideItem({ icon, title, sub, active, onClick }) {
  return (
    <div className={`side-item ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="icon">{icon}</div>
      <div><b>{title}</b><br /><small className="hint">{sub}</small></div>
    </div>
  )
}
