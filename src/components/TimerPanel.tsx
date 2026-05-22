import { Pause, Play, Sparkles, Square } from 'lucide-react';
import { CorrectionPanel } from './CorrectionPanel';
import { formatDateTime, formatDuration } from '../time';
import type { Course, EditableBreakField, EditableSessionField, StudyBreak, StudySession } from '../types';

type TimerPanelProps = {
  courses: Course[];
  activeSession: StudySession | null;
  activeCourse: Course | null;
  activeBreak: StudyBreak | null;
  latestEditableBreaks: StudyBreak[];
  latestEditable: StudySession | null;
  canCorrectLatest: boolean;
  activeStudyMs: number;
  breakMs: number;
  onOpenStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRequestEnd: () => void;
  onUpdateSession: (field: EditableSessionField, value: number) => void;
  onUpdateBreak: (breakId: string, field: EditableBreakField, value: number) => void;
};

export function TimerPanel({
  courses,
  activeSession,
  activeCourse,
  activeBreak,
  latestEditableBreaks,
  latestEditable,
  canCorrectLatest,
  activeStudyMs,
  breakMs,
  onOpenStart,
  onPause,
  onResume,
  onRequestEnd,
  onUpdateSession,
  onUpdateBreak,
}: TimerPanelProps) {
  return (
    <section className="panel timer-panel" id="timer">
      <div className="timer-copy">
        <p className="eyebrow">
          <Sparkles size={14} /> Study Attendance
        </p>
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
          <span>
            {activeSession
              ? 'Breaks stay out of study totals'
              : `${courses.filter((course) => !course.archived).length} active courses ready`}
          </span>
        </div>
        {latestEditable && (
          <CorrectionPanel
            session={latestEditable}
            breaks={latestEditableBreaks}
            canCorrectLatest={canCorrectLatest}
            onUpdateSession={onUpdateSession}
            onUpdateBreak={onUpdateBreak}
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
          <button className="primary-action" onClick={onOpenStart}>
            <Play size={18} />
            Start Session
          </button>
        )}
        {activeSession && !activeBreak && (
          <button className="primary-action" onClick={onPause}>
            <Pause size={18} />
            Pause
          </button>
        )}
        {activeSession && activeBreak && (
          <button className="primary-action" onClick={onResume}>
            <Play size={18} />
            Continue
          </button>
        )}
        {activeSession && (
          <button className="secondary-action danger" onClick={onRequestEnd}>
            <Square size={18} />
            End Session
          </button>
        )}
      </div>
    </section>
  );
}
