import type { DragEvent, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Download, Upload } from 'lucide-react';
import { CourseDetailPanel } from './components/CourseDetailPanel';
import { CourseManagementPanel } from './components/CourseManagementPanel';
import { DeleteCourseModal } from './components/DeleteCourseModal';
import { DashboardPanel, type DashboardRow } from './components/DashboardPanel';
import { EndStudySessionModal } from './components/EndStudySessionModal';
import { Notice } from './components/Notice';
import { StartStudySessionModal } from './components/StartStudySessionModal';
import { TimerPanel } from './components/TimerPanel';
import { Topbar } from './components/Topbar';
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
  importData,
  pauseActiveSession,
  renameCourse,
  resumeActiveSession,
  seedInitialData,
  updateBreakTime,
  updateSessionTime,
} from './storage';
import {
  clampPeriodOverlap,
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
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseForm>(INITIAL_FORM);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingCourseName, setEditingCourseName] = useState('');
  const [coursePendingDelete, setCoursePendingDelete] = useState<Course | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [draggingFile, setDraggingFile] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

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
  const activeCourses = useMemo(() => courses.filter((course) => !course.archived), [courses]);
  const breaksBySession = useMemo(() => groupBy(breaks, 'sessionId'), [breaks]);
  const activeSession = sessions.find((session) => !session.endedAt) || null;
  const activeCourse = activeSession ? courseMap.get(activeSession.courseId) || null : null;
  const activeBreaks = activeSession ? breaksBySession.get(activeSession.id) || [] : [];
  const activeBreak = activeBreaks.find((item) => !item.endedAt) || null;
  const latestEditable = useMemo(() => getLatestEditableSession(sessions), [sessions]);
  const latestEditableBreaks = latestEditable ? breaksBySession.get(latestEditable.id) || [] : [];
  const periodRange = period === 'week' ? getWeekRange(now) : getMonthRange(selectedMonth);
  const dashboardRows = useMemo(
    () => buildDashboardRows(activeCourses, sessions, breaksBySession, periodRange),
    [activeCourses, sessions, breaksBySession, periodRange],
  );
  const totalPeriodMs = dashboardRows.reduce((total, row) => total + row.durationMs, 0);
  const selectedCourse = selectedCourseId ? courseMap.get(selectedCourseId) || null : null;
  const visibleSelectedCourse = selectedCourse?.archived ? null : selectedCourse;
  const visibleSelectedCourseId = visibleSelectedCourse?.id || null;
  const monthRange = getMonthRange(selectedMonth);
  const selectedCourseSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.courseId === visibleSelectedCourseId && session.endedAt)
        .filter((session) => clampPeriodOverlap(session.startedAt, session.endedAt || 0, monthRange.start, monthRange.end) > 0)
        .sort((a, b) => b.startedAt - a.startedAt),
    [sessions, visibleSelectedCourseId, monthRange.start, monthRange.end],
  );

  const activeStudyMs = activeSession ? sumStudyDuration(activeSession, activeBreaks, now) : 0;
  const breakMs = activeSession ? sumBreakDuration(activeBreaks, now) : 0;
  const canCorrectLatest = Boolean(latestEditable && (!activeSession || latestEditable.id === activeSession.id));

  useEffect(() => {
    if (selectedCourseId && courseMap.get(selectedCourseId)?.archived) {
      setSelectedCourseId(activeCourses[0]?.id || null);
    } else if (!selectedCourseId && activeCourses.length) {
      setSelectedCourseId(activeCourses[0].id);
    }
  }, [activeCourses, courseMap, selectedCourseId]);

  useEffect(() => {
    function handleSpaceShortcut(event: KeyboardEvent): void {
      if (event.code !== 'Space' || event.repeat || shouldIgnoreSpaceShortcut(event.target)) return;
      if (startOpen || confirmEndOpen || coursePendingDelete) return;

      event.preventDefault();
      if (!activeSession) {
        openStart();
      } else if (activeBreak) {
        void runAction(resumeActiveSession, 'Session resumed.');
      } else {
        void runAction(pauseActiveSession, 'Session paused.');
      }
    }

    window.addEventListener('keydown', handleSpaceShortcut);
    return () => window.removeEventListener('keydown', handleSpaceShortcut);
  }, [activeSession, activeBreak, startOpen, confirmEndOpen, coursePendingDelete]);

  function openStart(): void {
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

  async function handleStart(courseId: string): Promise<void> {
    await runAction(async () => {
      await createSession(courseId);
      setStartOpen(false);
    }, 'Study session started.');
  }

  async function handleQuickAddCourse(name: string): Promise<void> {
    await runAction(async () => {
      const course = await addCourse(name);
      setSelectedCourseId(course.id);
      await createSession(course.id);
      setStartOpen(false);
    }, 'Course added and study session started.');
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

  async function handleDeleteCourse(): Promise<void> {
    if (!coursePendingDelete) return;
    const courseId = coursePendingDelete.id;
    await runAction(async () => {
      await deleteCourse(courseId);
      setCoursePendingDelete(null);
      setExpandedSessions(new Set());
      setSelectedCourseId((current) => (current === courseId ? null : current));
    }, 'Course deleted.');
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
    if (hasStoredData(courses, sessions, breaks)) {
      const confirmed = window.confirm(
        'Importing this file will overwrite all of your current study tracker data. This cannot be undone. Continue?',
      );
      if (!confirmed) {
        if (importInputRef.current) importInputRef.current.value = '';
        return;
      }
    }
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

  function handleDragEnter(event: DragEvent<HTMLDivElement>): void {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDraggingFile(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDraggingFile(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    dragDepthRef.current = 0;
    setDraggingFile(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleImportFile(file);
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
    <div
      className="app-shell"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {draggingFile && (
        <div className="drop-import-overlay">
          <div>
            <strong>Drop to import</strong>
            <span>Your current data will be overwritten after confirmation.</span>
          </div>
        </div>
      )}

      <Topbar />

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
          selectedCourse={visibleSelectedCourse}
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
          onRemoveCourse={setCoursePendingDelete}
        />
      </main>

      <div className="bottom-data-actions" aria-label="Data actions">
        <input
          ref={importInputRef}
          className="file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportFile(file);
          }}
        />
        <button className="ghost-button" onClick={() => importInputRef.current?.click()}>
          <Upload size={18} />
          Import
        </button>
        <button className="ghost-button" onClick={() => void handleExport()}>
          <Download size={18} />
          Export
        </button>
      </div>

      {startOpen && (
        <StartStudySessionModal
          courses={courses}
          onClose={() => setStartOpen(false)}
          onAddCourse={(name) => void handleQuickAddCourse(name)}
          onStart={(courseId) => void handleStart(courseId)}
        />
      )}

      {confirmEndOpen && activeSession && (
        <EndStudySessionModal
          activeCourse={activeCourse}
          activeStudyMs={activeStudyMs}
          onClose={() => setConfirmEndOpen(false)}
          onEnd={() =>
            void runAction(async () => {
              await endActiveSession();
              setConfirmEndOpen(false);
            }, 'Session ended.')
          }
        />
      )}

      {coursePendingDelete && (
        <DeleteCourseModal
          course={coursePendingDelete}
          sessionCount={sessions.filter((session) => session.courseId === coursePendingDelete.id).length}
          onCancel={() => setCoursePendingDelete(null)}
          onDelete={() => void handleDeleteCourse()}
        />
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

function hasStoredData(courses: Course[], sessions: StudySession[], breaks: StudyBreak[]): boolean {
  return courses.length > 0 || sessions.length > 0 || breaks.length > 0;
}

function shouldIgnoreSpaceShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  return Boolean(target.closest('input, textarea, select, button, [role="button"], [contenteditable="true"]'));
}
