import React from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { formatDateTime, formatDuration, sumBreakDuration, sumStudyDuration } from '../time';
import type { StudyBreak, StudySession } from '../types';

type SessionTableProps = {
  sessions: StudySession[];
  breaksBySession: Map<string, StudyBreak[]>;
  expandedSessions: Set<string>;
  onToggle: (sessionId: string) => void;
  onDelete: (session: StudySession) => void;
};

export function SessionTable({ sessions, breaksBySession, expandedSessions, onToggle, onDelete }: SessionTableProps) {
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
                  <td>{formatDuration(sumStudyDuration(session, sessionBreaks, session.endedAt || undefined))}</td>
                  <td>{formatDuration(sumBreakDuration(sessionBreaks, session.endedAt || undefined))}</td>
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
                    <td colSpan={5}>
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
