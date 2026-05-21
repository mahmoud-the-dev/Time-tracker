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

let dbPromise;

function openDb() {
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

async function transact(storeNames, mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
    let result;
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

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(store) {
  return requestToPromise(store.getAll());
}

function get(store, key) {
  return requestToPromise(store.get(key));
}

function put(store, value) {
  return requestToPromise(store.put(value));
}

function del(store, key) {
  return requestToPromise(store.delete(key));
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function seedInitialData() {
  await transact(['meta', 'courses'], 'readwrite', async ({ meta, courses }) => {
    const seeded = await get(meta, 'seeded');
    if (seeded) return;
    const now = Date.now();
    for (const name of INITIAL_COURSES) {
      await put(courses, { id: id('course'), name, archived: false, createdAt: now, updatedAt: now });
    }
    await put(meta, { key: 'seeded', value: true });
  });
}

export async function getAppData() {
  return transact(['courses', 'sessions', 'breaks'], 'readonly', async ({ courses, sessions, breaks }) => ({
    courses: (await getAll(courses)).sort((a, b) => a.name.localeCompare(b.name)),
    sessions: await getAll(sessions),
    breaks: await getAll(breaks),
  }));
}

export function getLatestEditableSession(sessions) {
  return [...sessions].sort((a, b) => (b.createdAt || b.startedAt) - (a.createdAt || a.startedAt))[0] || null;
}

export async function addCourse(name) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Course name is required.');
  await transact(['courses'], 'readwrite', async ({ courses }) => {
    const existing = await getAll(courses);
    if (existing.some((course) => course.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('A course with this name already exists.');
    }
    const now = Date.now();
    await put(courses, { id: id('course'), name: trimmed, archived: false, createdAt: now, updatedAt: now });
  });
}

export async function renameCourse(courseId, name) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Course name is required.');
  await transact(['courses'], 'readwrite', async ({ courses }) => {
    const course = await get(courses, courseId);
    if (!course) throw new Error('Course not found.');
    await put(courses, { ...course, name: trimmed, updatedAt: Date.now() });
  });
}

export async function archiveCourse(courseId, archived) {
  await transact(['courses'], 'readwrite', async ({ courses }) => {
    const course = await get(courses, courseId);
    if (!course) throw new Error('Course not found.');
    await put(courses, { ...course, archived, updatedAt: Date.now() });
  });
}

export async function removeCourse(courseId) {
  await transact(['courses', 'sessions'], 'readwrite', async ({ courses, sessions }) => {
    const course = await get(courses, courseId);
    if (!course) throw new Error('Course not found.');
    const allSessions = await getAll(sessions);
    const hasSessions = allSessions.some((session) => session.courseId === courseId);
    if (hasSessions) {
      await put(courses, { ...course, archived: true, updatedAt: Date.now() });
    } else {
      await del(courses, courseId);
    }
  });
}

export async function deleteCourse(courseId) {
  await removeCourse(courseId);
}

export async function createSession(courseId) {
  if (!courseId) throw new Error('Choose a course to start.');
  await transact(['courses', 'sessions'], 'readwrite', async ({ courses, sessions }) => {
    const course = await get(courses, courseId);
    if (!course || course.archived) throw new Error('Choose an active course.');
    const allSessions = await getAll(sessions);
    if (allSessions.some((session) => !session.endedAt)) throw new Error('End the current session before starting a new one.');
    const now = Date.now();
    await put(sessions, {
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

export async function pauseActiveSession() {
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const active = await getActiveSession(sessions);
    if (!active) throw new Error('No active session to pause.');
    const allBreaks = await getAll(breaks);
    if (allBreaks.some((item) => item.sessionId === active.id && !item.endedAt)) throw new Error('Session is already paused.');
    const now = Date.now();
    await put(sessions, { ...active, status: 'paused', updatedAt: now });
    await put(breaks, { id: id('break'), sessionId: active.id, startedAt: now, endedAt: null, createdAt: now, updatedAt: now });
  });
}

export async function resumeActiveSession() {
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const active = await getActiveSession(sessions);
    if (!active) throw new Error('No active session to resume.');
    const allBreaks = await getAll(breaks);
    const openBreak = allBreaks.find((item) => item.sessionId === active.id && !item.endedAt);
    if (!openBreak) throw new Error('Session is not paused.');
    const now = Date.now();
    await put(breaks, { ...openBreak, endedAt: now, updatedAt: now });
    await put(sessions, { ...active, status: 'running', updatedAt: now });
  });
}

export async function endActiveSession() {
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const active = await getActiveSession(sessions);
    if (!active) throw new Error('No active session to end.');
    const now = Date.now();
    const allBreaks = await getAll(breaks);
    const openBreak = allBreaks.find((item) => item.sessionId === active.id && !item.endedAt);
    if (openBreak) await put(breaks, { ...openBreak, endedAt: now, updatedAt: now });
    await put(sessions, { ...active, endedAt: now, status: 'ended', updatedAt: now });
  });
}

export async function updateSessionTime(sessionId, field, value) {
  if (!['startedAt', 'endedAt'].includes(field)) throw new Error('Unsupported session field.');
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const allSessions = await getAll(sessions);
    const latest = getLatestEditableSession(allSessions);
    const session = allSessions.find((item) => item.id === sessionId);
    if (!session || latest?.id !== sessionId) throw new Error('Only the latest session can be corrected.');
    const next = { ...session, [field]: value, updatedAt: Date.now() };
    const sessionBreaks = (await getAll(breaks)).filter((item) => item.sessionId === sessionId);
    validateSession(next, sessionBreaks);
    await put(sessions, next);
  });
}

export async function updateBreakTime(breakId, field, value) {
  if (!['startedAt', 'endedAt'].includes(field)) throw new Error('Unsupported break field.');
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const allBreaks = await getAll(breaks);
    const target = allBreaks.find((item) => item.id === breakId);
    if (!target) throw new Error('Break not found.');
    const allSessions = await getAll(sessions);
    const latestSession = getLatestEditableSession(allSessions);
    if (latestSession?.id !== target.sessionId) throw new Error('Only the latest session break can be corrected.');
    const sessionBreaks = allBreaks.filter((item) => item.sessionId === target.sessionId).sort((a, b) => a.startedAt - b.startedAt);
    const latestBreak = sessionBreaks.at(-1);
    if (latestBreak.id !== breakId) throw new Error('Only the latest break can be corrected.');
    const nextBreaks = sessionBreaks.map((item) => (item.id === breakId ? { ...item, [field]: value, updatedAt: Date.now() } : item));
    validateSession(latestSession, nextBreaks);
    await put(breaks, nextBreaks.find((item) => item.id === breakId));
  });
}

export async function deleteSession(sessionId) {
  await transact(['sessions', 'breaks'], 'readwrite', async ({ sessions, breaks }) => {
    const session = await get(sessions, sessionId);
    if (!session) throw new Error('Session not found.');
    if (!session.endedAt) throw new Error('End the session before deleting it.');
    const allBreaks = await getAll(breaks);
    for (const item of allBreaks.filter((breakItem) => breakItem.sessionId === sessionId)) {
      await del(breaks, item.id);
    }
    await del(sessions, sessionId);
  });
}

export async function exportData() {
  const data = await getAppData();
  return { schemaVersion: DB_VERSION, exportedAt: new Date().toISOString(), ...data };
}

async function getActiveSession(sessionStore) {
  const allSessions = await getAll(sessionStore);
  return allSessions.find((session) => !session.endedAt) || null;
}

function validateSession(session, breaks) {
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
    if (session.endedAt < lastBreak.startedAt) throw new Error('Session end cannot be before the last break point.');
  }
}
