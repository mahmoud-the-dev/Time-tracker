import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Play, Square } from 'lucide-react';
import { CourseDetailPanel } from './components/CourseDetailPanel';
import { CourseManagementPanel } from './components/CourseManagementPanel';
import { DashboardPanel, type DashboardRow } from './components/DashboardPanel';
import { Modal } from './components/Modal';
import { Notice } from './components/Notice';
import { TimerPanel } from './components/TimerPanel';
import { Topbar } from './components/Topbar';
import {
  addCourse,
  archiveCourse,
  createSession,
  deleteSession,
  endActiveSession,
  exportData,
  getAppData,
  getLatestEditableSession,
  importData,
  pauseActiveSession,
  removeCourse,
  renameCourse,
  resumeActiveSession,
  seedInitialData,
  updateBreakTime,
  updateSessionTime,
} from './storage';
import {
  clampPeriodOverlap,
  formatDuration,
  getMonthRange,
  getWeekRange,
  sumBreakDuration,
  sumStudyDuration,
} from './time';
import type { Course, EditableBreakField, EditableSessionField, StudyBreak, StudySession, TimeRange } from './types';

type Period = 'week' | 'month';
type CourseForm = { name: string };
type AsyncAction = () => Promise<void>;

const INITIAL_FORM: CourseForm = { name: '' };

export function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [breaks, setBreaks] = useState<StudyBreak[]>([]);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [period, setPeriod] = useState<Period>('week');
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [coursePickerId, setCoursePickerId] = useState('');
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseForm>(INITIAL_FORM);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseName, setEditingCourseName] = useState('');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void seedInitialData().then(loadData);
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

  async function loadData(): Promise<void> {
    const data = await getAppData();
    setCourses(data.courses);
    setSessions(data.sessions);
    setBreaks(data.breaks);
    setReady(true);
  }

  async function runAction(action: AsyncAction, message?: string): Promise<void> {
    setError('');
    try {
      await action();
      await loadData();
      if (message) setToast(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const breaksBySession = useMemo(() => groupBy(breaks, 'sessionId'), [breaks]);
  const activeSession = sessions.find((session) => !session.endedAt) || null;
  const activeCourse = activeSession ? courseMap.get(activeSession.courseId) || null : null;
  const activeBreaks = activeSession ? breaksBySession.get(activeSession.id) || [] : [];
  const activeBreak = activeBreaks.find((item) => !item.endedAt) || null;
  const latestEditable = useMemo(() => getLatestEditableSession(sessions), [sessions]);
  const latestEditableBreaks = latestEditable ? breaksBySession.get(latestEditable.id) || [] : [];
  const periodRange = period === 'week' ? getWeekRange(now) : getMonthRange(selectedMonth);
  const dashboardRows = useMemo(
    () => buildDashboardRows(courses, sessions, breaksBySession, periodRange),
    [courses, sessions, breaksBySession, periodRange],
  );
  const totalPeriodMs = dashboardRows.reduce((total, row) => total + row.durationMs, 0);
  const selectedCourse = selectedCourseId ? courseMap.get(selectedCourseId) || null : null;
  const monthRange = getMonthRange(selectedMonth);
  const selectedCourseSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.courseId === selectedCourseId && session.endedAt)
        .filter((session) => clampPeriodOverlap(session.startedAt, session.endedAt || 0, monthRange.start, monthRange.end) > 0)
        .sort((a, b) => b.startedAt - a.startedAt),
    [sessions, selectedCourseId, monthRange.start, monthRange.end],
  );

  const activeStudyMs = activeSession ? sumStudyDuration(activeSession, activeBreaks, now) : 0;
  const breakMs = activeSession ? sumBreakDuration(activeBreaks, now) : 0;
  const canCorrectLatest = Boolean(latestEditable && (!activeSession || latestEditable.id === activeSession.id));

  function openStart(): void {
    const activeCourses = courses.filter((course) => !course.archived);
    setCoursePickerId(activeCourses[0]?.id || '');
    setStartOpen(true);
  }

  function toggleSessionExpanded(sessionId: string): void {
    setExpandedSessions((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }

  async function handleStart(): Promise<void> {
    await runAction(async () => {
      await createSession(coursePickerId);
      setStartOpen(false);
    }, 'Study session started.');
  }

  async function handleAddCourse(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await runAction(async () => {
      await addCourse(courseForm.name);
      setCourseForm(INITIAL_FORM);
    }, 'Course added.');
  }

  async function handleRenameCourse(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await runAction(async () => {
      await renameCourse(editingCourseId, editingCourseName);
      setEditingCourseId(null);
      setEditingCourseName('');
    }, 'Course renamed.');
  }

  async function handleRemoveCourse(course: Course): Promise<void> {
    const hasSessions = sessions.some((session) => session.courseId === course.id);
    const message = hasSessions
      ? `"${course.name}" has recorded study time. It will be archived and hidden from active lists, but history will be preserved. Continue?`
      : `Remove "${course.name}" permanently?`;
    if (!window.confirm(message)) return;
    await runAction(async () => removeCourse(course.id), hasSessions ? 'Course archived.' : 'Course removed.');
  }

  async function handleDeleteSession(session: StudySession): Promise<void> {
    const course = courseMap.get(session.courseId);
    if (!window.confirm(`Delete this ${course?.name || 'course'} study session permanently?`)) return;
    await runAction(async () => deleteSession(session.id), 'Session deleted.');
  }

  async function handleExport(): Promise<void> {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `study-time-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File): Promise<void> {
    await runAction(async () => {
      const text = await file.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Import file must be valid JSON.');
      }
      await importData(data);
      setExpandedSessions(new Set());
      setSelectedCourseId(null);
      setStartOpen(false);
      setConfirmEndOpen(false);
    }, 'Data imported.');
    if (importInputRef.current) importInputRef.current.value = '';
  }

  function handleUpdateSession(field: EditableSessionField, value: number): void {
    if (!latestEditable) return;
    void runAction(() => updateSessionTime(latestEditable.id, field, value), 'Session time updated.');
  }

  function handleUpdateBreak(breakId: string, field: EditableBreakField, value: number): void {
    void runAction(() => updateBreakTime(breakId, field, value), 'Break time updated.');
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
      <Topbar
        importInputRef={importInputRef}
        onExport={() => void handleExport()}
        onImportFile={(file) => void handleImportFile(file)}
      />

      {toast && <Notice kind="success" message={toast} onDismiss={() => setToast('')} />}
      {error && <Notice kind="error" message={error} onDismiss={() => setError('')} />}

      <main className="content">
        <TimerPanel
          courses={courses}
          activeSession={activeSession}
          activeCourse={activeCourse}
          activeBreak={activeBreak}
          latestEditableBreaks={latestEditableBreaks}
          latestEditable={latestEditable}
          canCorrectLatest={canCorrectLatest}
          activeStudyMs={activeStudyMs}
          breakMs={breakMs}
          onOpenStart={openStart}
          onPause={() => void runAction(pauseActiveSession, 'Session paused.')}
          onResume={() => void runAction(resumeActiveSession, 'Session resumed.')}
          onRequestEnd={() => setConfirmEndOpen(true)}
          onUpdateSession={handleUpdateSession}
          onUpdateBreak={handleUpdateBreak}
        />

        <DashboardPanel
          period={period}
          selectedMonth={selectedMonth}
          selectedCourseId={selectedCourseId}
          rows={dashboardRows}
          totalMs={totalPeriodMs}
          onPeriodChange={setPeriod}
          onMonthChange={setSelectedMonth}
          onCourseSelect={setSelectedCourseId}
        />

        <CourseDetailPanel
          selectedCourse={selectedCourse}
          selectedMonth={selectedMonth}
          sessions={selectedCourseSessions}
          breaksBySession={breaksBySession}
          expandedSessions={expandedSessions}
          onMonthChange={setSelectedMonth}
          onToggleSession={toggleSessionExpanded}
          onDeleteSession={(session) => void handleDeleteSession(session)}
        />

        <CourseManagementPanel
          courses={courses}
          sessions={sessions}
          courseForm={courseForm}
          editingCourseId={editingCourseId}
          editingCourseName={editingCourseName}
          onCourseFormChange={setCourseForm}
          onEditingCourseIdChange={setEditingCourseId}
          onEditingCourseNameChange={setEditingCourseName}
          onAddCourse={(event) => void handleAddCourse(event)}
          onRenameCourse={(event) => void handleRenameCourse(event)}
          onArchiveCourse={(courseId, archived) =>
            void runAction(() => archiveCourse(courseId, archived), archived ? 'Course archived.' : 'Course restored.')
          }
          onRemoveCourse={(course) => void handleRemoveCourse(course)}
        />
      </main>

      {startOpen && (
        <Modal title="Start Study Session" onClose={() => setStartOpen(false)}>
          <div className="picker-list">
            {courses
              .filter((course) => !course.archived)
              .map((course) => (
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
            <button className="primary-action compact" disabled={!coursePickerId} onClick={() => void handleStart()}>
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
                void runAction(async () => {
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

function buildDashboardRows(
  courses: Course[],
  sessions: StudySession[],
  breaksBySession: Map<string, StudyBreak[]>,
  range: TimeRange,
): DashboardRow[] {
  return courses
    .map((course) => {
      const durationMs = sessions
        .filter((session) => session.courseId === course.id)
        .reduce(
          (total, session) => total + sumStudyDuration(session, breaksBySession.get(session.id) || [], Date.now(), range),
          0,
        );
      return { course, durationMs };
    })
    .filter((row) => !row.course.archived || row.durationMs > 0)
    .sort((a, b) => b.durationMs - a.durationMs || a.course.name.localeCompare(b.course.name));
}

function groupBy<TItem, TKey extends keyof TItem & string>(items: TItem[], key: TKey): Map<TItem[TKey] & string, TItem[]> {
  const map = new Map<TItem[TKey] & string, TItem[]>();
  for (const item of items) {
    const value = item[key] as TItem[TKey] & string;
    if (!map.has(value)) map.set(value, []);
    map.get(value)?.push(item);
  }
  return map;
}

function startOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}
