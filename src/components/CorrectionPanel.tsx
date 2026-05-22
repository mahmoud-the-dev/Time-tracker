import { useEffect, useMemo, useRef, useState } from 'react';
import { Edit3 } from 'lucide-react';
import { formatFullDateTime, formatInputDateTime, parseInputDateTime } from '../time';
import type { EditableBreakField, EditableSessionField, StudyBreak, StudySession } from '../types';

type CorrectionPanelProps = {
  session: StudySession;
  breaks: StudyBreak[];
  canCorrectLatest: boolean;
  onUpdateSession: (field: EditableSessionField, value: number) => void;
  onUpdateBreak: (breakId: string, field: EditableBreakField, value: number) => void;
};

type CorrectionTarget =
  | {
      kind: 'session';
      field: EditableSessionField;
      action: string;
      timestamp: number;
      value: string;
      setValue: (value: string) => void;
    }
  | {
      kind: 'break';
      breakId: string;
      field: EditableBreakField;
      action: string;
      timestamp: number;
      value: string;
      setValue: (value: string) => void;
    };

export function CorrectionPanel({
  session,
  breaks,
  canCorrectLatest,
  onUpdateSession,
  onUpdateBreak,
}: CorrectionPanelProps) {
  const latestBreak = useMemo(
    () => breaks.toSorted((a, b) => (b.createdAt || b.startedAt) - (a.createdAt || a.startedAt))[0],
    [breaks],
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const [sessionStart, setSessionStart] = useState(formatInputDateTime(session.startedAt));
  const [sessionEnd, setSessionEnd] = useState(session.endedAt ? formatInputDateTime(session.endedAt) : '');
  const [breakStart, setBreakStart] = useState(latestBreak ? formatInputDateTime(latestBreak.startedAt) : '');
  const [breakEnd, setBreakEnd] = useState(latestBreak?.endedAt ? formatInputDateTime(latestBreak.endedAt) : '');
  function openPicker(): void {
    inputRef.current?.focus();
    try {
      inputRef.current?.showPicker?.();
    } catch {
      // Some browsers only allow opening the native picker during the click itself.
    }
  }

  useEffect(() => {
    setSessionStart(formatInputDateTime(session.startedAt));
    setSessionEnd(session.endedAt ? formatInputDateTime(session.endedAt) : '');
    setBreakStart(latestBreak ? formatInputDateTime(latestBreak.startedAt) : '');
    setBreakEnd(latestBreak?.endedAt ? formatInputDateTime(latestBreak.endedAt) : '');
  }, [session.id, session.startedAt, session.endedAt, latestBreak?.id, latestBreak?.startedAt, latestBreak?.endedAt]);

  if (!canCorrectLatest) return null;

  const target: CorrectionTarget = session.endedAt
    ? {
        kind: 'session',
        field: 'endedAt',
        action: 'Finished Your session',
        timestamp: session.endedAt,
        value: sessionEnd,
        setValue: setSessionEnd,
      }
    : latestBreak?.endedAt
      ? {
          kind: 'break',
          breakId: latestBreak.id,
          field: 'endedAt',
          action: 'Finished Your break',
          timestamp: latestBreak.endedAt,
          value: breakEnd,
          setValue: setBreakEnd,
        }
      : latestBreak
        ? {
            kind: 'break',
            breakId: latestBreak.id,
            field: 'startedAt',
            action: 'Started Your break',
            timestamp: latestBreak.startedAt,
            value: breakStart,
            setValue: setBreakStart,
          }
        : {
            kind: 'session',
            field: 'startedAt',
            action: 'Started Your session',
            timestamp: session.startedAt,
            value: sessionStart,
            setValue: setSessionStart,
          };

  function applyCorrection(valueText: string): void {
    target.setValue(valueText);
    const value = parseInputDateTime(valueText);
    if (target.kind === 'session') {
      onUpdateSession(target.field, value);
    } else {
      onUpdateBreak(target.breakId, target.field, value);
    }
  }

  return (
    <div className="correction-box">
      <button className="correction-trigger" type="button" onClick={openPicker}>
        <Edit3 size={16} />
        {`You ${target.action} On ${formatFullDateTime(target.timestamp)}`}
      </button>
      <input
        ref={inputRef}
        className="correction-native-input"
        type="datetime-local"
        value={target.value}
        onChange={(event) => applyCorrection(event.target.value)}
        aria-label={`Correct ${target.action.toLowerCase()} time`}
        tabIndex={-1}
      />
    </div>
  );
}
