import { MonthStepper } from './MonthStepper';
import { SessionTable } from './SessionTable';
import type { Course, StudyBreak, StudySession } from '../types';

type CourseDetailPanelProps = {
  selectedCourse: Course | null;
  selectedMonth: number;
  sessions: StudySession[];
  breaksBySession: Map<string, StudyBreak[]>;
  expandedSessions: Set<string>;
  onMonthChange: (selectedMonth: number) => void;
  onToggleSession: (sessionId: string) => void;
  onDeleteSession: (session: StudySession) => void;
};

export function CourseDetailPanel({
  selectedCourse,
  selectedMonth,
  sessions,
  breaksBySession,
  expandedSessions,
  onMonthChange,
  onToggleSession,
  onDeleteSession,
}: CourseDetailPanelProps) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Course Detail</p>
          <h2>{selectedCourse?.name || 'Select a course'}</h2>
        </div>
        <MonthStepper selectedMonth={selectedMonth} onChange={onMonthChange} />
      </div>
      <SessionTable
        sessions={sessions}
        breaksBySession={breaksBySession}
        expandedSessions={expandedSessions}
        onToggle={onToggleSession}
        onDelete={onDeleteSession}
      />
    </section>
  );
}
