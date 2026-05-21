import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Edit3,
  Flame,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import './styles.css';
import {
  addCourse,
  archiveCourse,
  createSession,
  deleteCourse,
  deleteSession,
  endActiveSession,
  exportData,
  getAppData,
  getLatestEditableSession,
  pauseActiveSession,
  removeCourse,
  renameCourse,
  resumeActiveSession,
  seedInitialData,
  updateBreakTime,
  updateSessionTime,
} from './storage.js';
import {
  clampPeriodOverlap,
  formatDateTime,
  formatDuration,
  formatInputDateTime,
  formatMonthLabel,
  getMonthRange,
  getWeekRange,
  parseInputDateTime,
  sumBreakDuration,
  sumStudyDuration,
} from './time.js';

const INITIAL_FORM = { name: '' };

function App() {
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [breaks, setBreaks] = useState([]);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [period, setPeriod] = useState('week');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const [coursePickerId, setCoursePickerId] = useState('');
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [courseForm, setCourseForm] = useState(INITIAL_FORM);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingCourseName, setEditingCourseName] = useState('');
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    seedInitialData().then(loadData);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!error) return undefined;
    const timer = window.setTimeout(() => setError(''), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!selectedCourseId && courses.length) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  async function loadData() {
    const data = await getAppData();
    setCourses(data.courses);
    setSessions(data.sessions);
    setBreaks(data.breaks);
    setReady(true);
  }

  async function runAction(action, message) {
    setError('');
    try {
      await action();
      await loadData();
      if (message) setToast(message);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    }
  }

  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const breaksBySession = useMemo(() => groupBy(breaks, 'sessionId'), [breaks]);
  const activeSession = sessions.find((session) => !session.endedAt) || null;
  const activeCourse = activeSession ? courseMap.get(activeSession.courseId) : null;
  const activeBreaks = activeSession ? breaksBySession.get(activeSession.id) || [] : [];
  const activeBreak = activeBreaks.find((item) => !item.endedAt) || null;
  const latestEditable = useMemo(() => getLatestEditableSession(sessions), [sessions]);
  const periodRange = period === 'week' ? getWeekRange(now) : getMonthRange(selectedMonth);
  const dashboardRows = useMemo(
    () => buildDashboardRows(courses, sessions, breaksBySession, periodRange),
    [courses, sessions, breaksBySession, periodRange],
  );
  const totalPeriodMs = dashboardRows.reduce((total, row) => total + row.durationMs, 0);
  const selectedCourse = courseMap.get(selectedCourseId) || null;
  const monthRange = getMonthRange(selectedMonth);
  const selectedCourseSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.courseId === selectedCourseId && session.endedAt)
        .filter((session) => clampPeriodOverlap(session.startedAt, session.endedAt, monthRange.start, monthRange.end) > 0)
        .sort((a, b) => b.startedAt - a.startedAt),
    [sessions, selectedCourseId, monthRange.start, monthRange.end],
  );

  const activeStudyMs = activeSession ? sumStudyDuration(activeSession, activeBreaks, now) : 0;
  const breakMs = activeSession ? sumBreakDuration(activeBreaks, now) : 0;
  const canCorrectLatest = latestEditable && (!activeSession || latestEditable.id === activeSession.id);

  function openStart() {
    const activeCourses = courses.filter((course) => !course.archived);
    setCoursePickerId(activeCourses[0]?.id || '');
    setStartOpen(true);
  }

  function toggleSessionExpanded(sessionId) {
    setExpandedSessions((current) => {
      const next = new Set(current);
      next.has(sessionId) ? next.delete(sessionId) : next.add(sessionId);
      return next;
    });
  }

  async function handleStart() {
    await runAction(async () => {
      await createSession(coursePickerId);
      setStartOpen(false);
    }, 'Study session started.');
  }

  async function handleAddCourse(event) {
    event.preventDefault();
    await runAction(async () => {
      await addCourse(courseForm.name);
      setCourseForm(INITIAL_FORM);
    }, 'Course added.');
  }

  async function handleRenameCourse(event) {
    event.preventDefault();
    await runAction(async () => {
      await renameCourse(editingCourseId, editingCourseName);
      setEditingCourseId(null);
      setEditingCourseName('');
    }, 'Course renamed.');
  }

  async function handleRemoveCourse(course) {
    const hasSessions = sessions.some((session) => session.courseId === course.id);
    const message = hasSessions
      ? `"${course.name}" has recorded study time. It will be archived and hidden from active lists, but history will be preserved. Continue?`
      : `Remove "${course.name}" permanently?`;
    if (!window.confirm(message)) return;
    await runAction(async () => removeCourse(course.id), hasSessions ? 'Course archived.' : 'Course removed.');
  }

  async function handleDeleteSession(session) {
    const course = courseMap.get(session.courseId);
    if (!window.confirm(`Delete this ${course?.name || 'course'} study session permanently?`)) return;
    await runAction(async () => deleteSession(session.id), 'Session deleted.');
  }

  async function handleExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `study-time-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) {
    return (
      <main className="loading-shell">
        <Clock3 size={28} />
        <span>Loading study tracker...</span>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><BookOpen size={24} /></div>
          <div>
            <strong>Study Clock</strong>
            <span>Course time tracker</span>
          </div>
        </div>
        <nav className="nav-links">
          <a href="#timer">Timer</a>
          <a href="#dashboard">Dashboard</a>
          <a href="#courses">Courses</a>
        </nav>
        <button className="ghost-button" onClick={handleExport}>
          <Download size={18} />
          Export
        </button>
      </header>

      {toast && (
        <div className="notice success">
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss notice"><X size={16} /></button>
        </div>
      )}
      {error && (
        <div className="notice error">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button>
        </div>
      )}

      <main className="content">
        <section className="panel timer-panel" id="timer">
          <div className="timer-copy">
            <p className="eyebrow"><Sparkles size={14} /> Study Attendance</p>
            <h1>{activeSession ? activeCourse?.name : 'Ready to study?'}</h1>
            <p>
              {activeSession
                ? `${activeBreak ? 'Paused' : 'Working'} since ${formatDateTime(activeSession.startedAt)}`
                : 'Start a session and choose exactly one course for the work block.'}
            </p>
            <div className="timer-meta">
              <span className={`status-pill ${activeBreak ? 'paused' : activeSession ? 'live' : ''}`}>
                {activeBreak ? 'Paused' : activeSession ? 'Live focus' : 'Idle'}
              </span>
              <span>{activeSession ? 'Breaks stay out of study totals' : `${courses.filter((course) => !course.archived).length} active courses ready`}</span>
            </div>
            {latestEditable && (
              <CorrectionPanel
                session={latestEditable}
                breaks={breaksBySession.get(latestEditable.id) || []}
                activeSessionId={activeSession?.id}
                canCorrectLatest={canCorrectLatest}
                onUpdateSession={(field, value) =>
                  runAction(() => updateSessionTime(latestEditable.id, field, value), 'Session time updated.')
                }
                onUpdateBreak={(breakId, field, value) =>
                  runAction(() => updateBreakTime(breakId, field, value), 'Break time updated.')
                }
              />
            )}
          </div>

          <div className="timer-stats">
            <div className="time-orbit" aria-label="Active study time">
              <span>{activeSession ? (activeBreak ? 'Paused' : 'Now') : 'Standby'}</span>
              <strong>{formatDuration(activeStudyMs, { live: true })}</strong>
              <small>net focus</small>
            </div>
            <div className="stat-card blue">
              <span>Studying</span>
              <strong>{formatDuration(activeStudyMs, { live: true })}</strong>
              <small>{activeSession ? 'Net time, breaks excluded' : 'No active session'}</small>
            </div>
            <div className="stat-card yellow">
              <span>Breaks</span>
              <strong>{formatDuration(breakMs, { live: true })}</strong>
              <small>{activeBreak ? 'Currently paused' : 'Total for active session'}</small>
            </div>
          </div>

          <div className="action-row">
            {!activeSession && (
              <button className="primary-action" onClick={openStart}>
                <Play size={18} />
                Start Session
              </button>
            )}
            {activeSession && !activeBreak && (
              <button className="primary-action" onClick={() => runAction(pauseActiveSession, 'Session paused.')}>
                <Pause size={18} />
                Pause
              </button>
            )}
            {activeSession && activeBreak && (
              <button className="primary-action" onClick={() => runAction(resumeActiveSession, 'Session resumed.')}>
                <Play size={18} />
                Continue
              </button>
            )}
            {activeSession && (
              <button className="secondary-action danger" onClick={() => setConfirmEndOpen(true)}>
                <Square size={18} />
                End Session
              </button>
            )}
          </div>
        </section>

        <section className="panel" id="dashboard">
          <div className="section-head">
            <div>
              <p className="eyebrow"><Flame size={14} /> Mini Dashboard</p>
              <h2>{period === 'week' ? 'This Week' : formatMonthLabel(selectedMonth)}</h2>
            </div>
            <div className="controls-row">
              <div className="segmented">
                <button className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>Week</button>
                <button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Month</button>
              </div>
              {period === 'month' && (
                <MonthStepper selectedMonth={selectedMonth} onChange={setSelectedMonth} />
              )}
            </div>
          </div>
          <div className="total-strip">
            <Clock3 size={20} />
            <span>Total focused study</span>
            <strong>{formatDuration(totalPeriodMs)}</strong>
          </div>
          <div className="course-grid">
            {dashboardRows.map((row) => (
              <button
                key={row.course.id}
                className={`course-tile ${selectedCourseId === row.course.id ? 'selected' : ''}`}
                onClick={() => setSelectedCourseId(row.course.id)}
              >
                <span>{row.course.name}</span>
                <strong>{formatDuration(row.durationMs)}</strong>
                {row.course.archived && <small>Archived</small>}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Course Detail</p>
              <h2>{selectedCourse?.name || 'Select a course'}</h2>
            </div>
            <MonthStepper selectedMonth={selectedMonth} onChange={setSelectedMonth} />
          </div>
          <SessionTable
            sessions={selectedCourseSessions}
            breaksBySession={breaksBySession}
            expandedSessions={expandedSessions}
            onToggle={toggleSessionExpanded}
            onDelete={handleDeleteSession}
          />
        </section>

        <section className="panel" id="courses">
          <div className="section-head">
            <div>
              <p className="eyebrow">Course Management</p>
              <h2>Courses</h2>
            </div>
          </div>
          <form className="course-form" onSubmit={handleAddCourse}>
            <input
              value={courseForm.name}
              onChange={(event) => setCourseForm({ name: event.target.value })}
              placeholder="Add a course"
            />
            <button className="icon-text-button" type="submit">
              <Plus size={18} />
              Add
            </button>
          </form>
          <div className="course-list">
            {courses.map((course) => {
              const recorded = sessions.filter((session) => session.courseId === course.id).length;
              const editing = editingCourseId === course.id;
              return (
                <div className="course-row" key={course.id}>
                  {editing ? (
                    <form className="rename-form" onSubmit={handleRenameCourse}>
                      <input
                        value={editingCourseName}
                        onChange={(event) => setEditingCourseName(event.target.value)}
                        autoFocus
                      />
                      <button type="submit">Save</button>
                      <button type="button" onClick={() => setEditingCourseId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <div>
                        <strong>{course.name}</strong>
                        <span>{course.archived ? 'Archived' : 'Active'} / {recorded} sessions</span>
                      </div>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          title="Rename course"
                          onClick={() => {
                            setEditingCourseId(course.id);
                            setEditingCourseName(course.name);
                          }}
                        >
                          <Edit3 size={17} />
                        </button>
                        {course.archived ? (
                          <button className="icon-button" title="Restore course" onClick={() => runAction(() => archiveCourse(course.id, false), 'Course restored.')}>
                            <RotateCcw size={17} />
                          </button>
                        ) : (
                          <button className="icon-button" title="Archive course" onClick={() => runAction(() => archiveCourse(course.id, true), 'Course archived.')}>
                            <Archive size={17} />
                          </button>
                        )}
                        <button className="icon-button danger-icon" title="Remove course" onClick={() => handleRemoveCourse(course)}>
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {startOpen && (
        <Modal title="Start Study Session" onClose={() => setStartOpen(false)}>
          <div className="picker-list">
            {courses.filter((course) => !course.archived).map((course) => (
              <label className="picker-option" key={course.id}>
                <input
                  type="radio"
                  name="course"
                  checked={coursePickerId === course.id}
                  onChange={() => setCoursePickerId(course.id)}
                />
                <span>{course.name}</span>
              </label>
            ))}
          </div>
          <div className="modal-actions">
            <button onClick={() => setStartOpen(false)}>Cancel</button>
            <button className="primary-action compact" disabled={!coursePickerId} onClick={handleStart}>
              <Play size={17} />
              Start
            </button>
          </div>
        </Modal>
      )}

      {confirmEndOpen && activeSession && (
        <Modal title="End Session?" onClose={() => setConfirmEndOpen(false)}>
          <p className="confirm-copy">
            End your {activeCourse?.name} session with {formatDuration(activeStudyMs)} of net study time?
          </p>
          <div className="modal-actions">
            <button onClick={() => setConfirmEndOpen(false)}>Cancel</button>
            <button
              className="secondary-action danger compact"
              onClick={() =>
                runAction(async () => {
                  await endActiveSession();
                  setConfirmEndOpen(false);
                }, 'Session ended.')
              }
            >
              <Square size={17} />
              End
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CorrectionPanel({ session, breaks, activeSessionId, canCorrectLatest, onUpdateSession, onUpdateBreak }) {
  const [sessionStart, setSessionStart] = useState(formatInputDateTime(session.startedAt));
  const [sessionEnd, setSessionEnd] = useState(session.endedAt ? formatInputDateTime(session.endedAt) : '');
  const latestBreak = breaks.toSorted((a, b) => b.startedAt - a.startedAt)[0];
  const [breakStart, setBreakStart] = useState(latestBreak ? formatInputDateTime(latestBreak.startedAt) : '');
  const [breakEnd, setBreakEnd] = useState(latestBreak?.endedAt ? formatInputDateTime(latestBreak.endedAt) : '');

  useEffect(() => {
    setSessionStart(formatInputDateTime(session.startedAt));
    setSessionEnd(session.endedAt ? formatInputDateTime(session.endedAt) : '');
    setBreakStart(latestBreak ? formatInputDateTime(latestBreak.startedAt) : '');
    setBreakEnd(latestBreak?.endedAt ? formatInputDateTime(latestBreak.endedAt) : '');
  }, [session.id, session.startedAt, session.endedAt, latestBreak?.id, latestBreak?.startedAt, latestBreak?.endedAt]);

  if (!canCorrectLatest) return null;

  return (
    <details className="correction-box">
      <summary>
        <Edit3 size={16} />
        Correct latest timing
      </summary>
      <div className="correction-grid">
        <label>
          Session start
          <input type="datetime-local" value={sessionStart} onChange={(event) => setSessionStart(event.target.value)} />
          <button onClick={() => onUpdateSession('startedAt', parseInputDateTime(sessionStart))}>Apply</button>
        </label>
        {session.endedAt && (
          <label>
            Session end
            <input type="datetime-local" value={sessionEnd} onChange={(event) => setSessionEnd(event.target.value)} />
            <button onClick={() => onUpdateSession('endedAt', parseInputDateTime(sessionEnd))}>Apply</button>
          </label>
        )}
        {latestBreak && (
          <>
            <label>
              Latest break start
              <input type="datetime-local" value={breakStart} onChange={(event) => setBreakStart(event.target.value)} />
              <button onClick={() => onUpdateBreak(latestBreak.id, 'startedAt', parseInputDateTime(breakStart))}>Apply</button>
            </label>
            {latestBreak.endedAt && (
              <label>
                Latest break end
                <input type="datetime-local" value={breakEnd} onChange={(event) => setBreakEnd(event.target.value)} />
                <button onClick={() => onUpdateBreak(latestBreak.id, 'endedAt', parseInputDateTime(breakEnd))}>Apply</button>
              </label>
            )}
          </>
        )}
      </div>
      {activeSessionId === session.id && <small>Only the latest session and latest break can be corrected.</small>}
    </details>
  );
}

function MonthStepper({ selectedMonth, onChange }) {
  return (
    <div className="month-stepper">
      <button aria-label="Previous month" onClick={() => onChange(addMonths(selectedMonth, -1))}><ChevronLeft size={17} /></button>
      <span><CalendarDays size={16} />{formatMonthLabel(selectedMonth)}</span>
      <button aria-label="Next month" onClick={() => onChange(addMonths(selectedMonth, 1))}><ChevronRight size={17} /></button>
    </div>
  );
}

function SessionTable({ sessions, breaksBySession, expandedSessions, onToggle, onDelete }) {
  if (!sessions.length) {
    return <div className="empty-state">No completed sessions for this course in the selected month.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Started</th>
            <th>Ended</th>
            <th>Studied</th>
            <th>Breaks</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const sessionBreaks = breaksBySession.get(session.id) || [];
            const expanded = expandedSessions.has(session.id);
            return (
              <React.Fragment key={session.id}>
                <tr>
                  <td>{formatDateTime(session.startedAt)}</td>
                  <td>{formatDateTime(session.endedAt)}</td>
                  <td>{formatDuration(sumStudyDuration(session, sessionBreaks, session.endedAt))}</td>
                  <td>{formatDuration(sumBreakDuration(sessionBreaks, session.endedAt))}</td>
                  <td className="table-actions">
                    <button className="icon-button" title="Show breaks" onClick={() => onToggle(session.id)}>
                      <ChevronDown className={expanded ? 'rotated' : ''} size={17} />
                    </button>
                    <button className="icon-button danger-icon" title="Delete session" onClick={() => onDelete(session)}>
                      <Trash2 size={17} />
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="break-row">
                    <td colSpan="5">
                      {sessionBreaks.length ? (
                        <div className="break-list">
                          {sessionBreaks.map((item) => (
                            <span key={item.id}>
                              {formatDateTime(item.startedAt)} - {item.endedAt ? formatDateTime(item.endedAt) : 'open'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span>No breaks recorded.</span>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function buildDashboardRows(courses, sessions, breaksBySession, range) {
  return courses
    .map((course) => {
      const durationMs = sessions
        .filter((session) => session.courseId === course.id)
        .reduce((total, session) => total + sumStudyDuration(session, breaksBySession.get(session.id) || [], Date.now(), range), 0);
      return { course, durationMs };
    })
    .filter((row) => !row.course.archived || row.durationMs > 0)
    .sort((a, b) => b.durationMs - a.durationMs || a.course.name.localeCompare(b.course.name));
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const value = item[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
  }
  return map;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function addMonths(timestamp, amount) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth() + amount, 1).getTime();
}

createRoot(document.getElementById('root')).render(<App />);
