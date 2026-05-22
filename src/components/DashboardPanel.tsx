import { Clock3, Flame, Trash2 } from 'lucide-react';
import { MonthStepper } from './MonthStepper';
import { formatDuration, formatMonthLabel } from '../time';
import type { Course } from '../types';

export type DashboardRow = {
  course: Course;
  durationMs: number;
};

type DashboardPanelProps = {
  period: 'week' | 'month';
  selectedMonth: number;
  selectedCourseId: string | null;
  rows: DashboardRow[];
  totalMs: number;
  emptyCourseCount: number;
  onPeriodChange: (period: 'week' | 'month') => void;
  onMonthChange: (selectedMonth: number) => void;
  onCourseSelect: (courseId: string) => void;
  onRemoveEmptyCourses: () => void;
};

export function DashboardPanel({
  period,
  selectedMonth,
  selectedCourseId,
  rows,
  totalMs,
  emptyCourseCount,
  onPeriodChange,
  onMonthChange,
  onCourseSelect,
  onRemoveEmptyCourses,
}: DashboardPanelProps) {
  return (
    <section className="panel" id="dashboard">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            <Flame size={14} /> Mini Dashboard
          </p>
          <h2>{period === 'week' ? 'This Week' : formatMonthLabel(selectedMonth)}</h2>
        </div>
        <div className="controls-row">
          <div className="segmented">
            <button className={period === 'week' ? 'active' : ''} onClick={() => onPeriodChange('week')}>
              Week
            </button>
            <button className={period === 'month' ? 'active' : ''} onClick={() => onPeriodChange('month')}>
              Month
            </button>
          </div>
          {period === 'month' && <MonthStepper selectedMonth={selectedMonth} onChange={onMonthChange} />}
          {emptyCourseCount > 0 && (
            <button
              className="ghost-button cleanup-empty-button"
              type="button"
              onClick={onRemoveEmptyCourses}
              title="Remove all courses with no sessions"
            >
              <Trash2 size={18} />
              Remove Empty
            </button>
          )}
        </div>
      </div>
      <div className="total-strip">
        <Clock3 size={20} />
        <span>Total focused study</span>
        <strong>{formatDuration(totalMs)}</strong>
      </div>
      <div className="course-grid">
        {rows.map((row) => (
          <button
            key={row.course.id}
            className={`course-tile ${selectedCourseId === row.course.id ? 'selected' : ''}`}
            onClick={() => onCourseSelect(row.course.id)}
          >
            <span>{row.course.name}</span>
            <strong>{formatDuration(row.durationMs)}</strong>
            {row.course.archived && <small>Archived</small>}
          </button>
        ))}
      </div>
    </section>
  );
}
