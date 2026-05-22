import { z } from 'zod';
import type {
  AppData,
  Course,
  EditableBreakField,
  EditableSessionField,
  StudyBreak,
  StudySession,
} from './types';

const DB_NAME = 'study-time-tracker';
const DB_VERSION = 1;
const INITIAL_COURSES = [
  'Artificial Intelligence and Expert Systems',
  'Basics of Multimedia',
  'Graduation Project CS&IT',
  'Knowledge Management',
  'Research Methodology',
  'Software Engineering II',
];

type StoreName = 'meta' | 'courses' | 'sessions' | 'breaks';

type StoreValueMap = {
  meta: { key: string; value: unknown };
  courses: Course;
  sessions: StudySession;
  breaks: StudyBreak;
};

type Stores<TNames extends readonly StoreName[]> = {
  [K in TNames[number]]: IDBObjectStore;
};

const finiteTimestamp = z.number().finite().nonnegative();
const nullableTimestamp = finiteTimestamp.nullable();

const courseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  archived: z.boolean(),
  createdAt: finiteTimestamp,
  updatedAt: finiteTimestamp,
});

const sessionSchema = z.object({
  id: z.string().min(1),
  courseId: z.string().min(1),
  startedAt: finiteTimestamp,
  endedAt: nullableTimestamp,
  status: z.enum(['running', 'paused', 'ended']),
  createdAt: finiteTimestamp,
  updatedAt: finiteTimestamp,
});

const breakSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  startedAt: finiteTimestamp,
  endedAt: nullableTimestamp,
  createdAt: finiteTimestamp,
  updatedAt: finiteTimestamp,
});

const importedDataSchema = z.object({
  schemaVersion: z.literal(DB_VERSION),
  exportedAt: z.string().datetime(),
  courses: z.array(courseSchema),
  sessions: z.array(sessionSchema),
  breaks: z.array(breakSchema),
});

type ExportedAppData = AppData & { schemaVersion: number; exportedAt: string };

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('courses')) db.createObjectStore('courses', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('breaks')) db.createObjectStore('breaks', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function transact<TNames extends readonly StoreName[], TResult>(
  storeNames: TNames,
  mode: IDBTransactionMode,
  callback: (stores: Stores<TNames>) => Promise<TResult> | TResult,
): Promise<TResult> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)])) as Stores<TNames>;
    let result: TResult;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted.'));
    Promise.resolve(callback(stores)).then((value) => {
      result = value;
    }).catch((error) => {
      tx.abort();
      reject(error);
    });
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll<TStore extends StoreName>(store: IDBObjectStore): Promise<StoreValueMap[TStore][]> {
  return requestToPromise<StoreValueMap[TStore][]>(store.getAll());
}

function get<TStore extends StoreName>(
  store: IDBObjectStore,
  key: IDBValidKey,
): Promise<StoreValueMap[TStore] | undefined> {
  return requestToPromise<StoreValueMap[TStore] | undefined>(store.get(key));
}

function put<TStore extends StoreName>(store: IDBObjectStore, value: StoreValueMap[TStore]): Promise<IDBValidKey> {
  return requestToPromise(store.put(value));
}

function del(store: IDBObjectStore, key: IDBValidKey): Promise<undefined> {
  return requestToPromise(store.delete(key));
}

function clear(store: IDBObjectStore): Promise<undefined> {
  return requestToPromise(store.clear());
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function seedInitialData(): Promise<void> {
  await transact(['meta', 'courses'], 'readwrite', async ({ meta, courses }) => {
    const seeded = await get<'meta'>(meta, 'seeded');
    if (seeded) return;
    const now = Date.now();
    for (const name of INITIAL_COURSES) {
      await put<'courses'>(courses, { id: id('course'), name, archived: false, createdAt: now, updatedAt: now });
    }
    await put<'meta'>(meta, { key: 'seeded', value: true });
  });
}

export async function getAppData(): Promise<AppData> {
  return transact(['courses', 'sessions', 'breaks'], 'readonly', async ({ courses, sessions, breaks }) => ({
    courses: (await getAll<'courses'>(courses)).sort((a, b) => a.name.localeCompare(b.name)),
    sessions: await getAll<'sessions'>(sessions),
    breaks: await getAll<'breaks'>(breaks),
  }));
}

export function getLatestEditableSession(sessions: StudySession[]): StudySession | null {
  return [...sessions].sort((a, b) => (b.createdAt || b.startedAt) - (a.createdAt || a.startedAt))[0] || null;
}

export async function addCourse(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Course name is required.');
  await transact(['courses'], 'readwrite', async ({ courses }) => {
    const existing = await getAll<'courses'>(courses);
    if (existing.some((course) => course.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('A course with this name already exists.');
    }
    const now = Date.now();
    await put<'courses'>(courses, { id: id('course'), name: trimmed, archived: false, createdAt: now, updatedAt: now });
  });
}

export async function renameCourse(courseId: string | null, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Course name is required.');
  await transact(['courses'], 'readwrite', async ({ courses }) => {
    if (!courseId) throw new Error('Course not found.');
    const course = await get<'courses'>(courses, courseId);
    if (!course) throw new Error('Course not found.');
    await put<'courses'>(courses, { ...course, name: trimmed, updatedAt: Date.now() });
  });
}

export async function archiveCourse(courseId: string, archived: boolean): Promise<void> {
  await transact(['courses'], 'readwrite', async ({ courses }) => {
    const course = await get<'courses'>(courses, courseId);
    if (!course) throw new Error('Course not found.');
    await put<'courses'>(courses, { ...course, archived, updatedAt: Date.now() });
  });
}

export async function removeCourse(courseId: string): Promise<void> {
  await transact(['courses', 'sessions'], 'readwrite', async ({ courses, sessions }) => {
    const course = await get<'courses'>(courses, courseId);
    if (!course) throw new Error('Course not found.');
    const allSessions = await getAll<'sessions'>(sessions);
    const hasSessions = allSessions.some((session) => session.courseId === courseId);
    if (hasSessions) {
      await put<'courses'>(courses, { ...course, archived: true, updatedAt: Date.now() });
    } else {
      await del(courses, courseId);
    }
  });
}

export async function deleteCourse(courseId: string): Promise<void> {
  await removeCourse(courseId);
}

export async function createSession(courseId: string): Promise<void> {
  if (!courseId) throw new Error('Choose a course to start.');
  await transact(['courses', 'sessions'], 'readwrite', async ({ courses, sessions }) => {
    const course = await get<'courses'>(courses, courseId);
    if (!course || course.archived) throw new Error('Choose an active course.');
    const allSessions = await getAll<'sessions'>(sessions);
    if (allSessions.some((session) => !session.endedAt)) throw new Error('End the current session before starting a new one.');
    const now = Date.now();
    await put<'sessions'>(sessions, {
      id: id('session'),
      courseId,
      startedAt: now,
      endedAt: null,
      status: 'running',
      createdAt: now,
      updatedAt: now,
    });
  });
}

export async function pauseActiveSession(): Promise<void> {
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const active = await getActiveSession(sessions);
    if (!active) throw new Error('No active session to pause.');
    const allBreaks = await getAll<'breaks'>(breaks);
    if (allBreaks.some((item) => item.sessionId === active.id && !item.endedAt)) throw new Error('Session is already paused.');
    const now = Date.now();
    await put<'sessions'>(sessions, { ...active, status: 'paused', updatedAt: now });
    await put<'breaks'>(breaks, { id: id('break'), sessionId: active.id, startedAt: now, endedAt: null, createdAt: now, updatedAt: now });
  });
}

export async function resumeActiveSession(): Promise<void> {
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const active = await getActiveSession(sessions);
    if (!active) throw new Error('No active session to resume.');
    const allBreaks = await getAll<'breaks'>(breaks);
    const openBreak = allBreaks.find((item) => item.sessionId === active.id && !item.endedAt);
    if (!openBreak) throw new Error('Session is not paused.');
    const now = Date.now();
    await put<'breaks'>(breaks, { ...openBreak, endedAt: now, updatedAt: now });
    await put<'sessions'>(sessions, { ...active, status: 'running', updatedAt: now });
  });
}

export async function endActiveSession(): Promise<void> {
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const active = await getActiveSession(sessions);
    if (!active) throw new Error('No active session to end.');
    const now = Date.now();
    const allBreaks = await getAll<'breaks'>(breaks);
    const openBreak = allBreaks.find((item) => item.sessionId === active.id && !item.endedAt);
    if (openBreak) await put<'breaks'>(breaks, { ...openBreak, endedAt: now, updatedAt: now });
    await put<'sessions'>(sessions, { ...active, endedAt: now, status: 'ended', updatedAt: now });
  });
}

export async function updateSessionTime(sessionId: string, field: EditableSessionField, value: number): Promise<void> {
  if (!['startedAt', 'endedAt'].includes(field)) throw new Error('Unsupported session field.');
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const allSessions = await getAll<'sessions'>(sessions);
    const latest = getLatestEditableSession(allSessions);
    const session = allSessions.find((item) => item.id === sessionId);
    if (!session || latest?.id !== sessionId) throw new Error('Only the latest session can be corrected.');
    const sessionBreaks = (await getAll<'breaks'>(breaks)).filter((item) => item.sessionId === sessionId);
    if (session.endedAt) {
      if (field !== 'endedAt') throw new Error('Only the session end can be corrected.');
    } else if (sessionBreaks.length) {
      throw new Error('Only the latest break point can be corrected.');
    } else if (field !== 'startedAt') {
      throw new Error('Only the session start can be corrected.');
    }
    const next = { ...session, [field]: value, updatedAt: Date.now() };
    validateSession(next, sessionBreaks);
    await put<'sessions'>(sessions, next);
  });
}

export async function updateBreakTime(breakId: string, field: EditableBreakField, value: number): Promise<void> {
  if (!['startedAt', 'endedAt'].includes(field)) throw new Error('Unsupported break field.');
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const allBreaks = await getAll<'breaks'>(breaks);
    const target = allBreaks.find((item) => item.id === breakId);
    if (!target) throw new Error('Break not found.');
    const allSessions = await getAll<'sessions'>(sessions);
    const latestSession = getLatestEditableSession(allSessions);
    if (latestSession?.id !== target.sessionId) throw new Error('Only the latest session break can be corrected.');
    const sessionBreaks = allBreaks.filter((item) => item.sessionId === target.sessionId);
    const latestBreak = getLatestBreak(sessionBreaks);
    if (latestBreak?.id !== breakId) throw new Error('Only the latest break can be corrected.');
    if (latestSession.endedAt) throw new Error('Only the session end can be corrected.');
    if (latestBreak.endedAt) {
      if (field !== 'endedAt') throw new Error('Only the latest break end can be corrected.');
    } else if (field !== 'startedAt') {
      throw new Error('Only the latest break start can be corrected.');
    }
    const nextBreaks = sessionBreaks.map((item) => (item.id === breakId ? { ...item, [field]: value, updatedAt: Date.now() } : item));
    validateSession(latestSession, nextBreaks);
    const nextBreak = nextBreaks.find((item) => item.id === breakId);
    if (!nextBreak) throw new Error('Break not found.');
    await put<'breaks'>(breaks, nextBreak);
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const session = await get<'sessions'>(sessions, sessionId);
    if (!session) throw new Error('Session not found.');
    if (!session.endedAt) throw new Error('End the session before deleting it.');
    const allBreaks = await getAll<'breaks'>(breaks);
    for (const item of allBreaks.filter((breakItem) => breakItem.sessionId === sessionId)) {
      await del(breaks, item.id);
    }
    await del(sessions, sessionId);
  });
}

export async function exportData(): Promise<ExportedAppData> {
  const data = await getAppData();
  return { schemaVersion: DB_VERSION, exportedAt: new Date().toISOString(), ...data };
}

export async function importData(data: unknown): Promise<void> {
  const parsed = importedDataSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new Error(firstIssue ? `Import file is invalid: ${firstIssue.message}` : 'Import file is invalid.');
  }
  validateImportedData(parsed.data);
  await transact(['meta', 'courses', 'sessions', 'breaks'], 'readwrite', async ({ meta, courses, sessions, breaks }) => {
    await clear(courses);
    await clear(sessions);
    await clear(breaks);
    for (const course of parsed.data.courses) await put<'courses'>(courses, course);
    for (const session of parsed.data.sessions) await put<'sessions'>(sessions, session);
    for (const item of parsed.data.breaks) await put<'breaks'>(breaks, item);
    await put<'meta'>(meta, { key: 'seeded', value: true });
  });
}

async function getActiveSession(sessionStore: IDBObjectStore): Promise<StudySession | null> {
  const allSessions = await getAll<'sessions'>(sessionStore);
  return allSessions.find((session) => !session.endedAt) || null;
}

function getLatestBreak(breaks: StudyBreak[]): StudyBreak | null {
  return [...breaks].sort((a, b) => (b.createdAt || b.startedAt) - (a.createdAt || a.startedAt))[0] || null;
}

function validateSession(session: StudySession, breaks: StudyBreak[]): void {
  if (!Number.isFinite(session.startedAt)) throw new Error('Session start time is invalid.');
  if (session.endedAt && session.endedAt <= session.startedAt) throw new Error('Session end must be after session start.');
  const sessionEnd = session.endedAt || Date.now();
  const sorted = [...breaks].sort((a, b) => a.startedAt - b.startedAt);
  let previousEnd = session.startedAt;
  for (const item of sorted) {
    if (!Number.isFinite(item.startedAt)) throw new Error('Break start time is invalid.');
    if (item.startedAt < session.startedAt) throw new Error('Break cannot start before the session.');
    if (item.startedAt < previousEnd) throw new Error('Breaks cannot overlap or move before the last break point.');
    if (item.endedAt) {
      if (item.endedAt <= item.startedAt) throw new Error('Break end must be after break start.');
      if (item.endedAt > sessionEnd) throw new Error('Break cannot end after the session ends.');
      previousEnd = item.endedAt;
    } else {
      if (item.startedAt > sessionEnd) throw new Error('Open break cannot start after the current time.');
      previousEnd = item.startedAt;
    }
  }
  if (session.endedAt && sorted.length) {
    const lastBreak = sorted.at(-1);
    if (lastBreak && session.endedAt < lastBreak.startedAt) throw new Error('Session end cannot be before the last break point.');
  }
}

function validateImportedData(data: AppData): void {
  assertUnique(data.courses.map((course) => course.id), 'course IDs');
  assertUnique(data.sessions.map((session) => session.id), 'session IDs');
  assertUnique(data.breaks.map((item) => item.id), 'break IDs');

  const courseIds = new Set(data.courses.map((course) => course.id));
  const sessionIds = new Set(data.sessions.map((session) => session.id));
  const breaksBySession = new Map<string, StudyBreak[]>();

  for (const session of data.sessions) {
    if (!courseIds.has(session.courseId)) throw new Error('Import file has a session for a missing course.');
    if (session.status === 'ended' && !session.endedAt) throw new Error('Import file has an ended session without an end time.');
    if (session.status !== 'ended' && session.endedAt) throw new Error('Import file has an active session with an end time.');
  }

  if (data.sessions.filter((session) => !session.endedAt).length > 1) {
    throw new Error('Import file has more than one active session.');
  }

  for (const item of data.breaks) {
    if (!sessionIds.has(item.sessionId)) throw new Error('Import file has a break for a missing session.');
    const sessionBreaks = breaksBySession.get(item.sessionId) || [];
    sessionBreaks.push(item);
    breaksBySession.set(item.sessionId, sessionBreaks);
  }

  for (const session of data.sessions) {
    const sessionBreaks = breaksBySession.get(session.id) || [];
    validateSession(session, sessionBreaks);
    if (session.status === 'paused' && !sessionBreaks.some((item) => !item.endedAt)) {
      throw new Error('Import file has a paused session without an open break.');
    }
    if (session.status === 'running' && sessionBreaks.some((item) => !item.endedAt)) {
      throw new Error('Import file has a running session with an open break.');
    }
    if (session.status === 'ended' && sessionBreaks.some((item) => !item.endedAt)) {
      throw new Error('Import file has an ended session with an open break.');
    }
  }
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Import file has duplicate ${label}.`);
}
