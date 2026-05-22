export type Course = {
  id: string;
  name: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
};

export type StudySessionStatus = 'running' | 'paused' | 'ended';

export type StudySession = {
  id: string;
  courseId: string;
  startedAt: number;
  endedAt: number | null;
  status: StudySessionStatus;
  createdAt: number;
  updatedAt: number;
};

export type StudyBreak = {
  id: string;
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type AppData = {
  courses: Course[];
  sessions: StudySession[];
  breaks: StudyBreak[];
};

export type TimeRange = {
  start: number;
  end: number;
};

export type EditableSessionField = 'startedAt' | 'endedAt';

export type EditableBreakField = 'startedAt' | 'endedAt';
