import { Pause, Play, Square } from 'lucide-react';
import { CorrectionPanel } from './CorrectionPanel';
import { formatDuration } from '../time';
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
  const renderTimerActions = () => (
    <>
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
    </>
  );

  return (
    <section className="panel timer-panel" id="timer">
      <div className="timer-copy">
        <h1>{activeSession ? activeCourse?.name : 'Ready to study?'}</h1>
        {latestEditable && (
          <CorrectionPanel
            session={latestEditable}
            breaks={latestEditableBreaks}
            canCorrectLatest={canCorrectLatest}
            onUpdateSession={onUpdateSession}
            onUpdateBreak={onUpdateBreak}
          />
        )}
        <div className="action-row action-row-desktop">{renderTimerActions()}</div>
      </div>

      <div className="timer-stats" aria-label="Active session counters">
        <div className={`stat-card blue emphasis ${!activeSession || activeBreak ? 'inactive' : ''}`}>
          <span>Net focus</span>
          <strong>{formatDuration(activeStudyMs, { live: true })}</strong>
        </div>
        <div className={`stat-card yellow ${!activeBreak ? 'inactive' : ''}`}>
          <span>Breaks</span>
          <strong>{formatDuration(breakMs, { live: true })}</strong>
        </div>
      </div>

      <div className="action-row action-row-mobile">{renderTimerActions()}</div>
    </section>
  );
}
