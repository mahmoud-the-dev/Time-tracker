import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthLabel } from '../time';

type MonthStepperProps = {
  selectedMonth: number;
  onChange: (selectedMonth: number) => void;
};

function addMonths(timestamp: number, amount: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth() + amount, 1).getTime();
}

export function MonthStepper({ selectedMonth, onChange }: MonthStepperProps) {
  return (
    <div className="month-stepper">
      <button aria-label="Previous month" onClick={() => onChange(addMonths(selectedMonth, -1))}>
        <ChevronLeft size={17} />
      </button>
      <span>
        <CalendarDays size={16} />
        {formatMonthLabel(selectedMonth)}
      </span>
      <button aria-label="Next month" onClick={() => onChange(addMonths(selectedMonth, 1))}>
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
