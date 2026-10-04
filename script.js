// Moja Szkoła — app logic
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

// ---------- Icons ----------
// Every icon in the app is a monochrome line SVG that takes the surrounding text colour
// (currentColor) — no colour emoji. icon('name') returns the markup for template strings;
// static HTML uses <i data-icon="name"></i>, filled in by hydrateIcons() on load.
const ICONS = {
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  timer: '<path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  dice: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M16 8h.01"/><path d="M12 12h.01"/><path d="M8 16h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  seat: '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  snow: '<path d="M2 12h20"/><path d="M12 2v20"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>',
  flower: '<circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/><path d="M12 7.5V9"/><path d="M7.5 12H9"/><path d="M16.5 12H15"/><path d="M12 16.5V15"/><path d="m8 8 1.88 1.88"/><path d="M14.12 9.88 16 8"/><path d="m8 16 1.88-1.88"/><path d="M14.12 14.12 16 16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  thumbs: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  note: '<path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  cap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  undo: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  redo: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
}
hydrateIcons();

// ---------- Cloud data store (Firestore) ----------
// Shared data lives in Firestore so every browser/device sees the same thing.
// Lessons/subjects/announcements are each one document in the "store" collection
// (shaped as { value: <data> }) — state.* mirrors them in memory, save*() writes the
// mirror back, and onSnapshot() pushes updates made elsewhere back into this tab live.
// Accounts are the exception: each account is its OWN document in the "accounts"
// collection (id = normalized username), so adding/removing/editing one account only
// ever touches that single document. A shared array-in-one-doc (like the others use)
// would mean two sessions saving around the same time could silently overwrite each
// other's changes and lose accounts — that's not a risk worth taking for login data.
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storeDoc = (name) => doc(db, 'store', name);
const accountsCollection = collection(db, 'accounts');
const accountDocRef = (name) => doc(db, 'accounts', normalise(name));

const gradients = ['linear-gradient(135deg,#4f46e5,#8b5cf6)', 'linear-gradient(135deg,#0891b2,#22c55e)', 'linear-gradient(135deg,#ea580c,#f43f5e)', 'linear-gradient(135deg,#0f766e,#0ea5e9)', 'linear-gradient(135deg,#be123c,#a855f7)', 'linear-gradient(135deg,#ca8a04,#f97316)'];
const lessonColors = ['#4f46e5', '#0891b2', '#7c3aed', '#dc2626', '#16a34a', '#ea580c'];
// The school's bell schedule (each lesson 45 min) — picking a "Numer lekcji" in the
// lesson editor fills the start/end time fields from here instead of typing them by
// hand. The fields stay editable afterwards, so this is a shortcut, not a lock.
const bellSchedule = [
  { number: 0, start: '08:00', end: '08:45' },
  { number: 1, start: '09:00', end: '09:45' },
  { number: 2, start: '10:00', end: '10:45' },
  { number: 3, start: '10:55', end: '11:40' },
  { number: 4, start: '11:50', end: '12:35' },
  { number: 5, start: '12:55', end: '13:40' },
  { number: 6, start: '14:00', end: '14:45' },
  { number: 7, start: '14:50', end: '15:35' },
  { number: 8, start: '15:40', end: '16:25' },
];
const bellPeriodOptionsHtml = '<option value="">— wpisz godziny ręcznie —</option>' + bellSchedule.map((p) => `<option value="${p.number}">${p.number}. lekcja (${p.start}–${p.end})</option>`).join('');

const defaultSubjects = [
  { id: 'math', name: 'Matematyka', gradient: gradients[0], competences: [{ id: 'algebra', name: 'Algebra', gradient: gradients[4] }, { id: 'geometry', name: 'Geometria', gradient: gradients[1] }] },
  { id: 'polish', name: 'Język polski', gradient: gradients[2], competences: [{ id: 'reading', name: 'Czytanie ze zrozumieniem', gradient: gradients[3] }] },
];
const weekdays = [
  { code: 'mon', label: 'Poniedziałek' },
  { code: 'tue', label: 'Wtorek' },
  { code: 'wed', label: 'Środa' },
  { code: 'thu', label: 'Czwartek' },
  { code: 'fri', label: 'Piątek' },
];
const weekdayLabel = (code) => weekdays.find((d) => d.code === code)?.label || code;
const weekdayOptionsHtml = weekdays.map((d) => `<option value="${d.code}">${d.label}</option>`).join('');
function currentWeekday() {
  return weekdays[new Date().getDay() - 1]?.code || 'mon';
}
const defaultLessons = [
  { id: 'l1', name: 'Matematyka', teacher: 'AN', room: '24', start: '08:00', end: '08:45', color: '#4f46e5', day: 'mon' },
  { id: 'l2', name: 'Język polski', teacher: 'PK', room: '12', start: '09:00', end: '09:45', color: '#0891b2', day: 'mon' },
  { id: 'l3', name: 'Informatyka', teacher: 'MW', room: '8', start: '10:00', end: '10:45', color: '#7c3aed', day: 'mon' },
];
const defaultAnnouncements = [
  { id: 'room-change', title: 'Zastępstwo: Informatyka', text: 'Zajęcia odbędą się w sali 11.', lessonId: 'l3', type: 'replacement', classroom: '1A', pending: false, date: '', time: '' },
  { id: 'reminder', title: 'Przypomnienie', text: 'Do poniedziałku oddaj projekt z biologii.', lessonId: '', type: 'reminder', classroom: 'all', pending: false, date: '', time: '' },
];
const classCodes = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => ['A', 'B', 'C'].map((letter) => `${n}${letter}`));
const classOptionsHtml = classCodes.map((c) => `<option value="${c}">${c}</option>`).join('');
const classroomOptionsHtml = (includeAll) => (includeAll ? '<option value="all">Wszystkie klasy</option>' : '') + classOptionsHtml;
const classLabel = (cls) => (cls === 'all' ? 'Wszystkie klasy' : cls);
const gradeNumbers = [1, 2, 3, 4, 5, 6, 7, 8];
const gradeOfClass = (cls) => cls.slice(0, -1);
const gradeTabItems = gradeNumbers.map((n) => ({ code: String(n), label: `Klasa ${n}` }));

// One-time fallback seed used only if a document doesn't exist yet in Firestore (brand new
// project, or migrating from an earlier localStorage-only version of this app on this browser).
// Also backfills fields added later (addedBy / classroom / pending / date / time / day) so
// data saved by older versions still normalizes correctly once it round-trips through Firestore.
const legacyLessons = JSON.parse(localStorage.getItem('schoolLessons') || 'null');
const legacyLessonsByClass = JSON.parse(localStorage.getItem('schoolLessonsByClass') || 'null');
const normalizeLessonsByClass = (byClass) => {
  const out = {};
  for (const [cls, lessons] of Object.entries(byClass || {})) out[cls] = (lessons || []).map((l) => ({ addedBy: 'admin', day: currentWeekday(), ...l }));
  return out;
};

const legacyAnnouncements = JSON.parse(localStorage.getItem('schoolAnnouncements') || 'null');
const normalizeAnnouncements = (list) => (list || []).map((a) => ({ classroom: a.lessonId ? '1A' : 'all', pending: false, date: '', time: '', createdBy: '', ...a }));

// Subjects/competences are per class too. Items also carry addedBy (admin-seeded vs
// student-added) so students can't delete/extend what the admin's starter package put there.
const legacySubjects = JSON.parse(localStorage.getItem('schoolSubjects') || 'null');
const legacySubjectsByClass = JSON.parse(localStorage.getItem('schoolSubjectsByClass') || 'null');
const normalizeSubjectsByClass = (byClass) => {
  const out = {};
  for (const [cls, subjects] of Object.entries(byClass || {})) {
    out[cls] = (subjects || []).map((s) => ({ addedBy: 'admin', ...s, competences: (s.competences || []).map((c) => ({ addedBy: 'admin', ...c })) }));
  }
  return out;
};

// Starter competence packages are per grade (1-8), ignoring the A/B/C section letter.
const legacyStarterByGrade = JSON.parse(localStorage.getItem('schoolStarterSubjectsByGrade') || 'null');
const legacyStarterSubjects = JSON.parse(localStorage.getItem('schoolStarterSubjects') || 'null');
const legacyAccounts = JSON.parse(localStorage.getItem('schoolAccounts') || 'null');
const normalizeAccounts = (list) => (list || []).map((a) => ({ role: 'student', childClasses: [], pending: false, graduated: false, authUids: [], notifReadIds: [], settings: null, personalLessons: [], adminNote: '', teacherTools: [], lastTimerSeconds: 300, teacherClasses: [], pickHistory: {}, pinnedClasses: [], ...a }));

const STORE_KEYS = ['subjectsByClass', 'starterSubjectsByGrade', 'lessonsByClass', 'announcements', 'notifications', 'teacherClasses', 'seatLayouts'];
const seedValue = {
  subjectsByClass: normalizeSubjectsByClass(legacySubjectsByClass || { '1A': legacySubjects || defaultSubjects }),
  starterSubjectsByGrade: legacyStarterByGrade || Object.fromEntries(
    gradeNumbers.map((n) => [String(n), JSON.parse(JSON.stringify(legacyStarterSubjects || defaultSubjects))])
  ),
  lessonsByClass: normalizeLessonsByClass(legacyLessonsByClass || { '1A': legacyLessons || defaultLessons }),
  announcements: normalizeAnnouncements(legacyAnnouncements || defaultAnnouncements),
  notifications: [],
  teacherClasses: [],
  seatLayouts: [],
};

const state = {
  subjectsByClass: {},
  starterSubjectsByGrade: {},
  lessonsByClass: {},
  announcements: [],
  notifications: [],
  teacherClasses: [],
  seatLayouts: [],
  seatLayoutId: null,
  activeSubject: null,
  activeTemplateSubject: null,
  mode: 'subject',
  subjectTarget: 'class',
  adminStarterGrade: '1',
  editAnnouncement: null,
  editLesson: null,
  lessonTargetClass: null,
  lessonIsPersonal: false,
  teacherToolsEditing: false,
  timerRuntime: {},
  activeTimerTool: null,
  activeTool: null,
  pickerResult: {},
  groupsResult: {},
  seatEditing: false,
  selectedDesk: null,
  viewingClassroom: null,
  scheduleDay: currentWeekday(),
  adminScheduleDay: currentWeekday(),
  forceReplacement: false,
  isReplacementEditing: false,
  chosenGradient: gradients[0],
  lessonColor: lessonColors[0],
};

const saveSubjectsByClass = () => setDoc(storeDoc('subjectsByClass'), { value: state.subjectsByClass });
const saveStarterSubjectsByGrade = () => setDoc(storeDoc('starterSubjectsByGrade'), { value: state.starterSubjectsByGrade });
const saveLessonsByClass = () => setDoc(storeDoc('lessonsByClass'), { value: state.lessonsByClass });
const saveAnnouncements = () => setDoc(storeDoc('announcements'), { value: state.announcements });
const saveNotifications = () => setDoc(storeDoc('notifications'), { value: state.notifications });
const classLessons = (cls) => state.lessonsByClass[cls] || (state.lessonsByClass[cls] = []);

// Personal lessons (added via the regular schedule "+ Dodaj lekcję", not the admin
// panel) live on the owning account's own Firestore doc — like settings/notifReadIds
// already do — rather than in the shared per-class lessonsByClass array, so nobody
// else (not other students in the class, not the admin panel's lesson table) ever
// sees them. They're merged into the displayed schedule client-side only for the
// logged-in owner.
function currentAccount() {
  return currentUser && accounts.find((a) => normalise(a.name) === normalise(currentUser.name));
}
function personalLessons() {
  const account = currentAccount();
  if (!account) return [];
  return account.personalLessons || (account.personalLessons = []);
}
function savePersonalLessons() {
  const account = currentAccount();
  if (!account) return;
  setDoc(accountDocRef(account.name), account);
}

function applyStoreValue(key, value) {
  if (key === 'subjectsByClass') state.subjectsByClass = normalizeSubjectsByClass(value);
  else if (key === 'starterSubjectsByGrade') state.starterSubjectsByGrade = value || {};
  else if (key === 'lessonsByClass') state.lessonsByClass = normalizeLessonsByClass(value);
  else if (key === 'announcements') state.announcements = normalizeAnnouncements(value);
  else if (key === 'notifications') state.notifications = value || [];
  else if (key === 'teacherClasses') state.teacherClasses = (value || []).map((c) => ({ seatApart: [], seatRows: [], ...c }));
  else if (key === 'seatLayouts') state.seatLayouts = value || [];
}

function renderAfterStoreChange(key) {
  if (key === 'subjectsByClass') {
    renderSubjects();
    if (!document.querySelector('#detail').classList.contains('hidden')) renderCompetences();
  } else if (key === 'starterSubjectsByGrade') {
    renderStarterSubjects();
  } else if (key === 'lessonsByClass') {
    renderSchedule();
    renderAdminLessonTable();
    renderDashboard();
  } else if (key === 'announcements') {
    renderAnnouncements();
    renderPendingReplacements();
    renderSchedule();
    renderDashboard();
  } else if (key === 'notifications') {
    renderNotifications();
  } else if (key === 'teacherClasses') {
    // Another teacher added/edited/deleted a class. Refresh the class pickers, but leave
    // an open class editor alone so nobody's in-progress typing gets overwritten (it only
    // closes if its class was just deleted).
    if (editingClassId && !editingClass()) classEditorDialog.close();
    if (isTeacher() && state.activeTool) renderToolScreen();
  } else if (key === 'seatLayouts') {
    if (isTeacher() && activeClassTool()?.type === 'seating') renderSeatLayoutBar();
  }
}

// ---------- Notifications ----------
// Notifications are generated automatically by the app whenever something a user
// would care about changes (new event, schedule change, class change) — there's no
// separate authoring UI, so this stays a byproduct of the existing actions rather than
// a second parallel system. They live in the same one-doc-per-collection Firestore
// pattern as announcements/lessons. Per-user read state lives on the account doc
// (notifReadIds), consistent with how accounts already store per-user data.
function pushNotification({ title, text, classroom = null, targetUser = null, type = 'info' }) {
  state.notifications = [
    { id: crypto.randomUUID(), title, text, classroom, targetUser, type, createdAt: new Date().toISOString() },
    ...state.notifications,
  ].slice(0, 60);
  saveNotifications();
  renderNotifications();
}
function notificationsForUser(user) {
  if (!user) return [];
  const classes = accessibleClasses(user);
  return state.notifications.filter((n) => (
    n.targetUser
      ? normalise(n.targetUser) === normalise(user.name)
      : !n.classroom || n.classroom === 'all' || classes.includes(n.classroom)
  ));
}
function renderNotifications() {
  const wrap = document.querySelector('#notifWrap');
  if (!currentUser) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  const list = notificationsForUser(currentUser);
  const account = accounts.find((a) => normalise(a.name) === normalise(currentUser.name));
  const readIds = new Set(account?.notifReadIds || []);
  const unread = list.filter((n) => !readIds.has(n.id)).length;
  const badge = document.querySelector('#notifBadge');
  badge.textContent = unread > 9 ? '9+' : String(unread);
  badge.classList.toggle('hidden', unread === 0);
  badge.classList.toggle('flex', unread > 0);
  document.querySelector('#notifList').innerHTML = list.length ? list.map((n) => {
    const isUnread = !readIds.has(n.id);
    const when = new Date(n.createdAt).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<div class="relative rounded-xl border border-line px-3.5 py-3${isUnread ? ' bg-app' : ''}">
      ${isUnread ? '<span class="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true"></span>' : ''}
      <b class="block pr-4">${escapeHtml(n.title)}</b>
      <span class="text-[.9em] text-muted">${escapeHtml(n.text)}</span>
      <span class="mt-1 block text-xs font-bold text-muted">${when}</span>
    </div>`;
  }).join('') : `<p class="px-2 py-6 text-center text-muted">Brak powiadomień.</p>`;
}
document.querySelector('#notifBell').addEventListener('click', () => {
  const panel = document.querySelector('#notifPanel');
  const opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !opening);
  document.querySelector('#notifBell').setAttribute('aria-expanded', String(opening));
});
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('#notifWrap');
  if (!wrap.contains(e.target)) {
    document.querySelector('#notifPanel').classList.add('hidden');
    document.querySelector('#notifBell').setAttribute('aria-expanded', 'false');
  }
});
document.querySelector('#notifMarkAllRead').addEventListener('click', () => {
  if (!currentUser) return;
  const account = accounts.find((a) => normalise(a.name) === normalise(currentUser.name));
  if (!account) return;
  const ids = notificationsForUser(currentUser).map((n) => n.id);
  account.notifReadIds = Array.from(new Set([...(account.notifReadIds || []), ...ids]));
  setDoc(accountDocRef(account.name), account);
  renderNotifications();
});

async function loadAccounts() {
  const snap = await getDocs(accountsCollection);
  if (!snap.empty) {
    accounts = normalizeAccounts(snap.docs.map((d) => d.data()));
    return;
  }
  // The accounts collection is empty. That's either (a) this project has never been
  // migrated yet, or (b) migration already ran and every account has since been deleted
  // for real. A Firestore-side marker (not localStorage, which is per-browser and can
  // hold stale leftovers forever) tells them apart, so a legitimate "no accounts left"
  // state is never mistaken for "never migrated" and silently repopulated from old data.
  const migrationMarker = doc(db, 'store', 'accountsMigrated');
  const markerSnap = await getDoc(migrationMarker);
  if (markerSnap.exists()) {
    accounts = [];
    return;
  }
  const legacyDoc = await getDoc(storeDoc('accounts'));
  const migrated = normalizeAccounts(legacyDoc.exists() ? legacyDoc.data().value : legacyAccounts);
  await Promise.all(migrated.map((a) => setDoc(accountDocRef(a.name), a)));
  await setDoc(migrationMarker, { done: true });
  accounts = migrated;
}

async function loadStore() {
  await signInAnonymously(auth);
  await Promise.all([
    loadAccounts(),
    ...STORE_KEYS.map(async (key) => {
      const ref = storeDoc(key);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        applyStoreValue(key, snap.data().value);
      } else {
        applyStoreValue(key, seedValue[key]);
        await setDoc(ref, { value: seedValue[key] });
      }
    }),
  ]);
}

function watchStoreLive() {
  onSnapshot(accountsCollection, (snap) => {
    accounts = normalizeAccounts(snap.docs.map((d) => d.data()));
    // Account data — especially admin-only notes — must only ever be rendered into
    // the DOM for an actual admin; every other connected client (any student/parent
    // tab currently open) would otherwise get the full account list, notes included,
    // written into its own hidden DOM just because some admin edited an account.
    if (isAdmin()) {
      renderAccounts();
      renderPendingTeachers();
    }
    if (currentUser && !accountStillExists(currentUser)) logout('Twoje konto zostało usunięte przez administratora.');
  });
  STORE_KEYS.forEach((key) => onSnapshot(storeDoc(key), (snap) => {
    if (!snap.exists()) return;
    if (key === 'teacherClasses' && classWritesPending > 0) return;
    applyStoreValue(key, snap.data().value);
    renderAfterStoreChange(key);
  }));
}
const subjectsForClass = (cls) => state.subjectsByClass[cls] || (state.subjectsByClass[cls] = []);
const starterSubjectsForGrade = (grade) => state.starterSubjectsByGrade[grade] || (state.starterSubjectsByGrade[grade] = []);

function seedClassSubjectsFromStarter(cls) {
  state.subjectsByClass[cls] = starterSubjectsForGrade(gradeOfClass(cls)).map((s) => ({
    id: crypto.randomUUID(),
    name: s.name,
    gradient: s.gradient,
    addedBy: 'admin',
    competences: s.competences.map((c) => ({ id: crypto.randomUUID(), name: c.name, addedBy: 'admin' })),
  }));
  saveSubjectsByClass();
}

const escapeHtml = (s) => s.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const capitalize = (s) => (s ? `${s.charAt(0).toLocaleUpperCase('pl-PL')}${s.slice(1)}` : s);
const minutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function setSelected(el, isSelected, onClasses, offClasses) {
  el.classList.remove(...(isSelected ? offClasses : onClasses));
  el.classList.add(...(isSelected ? onClasses : offClasses));
}

// ---------- Navigation ----------
const navParent = { schedule: 'home', changes: 'home', events: 'home', admin: 'home', detail: 'competences', timerScreen: 'teacherTools', pickerScreen: 'teacherTools', groupsScreen: 'teacherTools', seatingScreen: 'teacherTools' };
function show(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.id !== id));
  // The thanks footer belongs to the main ("Główne") tab only.
  document.querySelector('#thanksFooter').classList.toggle('hidden', id !== 'home');
  // Teacher Tools can be edited from the separate timerScreen (rename, change
  // duration) while its own grid sits hidden and stale — refresh it on the way back
  // in, regardless of which control navigated here (nav tab, "← Wróć", etc.).
  if (id === 'teacherTools' && isTeacher()) renderTeacherTools();
  const navId = navParent[id] || id;
  let activeBtn = null;
  document.querySelectorAll('#mainNav [data-view]').forEach((b) => {
    const active = b.dataset.view === navId;
    if (active) activeBtn = b;
    setSelected(b, active, ['text-white'], ['text-muted']);
  });
  const pill = document.querySelector('#navPill');
  if (activeBtn && pill) {
    pill.style.left = activeBtn.offsetLeft + 'px';
    pill.style.top = activeBtn.offsetTop + 'px';
    pill.style.width = activeBtn.offsetWidth + 'px';
    pill.style.height = activeBtn.offsetHeight + 'px';
  }
  updateToolsNav(id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.show = show;

// ---------- Pinned-tools bar ----------
// While a teacher is inside one of their PINNED tools, a bar shaped like the main menu
// appears under the header with all pinned tools, so they can jump between them without
// going back to Teacher Tools. It is hidden everywhere else (and for unpinned tools).
const TOOL_SCREENS = ['timerScreen', 'pickerScreen', 'groupsScreen', 'seatingScreen'];
function currentToolId(screenId) {
  return screenId === 'timerScreen' ? state.activeTimerTool : state.activeTool;
}
function updateToolsNav(screenId = document.querySelector('.view:not(.hidden)')?.id) {
  const nav = document.querySelector('#toolsNav');
  const tools = isTeacher() ? teacherToolsFor().filter((t) => t.pinned) : [];
  const currentId = TOOL_SCREENS.includes(screenId) ? currentToolId(screenId) : null;
  const visible = !!currentId && tools.some((t) => t.id === currentId);
  nav.classList.toggle('hidden', !visible);
  nav.classList.toggle('flex', visible);
  if (!visible) return;
  nav.querySelectorAll('[data-nav-tool]').forEach((b) => b.remove());
  nav.insertAdjacentHTML('beforeend', tools.map((t) =>
    `<button type="button" class="relative z-10 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-2 font-bold ${t.id === currentId ? 'text-white' : 'text-muted'}" data-nav-tool="${t.id}">${icon(toolTypeInfo(t.type).icon)} ${escapeHtml(t.label || toolTypeInfo(t.type).name)}</button>`
  ).join(''));
  nav.querySelectorAll('[data-nav-tool]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.navTool !== currentId) openTool(b.dataset.navTool); }));
  const active = nav.querySelector(`[data-nav-tool="${currentId}"]`);
  const pill = nav.querySelector('#toolsNavPill');
  if (active && pill) {
    pill.style.left = `${active.offsetLeft}px`;
    pill.style.top = `${active.offsetTop}px`;
    pill.style.width = `${active.offsetWidth}px`;
    pill.style.height = `${active.offsetHeight}px`;
  }
}

document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => show(b.dataset.open)));
document.querySelector('[data-open="events"]').addEventListener('click', () => { state.forceReplacement = false; });

// ---------- Subject / competence cards ----------
const statusInfo = {
  locked: { label: 'Nieodblokowane', color: 'linear-gradient(135deg,#facc15,#f59e0b)' },
  unlocked: { label: `${icon('alert')} Zdobądź mnie!`, color: 'linear-gradient(135deg,#f97316,#ef4444)' },
  known: { label: 'Umiem', color: 'linear-gradient(135deg,#2563eb,#06b6d4)' },
  earned_basic: { label: `Zdobyta — poziom podstawowy ${icon('thumbs')}`, color: 'linear-gradient(135deg,#16a34a,#22c55e)' },
  earned_advanced: { label: `Zdobyta — poziom zaawansowany ${icon('trophy')}`, color: 'linear-gradient(135deg,#065f46,#10b981)' },
};
const earnedStatuses = ['earned_basic', 'earned_advanced'];

function card(item, type) {
  // Older competences saved before basic/advanced levels existed just have status
  // "earned" — treat those as the basic level rather than falling back to "locked".
  const statusKey = item.status === 'earned' ? 'earned_basic' : (item.status || 'locked');
  const status = statusInfo[statusKey] || statusInfo.locked;
  const background = type === 'competence' ? status.color : item.gradient;
  const earned = type === 'subject' ? item.competences.filter((c) => earnedStatuses.includes(c.status) || c.status === 'earned').length : 0;
  const body = type === 'subject'
    ? `Zdobyte: ${earned}/${item.competences.length}`
    : `<span class="mt-2 inline-block rounded-lg bg-white/25 px-2 py-1 text-[.78em] font-extrabold text-white">${status.label}</span>`;
  const canDelete = !isParent() && (isAdmin() || item.addedBy !== 'admin');
  const canChangeColor = type === 'subject' && isParent();
  return `<article class="group relative min-h-[172px] cursor-pointer overflow-hidden rounded-[25px] p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl" style="background:${background}" data-id="${item.id}" data-type="${type}" tabindex="0" role="button">
    <span aria-hidden="true" class="pointer-events-none absolute -right-[75px] -top-[78px] h-[220px] w-[220px] rounded-full bg-white/20"></span>
    ${canDelete ? `<button class="absolute right-3 top-3 z-10 rounded-lg bg-black/30 px-2 py-1 text-sm font-bold opacity-0 transition group-hover:opacity-100" title="Usuń" data-delete="${item.id}" data-type="${type}">Usuń</button>` : ''}
    ${canChangeColor ? `<button class="absolute right-3 top-3 z-10 rounded-lg bg-black/30 px-2 py-1 text-sm font-bold opacity-0 transition group-hover:opacity-100" title="Zmień kolor" data-change-color="${item.id}" aria-label="Zmień kolor">${icon('palette')}</button>` : ''}
    <h2 class="relative mt-14 text-[1.3em] font-bold tracking-tight">${escapeHtml(item.name)}</h2>
    <p class="relative mt-1 text-[.9em] text-white/85">${body}</p>
  </article>`;
}

function renderSubjects() {
  const subjects = subjectsForClass(viewingClass());
  const el = document.querySelector('#subjectGrid');
  el.innerHTML = subjects.length
    ? subjects.map((x) => card(x, 'subject')).join('')
    : emptyState('Nie masz jeszcze przedmiotów', 'Dodaj pierwszy przedmiot, aby zacząć.');
  bindCards(el);
}

function renderCompetences() {
  const subject = subjectsForClass(viewingClass()).find((x) => x.id === state.activeSubject);
  if (!subject) return show('competences');
  document.querySelector('#detailTitle').textContent = subject.name;
  document.querySelector('#crumbName').textContent = subject.name;
  const el = document.querySelector('#competenceGrid');
  el.innerHTML = subject.competences.length
    ? subject.competences.map((x) => card(x, 'competence')).join('')
    : emptyState('Brak kompetencji', 'Dodaj pierwszą kompetencję dla tego przedmiotu.');
  bindCards(el);
  const canAddCompetence = !isParent() && (isAdmin() || subject.addedBy !== 'admin');
  document.querySelector('#addCompetence').classList.toggle('hidden', !canAddCompetence);
  document.querySelector('#competenceNotice').classList.toggle('hidden', isParent());
}

function emptyState(title, text) {
  return `<div class="col-span-full rounded-[20px] border-2 border-dashed border-line px-5 py-11 text-center text-muted"><strong class="mb-1 block text-lg text-ink">${title}</strong>${text}</div>`;
}

function bindCards(el) {
  el.querySelectorAll('[data-delete]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = b.dataset.delete, type = b.dataset.type;
      if (!confirm('Czy na pewno chcesz usunąć tę pozycję?')) return;
      const subjects = subjectsForClass(viewingClass());
      if (type === 'subject') {
        state.subjectsByClass[viewingClass()] = subjects.filter((x) => x.id !== id);
      } else {
        const subject = subjects.find((x) => x.id === state.activeSubject);
        subject.competences = subject.competences.filter((x) => x.id !== id);
      }
      saveSubjectsByClass();
      type === 'subject' ? renderSubjects() : renderCompetences();
    });
  });
  el.querySelectorAll('[data-id]').forEach((b) => {
    const open = () => {
      if (b.dataset.type === 'subject') {
        state.activeSubject = b.dataset.id;
        renderCompetences();
        show('detail');
      } else if (!isParent()) {
        openStatusEditor(b.dataset.id);
      }
    };
    b.addEventListener('click', open);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  el.querySelectorAll('[data-change-color]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSubjectColorEditor(b.dataset.changeColor);
    });
  });
}

// ---------- Competence status dialog ----------
const statusDialog = document.querySelector('#statusEditor');
let activeCompetence = null;
function openStatusEditor(id) {
  activeCompetence = subjectsForClass(viewingClass()).find((x) => x.id === state.activeSubject).competences.find((x) => x.id === id);
  document.querySelector('#statusTitle').textContent = activeCompetence.name;
  const currentStatus = activeCompetence.status === 'earned' ? 'earned_basic' : (activeCompetence.status || 'locked');
  document.querySelector('#statusSelect').value = currentStatus;
  statusDialog.showModal();
}
document.querySelector('#cancelStatus').addEventListener('click', () => statusDialog.close('cancel'));
statusDialog.addEventListener('close', () => {
  if (statusDialog.returnValue !== 'save' || !activeCompetence) return;
  activeCompetence.status = document.querySelector('#statusSelect').value;
  saveSubjectsByClass();
  renderCompetences();
  renderSubjects();
});

// ---------- Subject colour editor (parents can restyle a subject card without being able to add/delete) ----------
const subjectColorDialog = document.querySelector('#subjectColorEditor');
let colorEditingSubjectId = null;
let pendingSubjectColor = null;
function renderSubjectColorPicker() {
  document.querySelector('#subjectColorPicker').innerHTML = gradients.map((g, i) =>
    `<button type="button" class="h-8 w-[43px] rounded-lg${g === pendingSubjectColor ? ' ring-2 ring-ink' : ''}" style="background:${g}" data-subject-gradient="${i}" aria-label="Gradient ${i + 1}"></button>`
  ).join('');
  document.querySelectorAll('[data-subject-gradient]').forEach((b) => b.addEventListener('click', () => {
    pendingSubjectColor = gradients[b.dataset.subjectGradient];
    renderSubjectColorPicker();
  }));
}
function openSubjectColorEditor(id) {
  const subject = subjectsForClass(viewingClass()).find((x) => x.id === id);
  if (!subject) return;
  colorEditingSubjectId = id;
  pendingSubjectColor = subject.gradient;
  renderSubjectColorPicker();
  subjectColorDialog.showModal();
}
document.querySelector('#cancelSubjectColor').addEventListener('click', () => subjectColorDialog.close('cancel'));
subjectColorDialog.addEventListener('close', () => {
  if (subjectColorDialog.returnValue !== 'save' || !colorEditingSubjectId) return;
  const subject = subjectsForClass(viewingClass()).find((x) => x.id === colorEditingSubjectId);
  if (subject) subject.gradient = pendingSubjectColor;
  saveSubjectsByClass();
  renderSubjects();
});

// ---------- Subject / competence / announcement editor dialog ----------
const dialog = document.querySelector('#editor');

// Lightens/darkens a hex color by a flat per-channel amount (clamped), used to turn a
// single RGB pick into a two-stop gradient matching the rest of the app's card style.
function shadeHex(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.min(255, Math.max(0, v));
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0xff) + amount);
  const b = clamp((num & 0xff) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
const gradientFromColor = (hex) => `linear-gradient(135deg,${shadeHex(hex, 30)},${shadeHex(hex, -30)})`;

// Gradients someone has already picked (via the custom color picker below) on any
// subject, across every class and the starter templates — so a custom color, once
// used, can be reused elsewhere without re-picking the exact same RGB value again.
function usedCustomGradients() {
  const found = new Set();
  Object.values(state.subjectsByClass).forEach((list) => list.forEach((s) => { if (s.gradient && !gradients.includes(s.gradient)) found.add(s.gradient); }));
  Object.values(state.starterSubjectsByGrade).forEach((list) => list.forEach((s) => { if (s.gradient && !gradients.includes(s.gradient)) found.add(s.gradient); }));
  return [...found].slice(0, 12);
}

function renderPicker() {
  const isCustom = !gradients.includes(state.chosenGradient);
  const presetsHtml = gradients.map((g, i) =>
    `<button type="button" class="h-8 w-[43px] rounded-lg${g === state.chosenGradient ? ' ring-2 ring-ink' : ''}" style="background:${g}" data-gradient="${i}" aria-label="Gradient ${i + 1}"></button>`
  ).join('');
  const customSwatchHtml = isCustom
    ? `<button type="button" class="h-8 w-[43px] rounded-lg ring-2 ring-ink" style="background:${state.chosenGradient}" aria-label="Wybrany własny kolor" disabled></button>`
    : '';
  document.querySelector('#gradientPicker').innerHTML = presetsHtml + customSwatchHtml
    + `<button type="button" class="grid h-8 w-[43px] place-items-center rounded-lg border border-dashed border-line text-lg font-bold leading-none text-muted" id="moreColorsBtn" title="Więcej kolorów" aria-label="Więcej kolorów">+</button>`;
  document.querySelectorAll('[data-gradient]').forEach((b) => b.addEventListener('click', () => {
    state.chosenGradient = gradients[b.dataset.gradient];
    renderPicker();
  }));
  document.querySelector('#moreColorsBtn').addEventListener('click', () => {
    document.querySelector('#customGradientField').classList.toggle('hidden');
  });

  const existing = usedCustomGradients();
  document.querySelector('#existingGradientField').classList.toggle('hidden', !existing.length);
  document.querySelector('#existingGradientPicker').innerHTML = existing.map((g) =>
    `<button type="button" class="h-8 w-[43px] rounded-lg${g === state.chosenGradient ? ' ring-2 ring-ink' : ''}" style="background:${g}" data-existing-gradient="${escapeHtml(g)}" aria-label="Użyty wcześniej kolor"></button>`
  ).join('');
  document.querySelectorAll('[data-existing-gradient]').forEach((b) => b.addEventListener('click', () => {
    state.chosenGradient = b.dataset.existingGradient;
    renderPicker();
  }));
}
document.querySelector('#gradientCustomColor').addEventListener('input', (e) => {
  state.chosenGradient = gradientFromColor(e.target.value);
  renderPicker();
});

function refreshReplacementLessonOptions(cls) {
  const lessonSelect = document.querySelector('#announcementLesson');
  const previousValue = lessonSelect.value;
  const dayIndex = (code) => weekdays.findIndex((d) => d.code === code);
  const sorted = [...classLessons(cls)].sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || a.start.localeCompare(b.start));
  lessonSelect.innerHTML = '<option value="">Wybierz lekcję</option>' + sorted.map((x) => `<option value="${x.id}">${weekdayLabel(x.day)} ${x.start} · ${escapeHtml(x.name)}</option>`).join('');
  if ([...lessonSelect.options].some((o) => o.value === previousValue)) lessonSelect.value = previousValue;
}
document.querySelector('#announcementClassroom').addEventListener('change', (e) => {
  if (!document.querySelector('#announcementLessonField').classList.contains('hidden')) refreshReplacementLessonOptions(e.target.value);
});

function openEditor(mode, announcementId = null, target = 'class') {
  state.mode = mode;
  state.subjectTarget = target;
  state.editAnnouncement = announcementId;
  const isAnnouncement = mode === 'announcement';
  const existing = isAnnouncement && announcementId ? state.announcements.find((x) => x.id === announcementId) : null;
  const isReplacement = state.forceReplacement || !!existing?.lessonId;
  const admin = isAdmin();
  state.isReplacementEditing = isReplacement;
  const subjectsInScope = target === 'template' ? starterSubjectsForGrade(state.adminStarterGrade) : subjectsForClass(viewingClass());
  state.chosenGradient = gradients[subjectsInScope.length % gradients.length];

  document.querySelector('#modalTitle').textContent = isAnnouncement ? (existing ? 'Edytuj wpis' : isReplacement ? (admin ? 'Dodaj zastępstwo' : 'Zgłoś zastępstwo') : 'Dodaj wpis') : mode === 'subject' ? 'Dodaj przedmiot' : 'Dodaj kompetencję';
  document.querySelector('#nameLabel').textContent = isAnnouncement ? (isReplacement ? 'Nazwa zastępstwa' : 'Tytuł ogłoszenia') : mode === 'subject' ? 'Nazwa przedmiotu' : 'Nazwa kompetencji';
  document.querySelector('#itemName').placeholder = isAnnouncement ? (isReplacement ? 'np. Informatyka — pani Nowak' : 'np. Kiermasz szkolny') : mode === 'subject' ? 'np. Matematyka' : 'np. Rozwiązywanie równań';
  document.querySelector('#itemName').value = existing ? existing.title : '';
  document.querySelector('#itemDescription').value = existing ? existing.text : '';
  document.querySelector('#descriptionField').classList.toggle('hidden', !isAnnouncement);
  document.querySelector('#itemDescription').required = isAnnouncement;
  document.querySelector('#gradientField').classList.toggle('hidden', isAnnouncement || mode === 'competence');

  const showDateTime = isAnnouncement && !isReplacement;
  document.querySelector('#itemDateTimeField').classList.toggle('hidden', !showDateTime);
  document.querySelector('#itemDate').value = existing?.date || '';
  document.querySelector('#itemTime').value = existing?.time || '';

  const showClassroomPicker = isAnnouncement && (!isReplacement || admin);
  const classroomField = document.querySelector('#announcementClassroomField');
  const classroomSelect = document.querySelector('#announcementClassroom');
  classroomField.classList.toggle('hidden', !showClassroomPicker);
  if (showClassroomPicker) {
    classroomSelect.innerHTML = classroomOptionsHtml(!isReplacement);
    classroomSelect.value = existing?.classroom || (isReplacement ? viewingClass() || classCodes[0] : 'all');
  }

  const lessonField = document.querySelector('#announcementLessonField');
  const lessonSelect = document.querySelector('#announcementLesson');
  const typeField = document.querySelector('#announcementTypeField');
  lessonField.classList.toggle('hidden', !isAnnouncement || !isReplacement);
  typeField.classList.toggle('hidden', !isAnnouncement || isReplacement);
  if (isReplacement) {
    const targetClass = admin ? classroomSelect.value : viewingClass() || classCodes[0];
    refreshReplacementLessonOptions(targetClass);
    lessonSelect.value = existing?.lessonId || '';
  }
  document.querySelector('#announcementType').value = existing?.type || 'event';

  renderPicker();
  dialog.showModal();
  setTimeout(() => document.querySelector('#itemName').focus(), 50);
}

document.querySelector('#addSubject').addEventListener('click', () => openEditor('subject'));
document.querySelector('#addCompetence').addEventListener('click', () => openEditor('competence'));
document.querySelector('#addAnnouncement').addEventListener('click', () => openEditor('announcement'));
document.querySelector('#addReplacement').addEventListener('click', () => { state.forceReplacement = true; openEditor('announcement'); });
document.querySelector('#cancelEditor').addEventListener('click', () => dialog.close('cancel'));
document.querySelectorAll('#itemName,#lessonName').forEach((input) => input.addEventListener('input', () => { if (input.value) input.value = capitalize(input.value); }));

dialog.addEventListener('close', () => {
  if (dialog.returnValue !== 'save') return;
  const name = document.querySelector('#itemName').value.trim();
  if (!name) return;

  if (state.mode === 'announcement') {
    const text = document.querySelector('#itemDescription').value.trim();
    if (!text) return;
    const isReplacement = state.isReplacementEditing;
    const admin = isAdmin();
    const lessonId = isReplacement ? document.querySelector('#announcementLesson').value || '' : '';
    if (isReplacement && !lessonId) return;
    const classroom = isReplacement
      ? admin ? document.querySelector('#announcementClassroom').value : viewingClass() || classCodes[0]
      : document.querySelector('#announcementClassroom').value;
    const type = isReplacement ? 'replacement' : document.querySelector('#announcementType').value;
    const date = isReplacement ? '' : document.querySelector('#itemDate').value;
    const time = isReplacement ? '' : document.querySelector('#itemTime').value;
    const pending = isReplacement && !admin;

    if (state.editAnnouncement) {
      const item = state.announcements.find((x) => x.id === state.editAnnouncement);
      Object.assign(item, { title: name, text, lessonId, type, classroom, date, time });
      if (isReplacement) item.pending = pending;
    } else {
      state.announcements.push({ id: crypto.randomUUID(), title: name, text, lessonId, type, classroom, date, time, pending, createdBy: currentUser?.name || '' });
      if (isReplacement && !pending) {
        pushNotification({ title: 'Plan lekcji został zmieniony', text: `Zastępstwo: ${name}`, classroom, type: 'schedule' });
      } else if (!isReplacement) {
        pushNotification({
          title: type === 'event' ? 'Dodano nowe wydarzenie' : 'Dodano ważną informację',
          text: name,
          classroom,
          type: 'event',
        });
      }
    }
    saveAnnouncements();
    renderAnnouncements();
    renderSchedule();
    renderDashboard();
    if (admin) renderPendingReplacements();
    return;
  }

  const item = { id: crypto.randomUUID(), name };
  const isTemplate = state.subjectTarget === 'template';
  const subjects = isTemplate ? starterSubjectsForGrade(state.adminStarterGrade) : subjectsForClass(viewingClass());
  if (!isTemplate) item.addedBy = isAdmin() ? 'admin' : 'student';
  if (state.mode === 'subject') {
    item.gradient = state.chosenGradient;
    item.competences = [];
    subjects.push(item);
  } else {
    const activeId = isTemplate ? state.activeTemplateSubject : state.activeSubject;
    subjects.find((x) => x.id === activeId).competences.push(item);
  }
  if (isTemplate) {
    saveStarterSubjectsByGrade();
    renderStarterSubjects();
  } else {
    saveSubjectsByClass();
    state.mode === 'subject' ? renderSubjects() : renderCompetences();
  }
});

// ---------- Lesson schedule ----------
const lessonDialog = document.querySelector('#lessonEditor');

// Colors someone has already used (via the custom color picker below) on any lesson —
// shared class lessons across every class, plus your own personal ones — so a custom
// color, once used, can be reused elsewhere without re-picking the exact RGB again.
function usedLessonColors() {
  const found = new Set();
  Object.values(state.lessonsByClass).forEach((list) => list.forEach((l) => { if (l.color && !lessonColors.includes(l.color)) found.add(l.color); }));
  personalLessons().forEach((l) => { if (l.color && !lessonColors.includes(l.color)) found.add(l.color); });
  return [...found].slice(0, 12);
}

function renderLessonColors() {
  const isCustom = !lessonColors.includes(state.lessonColor);
  const presetsHtml = lessonColors.map((c) =>
    `<button type="button" class="h-8 w-[43px] rounded-lg${c === state.lessonColor ? ' ring-2 ring-ink' : ''}" style="background:${c}" data-lesson-color="${c}"></button>`
  ).join('');
  const customSwatchHtml = isCustom
    ? `<button type="button" class="h-8 w-[43px] rounded-lg ring-2 ring-ink" style="background:${state.lessonColor}" aria-label="Wybrany własny kolor" disabled></button>`
    : '';
  document.querySelector('#lessonColorPicker').innerHTML = presetsHtml + customSwatchHtml
    + `<button type="button" class="grid h-8 w-[43px] place-items-center rounded-lg border border-dashed border-line text-lg font-bold leading-none text-muted" id="moreLessonColorsBtn" title="Więcej kolorów" aria-label="Więcej kolorów">+</button>`;
  document.querySelectorAll('[data-lesson-color]').forEach((b) => b.addEventListener('click', () => {
    state.lessonColor = b.dataset.lessonColor;
    renderLessonColors();
  }));
  document.querySelector('#moreLessonColorsBtn').addEventListener('click', () => {
    document.querySelector('#customLessonColorField').classList.toggle('hidden');
  });

  const existing = usedLessonColors();
  document.querySelector('#existingLessonColorField').classList.toggle('hidden', !existing.length);
  document.querySelector('#existingLessonColorPicker').innerHTML = existing.map((c) =>
    `<button type="button" class="h-8 w-[43px] rounded-lg${c === state.lessonColor ? ' ring-2 ring-ink' : ''}" style="background:${c}" data-existing-lesson-color="${escapeHtml(c)}" aria-label="Użyty wcześniej kolor"></button>`
  ).join('');
  document.querySelectorAll('[data-existing-lesson-color]').forEach((b) => b.addEventListener('click', () => {
    state.lessonColor = b.dataset.existingLessonColor;
    renderLessonColors();
  }));
}
document.querySelector('#lessonCustomColor').addEventListener('input', (e) => {
  state.lessonColor = e.target.value;
  renderLessonColors();
});

function openLessonEditor(id = null, cls = viewingClass(), day = state.scheduleDay, personal = false) {
  state.editLesson = id;
  state.lessonTargetClass = cls;
  state.lessonIsPersonal = personal;
  const item = id ? (personal ? personalLessons() : classLessons(cls)).find((x) => x.id === id) : null;
  const titleBase = item ? 'Edytuj lekcję' : 'Dodaj lekcję';
  document.querySelector('#lessonModalTitle').textContent = personal ? `${titleBase} (tylko dla Ciebie)` : titleBase;
  document.querySelector('#lessonName').value = item?.name || '';
  document.querySelector('#lessonDay').innerHTML = weekdayOptionsHtml;
  document.querySelector('#lessonDay').value = item?.day || day;
  document.querySelector('#lessonTeacher').value = item?.teacher || '';
  document.querySelector('#lessonRoom').value = item?.room || '';
  const start = item?.start || '08:00';
  const end = item?.end || '08:45';
  document.querySelector('#lessonStart').value = start;
  document.querySelector('#lessonEnd').value = end;
  document.querySelector('#lessonPeriod').innerHTML = bellPeriodOptionsHtml;
  const matchingPeriod = bellSchedule.find((p) => p.start === start && p.end === end);
  document.querySelector('#lessonPeriod').value = matchingPeriod ? matchingPeriod.number : '';
  state.lessonColor = item?.color || lessonColors[0];
  renderLessonColors();
  lessonDialog.showModal();
  setTimeout(() => document.querySelector('#lessonName').focus(), 50);
}
document.querySelector('#addLesson').addEventListener('click', () => openLessonEditor(null, viewingClass(), state.scheduleDay, true));
document.querySelector('#cancelLesson').addEventListener('click', () => lessonDialog.close('cancel'));
document.querySelector('#lessonPeriod').addEventListener('change', (e) => {
  const period = bellSchedule.find((p) => String(p.number) === e.target.value);
  if (!period) return;
  document.querySelector('#lessonStart').value = period.start;
  document.querySelector('#lessonEnd').value = period.end;
});

// Autofill: typing a lesson name that already exists somewhere in the same lesson
// list (the class's shared schedule when adding via the admin panel, or your own
// personal lessons when adding via the regular calendar) copies over its
// teacher/room/color, since it's almost always the same recurring lesson — but never
// the start/end time, which genuinely differs per slot. Never crosses between the two
// lists, so a personal lesson can't leak details into (or from) the shared one.
document.querySelector('#lessonName').addEventListener('input', () => {
  const name = document.querySelector('#lessonName').value.trim();
  if (!name || !state.lessonTargetClass) return;
  const source = state.lessonIsPersonal ? personalLessons() : classLessons(state.lessonTargetClass);
  const match = source.find((x) => x.id !== state.editLesson && x.name.trim().toLocaleLowerCase('pl-PL') === name.toLocaleLowerCase('pl-PL'));
  if (!match) return;
  document.querySelector('#lessonTeacher').value = match.teacher;
  document.querySelector('#lessonRoom').value = match.room || '';
  state.lessonColor = match.color;
  renderLessonColors();
});

lessonDialog.addEventListener('close', () => {
  if (lessonDialog.returnValue !== 'save') return;
  const name = document.querySelector('#lessonName').value.trim();
  const day = document.querySelector('#lessonDay').value;
  const teacher = document.querySelector('#lessonTeacher').value.trim();
  const room = document.querySelector('#lessonRoom').value.trim();
  const start = document.querySelector('#lessonStart').value;
  const end = document.querySelector('#lessonEnd').value;
  if (!name || !day || !teacher || !start || !end || start >= end) return;

  if (state.lessonIsPersonal) {
    // Personal lesson: saved only on your own account doc, never the shared class
    // schedule — no one else (not classmates, not the admin panel) ever sees it, so
    // no class-wide notification is pushed for it either.
    const lessons = personalLessons();
    if (state.editLesson) {
      Object.assign(lessons.find((x) => x.id === state.editLesson), { name, day, teacher, room, start, end, color: state.lessonColor });
    } else {
      lessons.push({ id: crypto.randomUUID(), name, day, teacher, room, start, end, color: state.lessonColor });
    }
    savePersonalLessons();
    renderSchedule();
    renderDashboard();
    return;
  }

  const lessons = classLessons(state.lessonTargetClass);
  if (state.editLesson) {
    Object.assign(lessons.find((x) => x.id === state.editLesson), { name, day, teacher, room, start, end, color: state.lessonColor });
  } else {
    lessons.push({ id: crypto.randomUUID(), name, day, teacher, room, start, end, color: state.lessonColor, addedBy: isAdmin() ? 'admin' : 'student' });
  }
  saveLessonsByClass();
  pushNotification({ title: 'Plan lekcji został zmieniony', text: `${name} — ${weekdayLabel(day)} ${start}–${end}`, classroom: state.lessonTargetClass, type: 'schedule' });
  if (state.lessonTargetClass === viewingClass()) { renderSchedule(); renderDashboard(); }
  if (document.querySelector('#adminClassSelect')?.value === state.lessonTargetClass) renderAdminLessonTable();
});

function renderTabs(container, items, activeCode, onSelect) {
  container.innerHTML = items.map((d) =>
    `<button type="button" class="rounded-[9px] border px-3 py-1.5 text-sm font-bold${d.code === activeCode ? ' border-primary bg-primary text-white' : ' border-line bg-app text-muted'}" data-tab="${d.code}">${d.label}</button>`
  ).join('');
  container.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => onSelect(b.dataset.tab)));
}
function renderDayTabs(container, activeDay, onSelect) {
  renderTabs(container, weekdays, activeDay, onSelect);
}

function renderViewingClassSwitcher() {
  const field = document.querySelector('#viewingClassField');
  const select = document.querySelector('#viewingClassSelect');
  const classes = accessibleClasses(currentUser);
  const show = classes.length > 1;
  field.classList.toggle('hidden', !show);
  if (!show) return;
  select.innerHTML = classes.map((c) => `<option value="${c}">${c}</option>`).join('');
  select.value = viewingClass();
}
document.querySelector('#viewingClassSelect').addEventListener('change', (e) => {
  state.viewingClassroom = e.target.value;
  renderSchedule();
  renderAnnouncements();
  renderSubjects();
});

function renderSchedule() {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const el = document.querySelector('#lessonList');
  const isToday = state.scheduleDay === currentWeekday();
  renderViewingClassSwitcher();
  document.querySelector('#scheduleDayTitle').textContent = `Plan lekcji · ${weekdayLabel(state.scheduleDay)}`;
  document.querySelector('#todayDate').textContent = isToday ? now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' }) : '';
  renderDayTabs(document.querySelector('#scheduleDayTabs'), state.scheduleDay, (day) => { state.scheduleDay = day; renderSchedule(); });
  const lessons = [
    ...classLessons(viewingClass()).filter((x) => x.day === state.scheduleDay),
    ...personalLessons().filter((x) => x.day === state.scheduleDay).map((x) => ({ ...x, personal: true })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  el.innerHTML = lessons.length ? lessons.map((x) => {
    const replacement = state.announcements.find((a) => a.lessonId === x.id && !a.pending);
    const replacementName = replacement?.title.replace(/^Zastępstwo:\s*/i, '');
    const isNow = isToday && current >= minutes(x.start) && current <= minutes(x.end);
    const editable = x.addedBy === 'student' || x.personal;
    return `<div class="relative grid grid-cols-[65px_1fr_auto] items-center overflow-hidden rounded-2xl border border-line${isNow ? ' outline outline-[3px] outline-offset-2 outline-amber-400' : ''}">
      ${isNow ? `<span class="absolute inset-x-0 top-0 z-10 border-t-[3px] border-amber-400 bg-amber-100 py-[3px] pr-2 text-right text-[9px] font-black tracking-widest text-amber-800">TERAZ</span>` : ''}
      <div class="grid h-full place-items-center py-4 text-center text-[.9em] font-extrabold text-white" style="background:${x.color}">${x.start}<br><small>${x.end}</small></div>
      <div class="px-4 py-3"><b class="block">${escapeHtml(x.name)}</b><span class="text-[.9em] text-muted">sala ${escapeHtml(x.room || '—')} · ${escapeHtml(x.teacher)}</span>${replacement ? `<span class="mt-1 inline-block rounded-lg bg-amber-100 px-2 py-1 text-[.78em] font-extrabold text-amber-800">Zastępstwo za: ${escapeHtml(replacementName)}</span>` : ''}${x.personal ? `<span class="mt-1 inline-block rounded-lg bg-indigo-100 px-2 py-1 text-[.78em] font-extrabold text-indigo-800">${icon('lock')} Tylko dla Ciebie</span>` : ''}</div>
      ${editable ? `<div class="mr-3 flex gap-1"><button class="rounded-lg bg-app px-2 py-2 font-extrabold text-primary" data-edit-lesson="${x.id}" data-personal="${x.personal ? '1' : ''}" aria-label="Edytuj lekcję">${icon('pencil')}</button><button class="rounded-lg bg-app px-2 py-2 font-extrabold text-red-600" data-delete-own-lesson="${x.id}" data-personal="${x.personal ? '1' : ''}" aria-label="Usuń lekcję">${icon('trash')}</button></div>` : ''}
    </div>`;
  }).join('') : emptyState('Brak lekcji', `Dodaj pierwszą lekcję na ${weekdayLabel(state.scheduleDay).toLowerCase()}.`);
  el.querySelectorAll('[data-edit-lesson]').forEach((b) => b.addEventListener('click', () => openLessonEditor(b.dataset.editLesson, viewingClass(), state.scheduleDay, b.dataset.personal === '1')));
  el.querySelectorAll('[data-delete-own-lesson]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Usunąć tę lekcję ze swojego planu?')) return;
    if (b.dataset.personal === '1') {
      const lessons = personalLessons();
      const idx = lessons.findIndex((x) => x.id === b.dataset.deleteOwnLesson);
      if (idx !== -1) lessons.splice(idx, 1);
      savePersonalLessons();
    } else {
      const lessons = classLessons(viewingClass());
      const idx = lessons.findIndex((x) => x.id === b.dataset.deleteOwnLesson);
      if (idx !== -1) lessons.splice(idx, 1);
      saveLessonsByClass();
      pushNotification({ title: 'Plan lekcji został zmieniony', text: 'Usunięto lekcję z planu.', classroom: viewingClass(), type: 'schedule' });
    }
    renderSchedule();
    renderDashboard();
  }));
}

// ---------- Home dashboard ----------
function pluralLessons(n) {
  if (n === 1) return 'lekcja';
  const lastTwo = n % 100, lastDigit = n % 10;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'lekcje';
  return 'lekcji';
}
function todayLessonsSorted() {
  const cls = viewingClass();
  if (!cls) return [];
  return [
    ...classLessons(cls).filter((x) => x.day === currentWeekday()),
    ...personalLessons().filter((x) => x.day === currentWeekday()),
  ].sort((a, b) => a.start.localeCompare(b.start));
}
function lessonRowHtml(x) {
  const replacement = state.announcements.find((a) => a.lessonId === x.id && !a.pending);
  const replacementName = replacement?.title.replace(/^Zastępstwo:\s*/i, '');
  return `<div class="flex items-start gap-3">
    <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-center text-[.8em] font-extrabold leading-tight text-white" style="background:${x.color}">${x.start}</span>
    <div>
      <b class="block text-[1.1em]">${escapeHtml(x.name)}</b>
      <span class="text-[.9em] text-muted">${x.start}–${x.end} · sala ${escapeHtml(x.room || '—')} · ${escapeHtml(x.teacher)}</span>
      ${replacement ? `<span class="mt-1 inline-block rounded-lg bg-amber-100 px-2 py-1 text-[.78em] font-extrabold text-amber-800">Zastępstwo za: ${escapeHtml(replacementName)}</span>` : ''}
    </div>
  </div>`;
}
function renderNextLessonCard() {
  const body = document.querySelector('#nextLessonBody');
  const lessons = todayLessonsSorted();
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const active = lessons.find((x) => current >= minutes(x.start) && current <= minutes(x.end));
  const next = lessons.find((x) => minutes(x.start) > current);
  if (!lessons.length) {
    body.innerHTML = `<p class="text-muted">Brak lekcji dzisiaj.</p>`;
  } else if (active) {
    body.innerHTML = `<span class="mb-2 inline-block rounded-lg bg-amber-100 px-2 py-1 text-[.78em] font-black tracking-wide text-amber-800">TERAZ — TRWA LEKCJA</span>${lessonRowHtml(active)}`;
  } else if (next) {
    body.innerHTML = `<span class="mb-2 inline-block rounded-lg bg-blue-100 px-2 py-1 text-[.78em] font-black tracking-wide text-blue-800">Następna lekcja za ${minutes(next.start) - current} min</span>${lessonRowHtml(next)}`;
  } else {
    body.innerHTML = `<p class="text-muted">Koniec lekcji na dziś.</p>`;
  }
}
function renderTodaySummaryCard() {
  const body = document.querySelector('#todaySummaryBody');
  const lessons = todayLessonsSorted();
  if (!lessons.length) {
    body.innerHTML = `<p class="text-muted">Brak lekcji zaplanowanych na ${weekdayLabel(currentWeekday()).toLowerCase()}.</p>`;
    return;
  }
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const upcoming = lessons.find((x) => current < minutes(x.end));
  body.innerHTML = `<ul class="grid gap-1.5 text-[.95em]">
    <li><b>${lessons.length}</b> ${pluralLessons(lessons.length)}</li>
    <li>Pierwsza: <b>${escapeHtml(lessons[0].name)}</b> o ${lessons[0].start}</li>
    <li>Ostatnia: <b>${escapeHtml(lessons[lessons.length - 1].name)}</b> do ${lessons[lessons.length - 1].end}</li>
    <li>Najbliższa: <b>${upcoming ? `${escapeHtml(upcoming.name)} o ${upcoming.start}` : 'brak — koniec lekcji'}</b></li>
  </ul>`;
}
function renderUpcomingEventsCard() {
  const body = document.querySelector('#upcomingEventsBody');
  const admin = isAdmin();
  const cls = viewingClass();
  const todayStr = new Date().toISOString().slice(0, 10);
  const events = state.announcements
    .filter((x) => !x.lessonId && (admin || x.classroom === 'all' || x.classroom === cls))
    .filter((x) => !x.date || x.date >= todayStr)
    .sort((a, b) => (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99'))
    .slice(0, 3);
  body.innerHTML = events.length ? events.map((x) => {
    const meta = [x.date, x.time].filter(Boolean).join(' · ');
    return `<div class="rounded-xl border border-line px-3.5 py-3">
      <b class="block">${escapeHtml(x.title)}</b>
      <span class="text-[.88em] text-muted">${escapeHtml(x.text)}</span>
      ${meta ? `<span class="mt-1 block text-xs font-bold text-primary">${escapeHtml(meta)}</span>` : ''}
    </div>`;
  }).join('') : `<p class="text-muted">Brak nadchodzących wydarzeń.</p>`;
}
function renderDashboard() {
  if (!currentUser) return;
  renderNextLessonCard();
  renderTodaySummaryCard();
  renderUpcomingEventsCard();
}

// ---------- Admin: per-class lesson plan table ----------
function renderAdminLessonTable() {
  const select = document.querySelector('#adminClassSelect');
  if (!select) return;
  const cls = select.value;
  renderDayTabs(document.querySelector('#adminDayTabs'), state.adminScheduleDay, (day) => { state.adminScheduleDay = day; renderAdminLessonTable(); });
  const lessons = classLessons(cls).filter((x) => x.day === state.adminScheduleDay).sort((a, b) => a.start.localeCompare(b.start));
  const el = document.querySelector('#adminLessonTable');
  el.innerHTML = lessons.length ? `<div class="overflow-x-auto"><table class="w-full min-w-[560px] border-collapse text-left text-sm">
    <thead><tr class="border-b border-line text-muted">
      <th class="py-2 pr-3 font-semibold">Godz.</th>
      <th class="py-2 pr-3 font-semibold">Przedmiot</th>
      <th class="py-2 pr-3 font-semibold">Nauczyciel</th>
      <th class="py-2 pr-3 font-semibold">Sala</th>
      <th class="py-2 pr-3 font-semibold">Kolor</th>
      <th class="py-2 pr-3 font-semibold">Źródło</th>
      <th class="py-2 pr-0 font-semibold text-right">Akcje</th>
    </tr></thead>
    <tbody>${lessons.map((x) => `<tr class="border-b border-line">
      <td class="whitespace-nowrap py-2 pr-3">${x.start}–${x.end}</td>
      <td class="py-2 pr-3 font-bold">${escapeHtml(x.name)}</td>
      <td class="py-2 pr-3">${escapeHtml(x.teacher)}</td>
      <td class="py-2 pr-3">${escapeHtml(x.room || '—')}</td>
      <td class="py-2 pr-3"><span class="inline-block h-4 w-4 rounded-full align-middle" style="background:${x.color}"></span></td>
      <td class="py-2 pr-3 text-muted">${x.addedBy === 'student' ? 'Uczeń' : 'Admin'}</td>
      <td class="py-2 pr-0 text-right whitespace-nowrap">
        <button class="rounded-lg bg-app px-2 py-1 font-bold text-primary" data-admin-edit-lesson="${x.id}">Edytuj</button>
        <button class="ml-1 rounded-lg bg-app px-2 py-1 font-bold text-red-600" data-admin-delete-lesson="${x.id}">Usuń</button>
      </td>
    </tr>`).join('')}</tbody>
  </table></div>` : emptyState('Brak lekcji', 'Ta klasa nie ma jeszcze planu lekcji.');
  el.querySelectorAll('[data-admin-edit-lesson]').forEach((b) => b.addEventListener('click', () => openLessonEditor(b.dataset.adminEditLesson, cls)));
  el.querySelectorAll('[data-admin-delete-lesson]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Usunąć tę lekcję z planu klasy?')) return;
    state.lessonsByClass[cls] = classLessons(cls).filter((x) => x.id !== b.dataset.adminDeleteLesson);
    saveLessonsByClass();
    pushNotification({ title: 'Plan lekcji został zmieniony', text: 'Usunięto lekcję z planu klasy.', classroom: cls, type: 'schedule' });
    renderAdminLessonTable();
    if (cls === viewingClass()) { renderSchedule(); renderDashboard(); }
  }));
}

// ---------- Announcements / replacements ----------
const eventStyles = { event: 'bg-blue-100 text-blue-900', reminder: 'bg-green-100 text-green-900', other: 'bg-amber-100 text-amber-900' };

function renderAnnouncements() {
  const admin = isAdmin();
  const cls = viewingClass();
  const events = state.announcements.filter((x) => !x.lessonId && (admin || x.classroom === 'all' || x.classroom === cls));
  const replacements = state.announcements.filter((x) => x.lessonId && !x.pending && (admin || x.classroom === cls));
  const eventEl = document.querySelector('#announcementList');
  const replacementEl = document.querySelector('#replacementList');

  eventEl.innerHTML = events.length ? events.map((x) => {
    const meta = [x.date, x.time].filter(Boolean).join(' · ');
    return `<article class="relative min-h-[145px] rounded-[25px] p-5 ${eventStyles[x.type] || eventStyles.other}">
      ${admin ? `<div class="absolute right-3 top-3 flex gap-1.5">
        <button class="rounded-lg bg-white/70 px-2 py-1 text-sm font-bold" title="Edytuj" data-edit-announcement="${x.id}">${icon('pencil')}</button>
        <button class="rounded-lg bg-white/70 px-2 py-1 text-sm font-bold" title="Usuń" data-delete-announcement="${x.id}">${icon('trash')}</button>
      </div>` : ''}
      <h2 class="mt-9 text-[1.2em] font-bold">${escapeHtml(x.title)}</h2><p class="mt-1 text-[.9em]">${escapeHtml(x.text)}</p>
      ${meta ? `<p class="mt-2 text-xs font-bold opacity-80">${escapeHtml(meta)}</p>` : ''}
      <div class="mt-2 flex flex-wrap gap-1.5">
        ${admin ? `<span class="inline-block rounded bg-white/60 px-1.5 py-0.5 text-xs font-bold">${escapeHtml(classLabel(x.classroom))}</span>` : ''}
        ${x.createdBy ? `<span class="inline-block rounded bg-white/60 px-1.5 py-0.5 text-xs font-bold">@${escapeHtml(x.createdBy)}</span>` : ''}
      </div>
    </article>`;
  }).join('') : emptyState('Brak ogłoszeń', 'Dodaj pierwszy szkolny plakat.');

  replacementEl.innerHTML = replacements.length ? replacements.map((x) =>
    `<div class="rounded-r-xl border-l-[5px] border-amber-500 bg-amber-50 py-3.5 pl-4 pr-4 text-amber-900">
      <div class="flex items-start justify-between gap-3">
        <div>
          <b class="block">${escapeHtml(x.title)}${admin ? ` <span class="ml-1 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold">${escapeHtml(x.classroom)}</span>` : ''}</b>
          <span class="text-[.9em] text-amber-800">${escapeHtml(x.text)}</span>
        </div>
        ${admin ? `<div class="flex shrink-0 gap-1.5">
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-amber-800" data-edit-announcement="${x.id}" aria-label="Edytuj zastępstwo">${icon('pencil')}</button>
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-red-700" data-delete-replacement="${x.id}" aria-label="Usuń zastępstwo">${icon('trash')}</button>
        </div>` : ''}
      </div>
    </div>`
  ).join('') : emptyState('Brak zastępstw', 'Wszystkie lekcje odbywają się zgodnie z planem.');

  document.querySelectorAll('[data-edit-announcement]').forEach((b) => b.addEventListener('click', () => {
    const item = state.announcements.find((x) => x.id === b.dataset.editAnnouncement);
    state.forceReplacement = !!item.lessonId;
    openEditor('announcement', b.dataset.editAnnouncement);
  }));
  replacementEl.querySelectorAll('[data-delete-replacement]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Usunąć to zastępstwo?')) return;
    state.announcements = state.announcements.filter((x) => x.id !== b.dataset.deleteReplacement);
    saveAnnouncements();
    renderAnnouncements();
    renderSchedule();
  }));
  eventEl.querySelectorAll('[data-delete-announcement]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Usunąć to ogłoszenie?')) return;
    state.announcements = state.announcements.filter((x) => x.id !== b.dataset.deleteAnnouncement);
    saveAnnouncements();
    renderAnnouncements();
  }));
}

// ---------- Admin: pending replacement reports ----------
function renderPendingReplacements() {
  const el = document.querySelector('#pendingReplacements');
  if (!el) return;
  const pending = state.announcements.filter((x) => x.pending);
  el.innerHTML = pending.length ? pending.map((x) => `
    <div class="rounded-r-xl border-l-[5px] border-amber-500 bg-amber-50 py-3.5 pl-4 pr-4 text-amber-900">
      <div class="flex items-start justify-between gap-3">
        <div>
          <b class="block">${escapeHtml(x.title)} <span class="ml-1 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold">${escapeHtml(x.classroom)}</span></b>
          <span class="text-[.9em] text-amber-800">${escapeHtml(x.text)}</span>
          ${x.createdBy ? `<span class="ml-1 text-xs font-bold text-amber-700">zgłosił @${escapeHtml(x.createdBy)}</span>` : ''}
        </div>
        <div class="flex shrink-0 gap-1.5">
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-green-700" data-approve-replacement="${x.id}">Zatwierdź</button>
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-red-700" data-reject-replacement="${x.id}">Usuń</button>
        </div>
      </div>
    </div>`
  ).join('') : `<div class="col-span-full rounded-[20px] border-2 border-dashed border-line px-5 py-11 text-center text-muted">Brak zgłoszeń.</div>`;
  el.querySelectorAll('[data-approve-replacement]').forEach((b) => b.addEventListener('click', () => {
    const item = state.announcements.find((x) => x.id === b.dataset.approveReplacement);
    item.pending = false;
    saveAnnouncements();
    pushNotification({ title: 'Plan lekcji został zmieniony', text: `Zastępstwo: ${item.title}`, classroom: item.classroom, type: 'schedule' });
    renderPendingReplacements();
    renderAnnouncements();
    renderSchedule();
    renderDashboard();
  }));
  el.querySelectorAll('[data-reject-replacement]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Usunąć to zgłoszenie?')) return;
    state.announcements = state.announcements.filter((x) => x.id !== b.dataset.rejectReplacement);
    saveAnnouncements();
    renderPendingReplacements();
  }));
}

// ---------- Admin: starter competences package (per grade 1-8) ----------
function renderStarterSubjects() {
  const el = document.querySelector('#starterSubjectList');
  if (!el) return;
  const tabsEl = document.querySelector('#starterGradeTabs');
  if (tabsEl) renderTabs(tabsEl, gradeTabItems, state.adminStarterGrade, (grade) => { state.adminStarterGrade = grade; renderStarterSubjects(); });
  const subjects = starterSubjectsForGrade(state.adminStarterGrade);
  el.innerHTML = subjects.length ? subjects.map((s) => `
    <div class="rounded-2xl border border-line p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="h-6 w-6 shrink-0 rounded-lg" style="background:${s.gradient}"></span>
          <b>${escapeHtml(s.name)}</b>
        </div>
        <div class="flex shrink-0 gap-1.5">
          <button class="rounded-lg bg-app px-2 py-1 font-bold text-primary" data-add-starter-competence="${s.id}">+ Kompetencja</button>
          <button class="rounded-lg bg-app px-2 py-1 font-bold text-red-600" data-delete-starter-subject="${s.id}">Usuń przedmiot</button>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        ${s.competences.length ? s.competences.map((c) => `
          <span class="inline-flex items-center gap-1.5 rounded-lg bg-app px-2.5 py-1 text-sm text-ink">
            ${escapeHtml(c.name)}
            <button class="font-bold text-red-600" data-delete-starter-competence="${s.id}|${c.id}" aria-label="Usuń kompetencję">×</button>
          </span>`).join('') : '<span class="text-sm text-muted">Brak kompetencji</span>'}
      </div>
    </div>`
  ).join('') : emptyState('Brak przedmiotów', 'Dodaj pierwszy przedmiot do pakietu startowego.');

  el.querySelectorAll('[data-add-starter-competence]').forEach((b) => b.addEventListener('click', () => {
    state.activeTemplateSubject = b.dataset.addStarterCompetence;
    openEditor('competence', null, 'template');
  }));
  el.querySelectorAll('[data-delete-starter-subject]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Usunąć ten przedmiot z pakietu startowego?')) return;
    state.starterSubjectsByGrade[state.adminStarterGrade] = subjects.filter((s) => s.id !== b.dataset.deleteStarterSubject);
    saveStarterSubjectsByGrade();
    renderStarterSubjects();
  }));
  el.querySelectorAll('[data-delete-starter-competence]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Usunąć tę kompetencję z pakietu startowego?')) return;
    const [subjectId, competenceId] = b.dataset.deleteStarterCompetence.split('|');
    const subject = subjects.find((s) => s.id === subjectId);
    subject.competences = subject.competences.filter((c) => c.id !== competenceId);
    saveStarterSubjectsByGrade();
    renderStarterSubjects();
  }));
}
document.querySelector('#addStarterSubject')?.addEventListener('click', () => openEditor('subject', null, 'template'));

// ---------- Settings ----------
// Every visual setting is cached in localStorage (so it applies instantly on load,
// even before Firestore responds) AND mirrored into the logged-in account's Firestore
// doc (settings: {...}) via persistUserSettings(), so it follows that user to any other
// browser/device they log into — see applyAccountSettings(), called from finishLogin()
// and from boot()'s "restore session" path.
const fontSize = document.querySelector('#fontSize');
function applyFontSize(px) {
  document.documentElement.style.fontSize = px + 'px';
  fontSize.value = px;
}
applyFontSize(localStorage.getItem('schoolFontSize') || 16);
fontSize.addEventListener('input', () => {
  applyFontSize(fontSize.value);
  localStorage.setItem('schoolFontSize', fontSize.value);
  persistUserSettings();
});

function applyBg(hex) {
  document.documentElement.style.setProperty('--bg', hex);
  document.querySelectorAll('[data-bg]').forEach((x) => setSelected(x, x.dataset.bg === hex, ['ring-2', 'ring-ink', 'ring-offset-2'], []));
}
applyBg(localStorage.getItem('schoolBg') || '#f5f7ff');
document.querySelectorAll('[data-bg]').forEach((b) => b.addEventListener('click', () => {
  applyBg(b.dataset.bg);
  localStorage.setItem('schoolBg', b.dataset.bg);
  persistUserSettings();
}));

const colourSettingWrap = document.querySelector('#colourSettingWrap');
const colourSetting = document.querySelector('#backgrounds').closest('[data-setting]');
function updateColourVisibility() {
  const dark = document.body.classList.contains('dark');
  colourSettingWrap.classList.toggle('grid-rows-[0fr]', dark);
  colourSettingWrap.classList.toggle('grid-rows-[1fr]', !dark);
  colourSetting.classList.toggle('opacity-0', dark);
  colourSetting.classList.toggle('opacity-100', !dark);
}

// "Auto" follows the clock: light during the day (6:00–20:00), dark at night. It's the default
// and re-checks periodically so a long-open tab still switches over at dawn/dusk on its own.
const isDaytime = () => { const h = new Date().getHours(); return h >= 6 && h < 20; };
const effectiveDark = (mode) => mode === 'dark' || (mode === 'auto' && !isDaytime());
function applyMode(mode) {
  document.body.classList.toggle('dark', effectiveDark(mode));
  updateColourVisibility();
  document.querySelectorAll('[data-mode]').forEach((x) => setSelected(x, x.dataset.mode === mode, ['bg-primary', 'text-white', 'border-primary'], ['bg-app', 'text-muted', 'border-line']));
}
applyMode(localStorage.getItem('schoolMode') || 'auto');
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  localStorage.setItem('schoolMode', b.dataset.mode);
  applyMode(b.dataset.mode);
  persistUserSettings();
}));
setInterval(() => applyMode(localStorage.getItem('schoolMode') || 'auto'), 5 * 60 * 1000);

const patternClasses = ['pattern-smile', 'pattern-heart', 'pattern-star', 'pattern-panda'];
function applyPattern(pattern) {
  document.body.classList.remove(...patternClasses);
  if (pattern !== 'none') document.body.classList.add('pattern-' + pattern);
  document.querySelectorAll('[data-pattern]').forEach((x) => setSelected(x, x.dataset.pattern === pattern, ['ring-2', 'ring-ink', 'ring-offset-1'], []));
}
applyPattern(localStorage.getItem('schoolPattern') || 'none');
document.querySelectorAll('[data-pattern]').forEach((b) => b.addEventListener('click', () => {
  applyPattern(b.dataset.pattern);
  localStorage.setItem('schoolPattern', b.dataset.pattern);
  persistUserSettings();
}));

// "Efekt pór roku": a colour palette (body.season-*) plus a layer of falling/floating
// particles drawn on a full-screen canvas — autumn leaves, winter snow, spring petals,
// summer sparkles. The setting is 'off' (default), 'auto' (follows the calendar month) or
// one fixed season. The palette always applies when on; the moving particles only run while
// "Animacje" is on, the OS isn't asking for reduced motion and the tab is visible.
const SEASON_NAMES = ['autumn', 'winter', 'spring', 'summer'];
const seasonCanvas = document.querySelector('#seasonCanvas');
const seasonCtx = seasonCanvas.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let seasonSetting = 'off';
let seasonParticles = [];
let seasonFrame = 0;
let seasonLastTime = 0;
let seasonShown = null;
function seasonFor(setting) {
  if (setting !== 'auto') return SEASON_NAMES.includes(setting) ? setting : null;
  const month = new Date().getMonth();
  if (month >= 8 && month <= 10) return 'autumn';
  if (month === 11 || month <= 1) return 'winter';
  return month <= 4 ? 'spring' : 'summer';
}
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const SEASON_COLORS = {
  autumn: ['#e8731a', '#c8401e', '#f0a020', '#a8501c', '#d9892b', '#b8321c'],
  spring: ['#f9a8c9', '#f7bdd5', '#f6a5c0', '#f48fb1', '#fbc4da'],
  summer: ['#ffc933', '#ffd966', '#ffb300', '#fff0a8'],
};
function newSeasonParticle(season, w, h, anywhere) {
  const size = { autumn: rand(8, 15), winter: rand(1.8, 5.5), spring: rand(4, 8), summer: rand(1.5, 4) }[season];
  const p = { x: rand(0, w), y: anywhere ? rand(-h * 0.05, h) : rand(-40, -5), size, rot: rand(0, 6.28), vr: rand(-1.4, 1.4), phase: rand(0, 6.28), sway: rand(0.4, 1.3), color: pick(SEASON_COLORS[season] || ['#fff']), round: Math.random() < 0.4 };
  if (season === 'autumn') { p.vy = rand(35, 70); p.vx = rand(-10, 18); }
  else if (season === 'winter') { p.vy = rand(30, 75) * (size / 4 + 0.5); p.vx = rand(-8, 8); p.vr = rand(-0.6, 0.6); }
  else if (season === 'spring') { p.vy = rand(22, 45); p.vx = rand(4, 22); }
  else { p.vy = rand(-16, -4); p.vx = rand(-6, 6); p.y = anywhere ? rand(0, h) : rand(h * 0.6, h + 20); }
  return p;
}
function drawSeasonParticle(ctx, season, p, time) {
  ctx.save();
  if (season === 'summer') {
    const twinkle = 0.45 + 0.55 * Math.sin(time * 2 + p.phase);
    ctx.globalAlpha = 0.18 * twinkle;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.2, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 0.55 + 0.4 * twinkle;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  if (season === 'autumn') {
    const s = p.size;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    if (p.round) { ctx.ellipse(0, 0, s * 0.62, s, 0, 0, 6.283); } else {
      ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.95, -s * 0.45, s * 0.8, s * 0.55, 0, s);
      ctx.bezierCurveTo(-s * 0.8, s * 0.55, -s * 0.95, -s * 0.45, 0, -s);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 30, 10, .4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.lineTo(0, s * 1.25); ctx.stroke();
  } else if (season === 'spring') {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, 6.283); ctx.fill();
  } else if (p.size > 4.3) {
    ctx.strokeStyle = 'rgba(150, 185, 220, .9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; ctx.moveTo(Math.cos(a) * p.size, Math.sin(a) * p.size); ctx.lineTo(-Math.cos(a) * p.size, -Math.sin(a) * p.size); }
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, .95)';
    ctx.strokeStyle = 'rgba(140, 175, 215, .6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 6.283); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
function sizeSeasonCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  seasonCanvas.width = Math.round(window.innerWidth * ratio);
  seasonCanvas.height = Math.round(window.innerHeight * ratio);
  seasonCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
function seasonTick(now) {
  seasonFrame = 0;
  if (!seasonShown) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dt = Math.min(0.05, (now - seasonLastTime) / 1000 || 0.016);
  seasonLastTime = now;
  seasonCtx.clearRect(0, 0, w, h);
  seasonParticles.forEach((p, i) => {
    p.phase += dt * p.sway * 2;
    p.x += (p.vx + Math.sin(p.phase) * (seasonShown === 'summer' ? 8 : 22)) * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    const gone = p.y > h + 30 || p.y < -30 || p.x > w + 40 || p.x < -40;
    if (gone) seasonParticles[i] = newSeasonParticle(seasonShown, w, h, false);
    drawSeasonParticle(seasonCtx, seasonShown, seasonParticles[i], now / 1000);
  });
  seasonFrame = requestAnimationFrame(seasonTick);
}
function stopSeasonParticles() {
  cancelAnimationFrame(seasonFrame);
  seasonFrame = 0;
  seasonParticles = [];
  seasonShown = null;
  seasonCtx.clearRect(0, 0, seasonCanvas.width, seasonCanvas.height);
  seasonCanvas.classList.add('hidden');
}
function refreshSeason() {
  const season = seasonFor(seasonSetting);
  document.body.classList.remove(...SEASON_NAMES.map((n) => `season-${n}`));
  if (season) document.body.classList.add(`season-${season}`);
  const motion = season && !document.body.classList.contains('no-animations') && !reducedMotion.matches;
  if (!motion) { stopSeasonParticles(); return; }
  if (seasonShown !== season) {
    stopSeasonParticles();
    seasonShown = season;
    sizeSeasonCanvas();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const count = Math.round(Math.min(season === 'winter' ? 90 : 55, Math.max(18, w / (season === 'winter' ? 14 : 24))));
    seasonParticles = Array.from({ length: count }, () => newSeasonParticle(season, w, h, true));
  }
  seasonCanvas.classList.remove('hidden');
  if (!seasonFrame) { seasonLastTime = performance.now(); seasonFrame = requestAnimationFrame(seasonTick); }
}
function applySeason(setting) {
  seasonSetting = ['off', 'auto', ...SEASON_NAMES].includes(setting) ? setting : 'off';
  refreshSeason();
  document.querySelectorAll('[data-season]').forEach((x) => setSelected(x, x.dataset.season === seasonSetting, ['bg-primary', 'text-white', 'border-primary'], ['bg-app', 'text-muted', 'border-line']));
}
window.addEventListener('resize', () => { if (seasonShown) sizeSeasonCanvas(); });
reducedMotion.addEventListener?.('change', refreshSeason);
setInterval(refreshSeason, 30 * 60 * 1000);
document.querySelectorAll('[data-season]').forEach((b) => b.addEventListener('click', () => {
  applySeason(b.dataset.season);
  localStorage.setItem('schoolSeason', seasonSetting);
  persistUserSettings();
}));

function applyAnimations(enabled) {
  document.body.classList.toggle('no-animations', !enabled);
  refreshSeason();
  document.querySelectorAll('[data-animations]').forEach((x) => setSelected(x, x.dataset.animations === (enabled ? 'on' : 'off'), ['bg-primary', 'text-white', 'border-primary'], ['bg-app', 'text-muted', 'border-line']));
}
applyAnimations(localStorage.getItem('schoolAnimations') !== 'off');
applySeason(localStorage.getItem('schoolSeason') || 'off');
document.querySelectorAll('[data-animations]').forEach((b) => b.addEventListener('click', () => {
  const enabled = b.dataset.animations === 'on';
  applyAnimations(enabled);
  localStorage.setItem('schoolAnimations', enabled ? 'on' : 'off');
  persistUserSettings();
}));

function applyRadius(radius) {
  document.body.classList.remove('radius-small', 'radius-medium', 'radius-large');
  document.body.classList.add('radius-' + radius);
  document.querySelectorAll('[data-radius]').forEach((x) => setSelected(x, x.dataset.radius === radius, ['bg-primary', 'text-white', 'border-primary'], ['bg-app', 'text-muted', 'border-line']));
}
applyRadius(localStorage.getItem('schoolRadius') || 'large');
document.querySelectorAll('[data-radius]').forEach((b) => b.addEventListener('click', () => {
  applyRadius(b.dataset.radius);
  localStorage.setItem('schoolRadius', b.dataset.radius);
  persistUserSettings();
}));

function applyAccent(hex) {
  document.documentElement.style.setProperty('--primary', hex);
  document.querySelectorAll('[data-accent]').forEach((x) => setSelected(x, x.dataset.accent === hex, ['ring-2', 'ring-ink', 'ring-offset-2'], []));
}
applyAccent(localStorage.getItem('schoolAccent') || '#4f46e5');
document.querySelectorAll('[data-accent]').forEach((b) => b.addEventListener('click', () => {
  applyAccent(b.dataset.accent);
  localStorage.setItem('schoolAccent', b.dataset.accent);
  persistUserSettings();
}));

function currentSettingsSnapshot() {
  return {
    fontSize: Number(localStorage.getItem('schoolFontSize')) || 16,
    mode: localStorage.getItem('schoolMode') || 'auto',
    bg: localStorage.getItem('schoolBg') || '#f5f7ff',
    pattern: localStorage.getItem('schoolPattern') || 'none',
    animations: localStorage.getItem('schoolAnimations') !== 'off',
    radius: localStorage.getItem('schoolRadius') || 'large',
    accent: localStorage.getItem('schoolAccent') || '#4f46e5',
    season: localStorage.getItem('schoolSeason') || 'off',
  };
}
function persistUserSettings() {
  if (!currentUser) return;
  const settings = currentSettingsSnapshot();
  const account = accounts.find((a) => normalise(a.name) === normalise(currentUser.name));
  if (!account) return;
  account.settings = settings;
  setDoc(accountDocRef(account.name), account);
}
function applyAccountSettings(settings) {
  if (!settings) return;
  localStorage.setItem('schoolFontSize', settings.fontSize ?? 16);
  localStorage.setItem('schoolMode', settings.mode || 'auto');
  localStorage.setItem('schoolBg', settings.bg || '#f5f7ff');
  localStorage.setItem('schoolPattern', settings.pattern || 'none');
  localStorage.setItem('schoolAnimations', settings.animations === false ? 'off' : 'on');
  localStorage.setItem('schoolRadius', settings.radius || 'large');
  localStorage.setItem('schoolAccent', settings.accent || '#4f46e5');
  localStorage.setItem('schoolSeason', settings.season || 'off');
  applyFontSize(settings.fontSize || 16);
  applyBg(settings.bg || '#f5f7ff');
  applyMode(settings.mode || 'auto');
  applyPattern(settings.pattern || 'none');
  applyAnimations(settings.animations !== false);
  applyRadius(settings.radius || 'large');
  applyAccent(settings.accent || '#4f46e5');
  applySeason(settings.season || 'off');
}

// ---------- Password hashing ----------
// Passwords are never stored or compared as plain text. Each account keeps a random
// per-account salt plus a PBKDF2-SHA256 derived hash (Web Crypto, no extra library).
// This is still a client-side scheme (there's no server to hash on, only Firestore),
// so it doesn't defend against a compromised Firestore project the way a real backend
// auth service would — but it means a leaked/rules-misconfigured database no longer
// hands out anyone's actual password, which plain text did.
function bytesToHex(bytes) { return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(hex) { const arr = new Uint8Array(hex.length / 2); for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16); return arr; }
async function hashPassword(password, saltHex = null) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, keyMaterial, 256);
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}
async function verifyPassword(password, hash, salt) {
  const attempt = await hashPassword(password, salt);
  return attempt.hash === hash;
}
// Ties this browser's Firebase Anonymous Auth UID to the account being logged into, so
// Firestore security rules can eventually check "is this request coming from a device
// that actually logged into this account" instead of trusting the app alone (see
// firestore.rules). Keeps only the last 5 devices to bound the array's size.
function rememberAuthUid(user) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  user.authUids = Array.from(new Set([...(user.authUids || []), uid])).slice(-5);
  // Until the updated rules in firestore.rules are published in the Firebase console,
  // this collection isn't allowed by the live rules yet — fail silently rather than
  // surface an unhandled-rejection error for a write nothing depends on today.
  setDoc(doc(db, 'uidAccount', uid), { accountId: normalise(user.name) }).catch(() => {});
}

// ---------- Accounts / login ----------
const classSelect = document.querySelector('#classroom');
classSelect.innerHTML += classOptionsHtml;
const childClassesSelect = document.querySelector('#childClasses');
childClassesSelect.innerHTML = classOptionsHtml;
let accounts = [];
let currentUser = JSON.parse(localStorage.getItem('schoolUser') || 'null');
const normalise = (name) => name.trim().toLocaleLowerCase('pl-PL');
const isAdmin = () => currentUser && (normalise(currentUser.name) === 'tpraglowski' || accounts.find((x) => normalise(x.name) === normalise(currentUser.name))?.admin);
const isParent = () => currentUser?.role === 'parent';
const isTeacher = () => currentUser?.role === 'teacher';
const screen = (id) => document.querySelectorAll('#startScreen,#loginForm,#registerForm').forEach((x) => x.classList.toggle('hidden', x.id !== id));

// A student only ever sees their own class. A teacher can see/switch between every
// class. A parent can see/switch between their children's classes (1-5 of them).
// state.viewingClassroom holds whichever of these is currently displayed.
function accessibleClasses(user) {
  if (!user) return [];
  if (user.role === 'teacher') return classCodes;
  if (user.role === 'parent') return user.childClasses?.length ? user.childClasses : [user.classroom || classCodes[0]];
  return [user.classroom];
}
const viewingClass = () => state.viewingClassroom || currentUser?.classroom;
const accountStillExists = (user) => !!user && (normalise(user.name) === 'tpraglowski' || accounts.some((a) => normalise(a.name) === normalise(user.name)));
function roleLabel(a) {
  if (a.admin) return 'Administrator';
  if (a.role === 'teacher') return 'Nauczyciel';
  if (a.role === 'parent') return `Rodzic (klasy: ${(a.childClasses || []).join(', ') || '—'})`;
  return 'Uczeń';
}

document.querySelector('#openLogin').addEventListener('click', () => screen('loginForm'));
document.querySelector('#openRegister').addEventListener('click', () => {
  document.querySelector('#registerRole').value = 'student';
  updateRegisterRoleFields();
  screen('registerForm');
});
document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => screen('startScreen')));

const registerRole = document.querySelector('#registerRole');
const classroomField = document.querySelector('#classroomField');
const childClassesField = document.querySelector('#childClassesField');
function updateRegisterRoleFields() {
  const role = registerRole.value;
  classroomField.classList.toggle('hidden', role !== 'student');
  classSelect.required = role === 'student';
  childClassesField.classList.toggle('hidden', role !== 'parent');
  childClassesSelect.required = role === 'parent';
}
registerRole.addEventListener('change', updateRegisterRoleFields);
updateRegisterRoleFields();
childClassesSelect.addEventListener('change', () => {
  const selected = [...childClassesSelect.selectedOptions];
  if (selected.length > 5) {
    selected[selected.length - 1].selected = false;
    alert('Możesz wybrać maksymalnie 5 klas.');
  }
});

function logout(message) {
  localStorage.removeItem('schoolUser');
  currentUser = null;
  document.querySelector('#homeAdmin')?.remove();
  document.querySelector('#logoutButton')?.remove();
  document.querySelector('#notifPanel').classList.add('hidden');
  renderNotifications();
  // Admin-only content (notably per-account notes) must not linger in the DOM for
  // whoever logs into this same browser next — the admin section stays mounted
  // (just hidden) between logins, so its rendered lists need clearing explicitly.
  ['#accountList', '#pendingTeachers', '#pendingReplacements', '#adminLessonTable', '#starterSubjectList', '#teacherToolsGrid'].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.innerHTML = '';
  });
  state.timerRuntime = {};
  state.teacherToolsEditing = false;
  state.activeTimerTool = null;
  state.activeTool = null;
  editingClassId = null;
  state.pickerResult = {};
  state.groupsResult = {};
  state.seatEditing = false;
  state.selectedDesk = null;
  document.querySelector('#headerTimerIndicator').classList.add('hidden');
  document.querySelector('#loginLayer').classList.remove('hidden');
  screen('startScreen');
  show('home');
  if (message) alert(message);
}

function finishLogin(user) {
  currentUser = { name: user.name, classroom: user.classroom, role: user.role || 'student', childClasses: user.childClasses || [], graduated: user.graduated || false, graduatedAt: user.graduatedAt || null };
  localStorage.setItem('schoolUser', JSON.stringify(currentUser));
  state.viewingClassroom = accessibleClasses(currentUser)[0];
  document.querySelector('#loginLayer').classList.add('hidden');
  applyAccountSettings(user.settings);
  persistUserSettings();
  setupUserInterface();
}

document.querySelector('#registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = capitalize(document.querySelector('#registerUsername').value.trim());
  if (accounts.some((x) => normalise(x.name) === normalise(name))) return alert('Takie konto już istnieje.');
  const role = registerRole.value;
  const childClasses = role === 'parent' ? [...childClassesSelect.selectedOptions].map((o) => o.value) : [];
  if (role === 'parent' && (!childClasses.length || childClasses.length > 5)) return alert('Wybierz od 1 do 5 klas dziecka.');
  const classroom = role === 'student' ? classSelect.value : role === 'parent' ? childClasses[0] : null;
  const pending = role === 'teacher';
  const { hash, salt } = await hashPassword(document.querySelector('#registerPassword').value);
  const user = { name, role, classroom, childClasses, pending, passwordHash: hash, passwordSalt: salt, admin: normalise(name) === 'tpraglowski', authUids: [] };
  rememberAuthUid(user);
  accounts.push(user);
  setDoc(accountDocRef(user.name), user);
  if (role === 'student') {
    if (!subjectsForClass(user.classroom).length) seedClassSubjectsFromStarter(user.classroom);
  } else if (role === 'parent') {
    childClasses.forEach((cls) => { if (!subjectsForClass(cls).length) seedClassSubjectsFromStarter(cls); });
  }
  if (pending) {
    registerRole.value = 'student';
    updateRegisterRoleFields();
    document.querySelector('#registerForm').reset();
    screen('startScreen');
    alert('Konto nauczyciela zostało utworzone i oczekuje na zatwierdzenie przez administratora. Zaloguj się, gdy zostanie zatwierdzone.');
    return;
  }
  finishLogin(user);
});

document.querySelector('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.querySelector('#password').value;
  const user = accounts.find((x) => normalise(x.name) === normalise(document.querySelector('#username').value));
  let ok = false;
  if (user?.passwordHash && user?.passwordSalt) {
    ok = await verifyPassword(password, user.passwordHash, user.passwordSalt);
  } else if (user?.password !== undefined) {
    // Legacy account created before password hashing was added — verify once against
    // the old plain-text field, then transparently upgrade it to a salted hash so the
    // plain-text password is never written back to Firestore again.
    ok = user.password === password;
    if (ok) {
      const { hash, salt } = await hashPassword(password);
      delete user.password;
      user.passwordHash = hash;
      user.passwordSalt = salt;
    }
  }
  if (!user || !ok) return alert('Nieprawidłowa nazwa użytkownika lub hasło.');
  if (user.role === 'teacher' && user.pending) return alert('Konto nauczyciela oczekuje jeszcze na zatwierdzenie przez administratora.');
  rememberAuthUid(user);
  setDoc(accountDocRef(user.name), user);
  finishLogin(user);
});

// Account list is admin-only and can grow long, so it's collapsible — state is a
// per-device UI preference (not synced to the account like settings are).
const accountListWrap = document.querySelector('#accountListWrap');
const toggleAccountListBtn = document.querySelector('#toggleAccountList');
let accountListCollapsed = localStorage.getItem('schoolAccountListCollapsed') === '1';
function applyAccountListCollapse() {
  accountListWrap.classList.toggle('grid-rows-[0fr]', accountListCollapsed);
  accountListWrap.classList.toggle('grid-rows-[1fr]', !accountListCollapsed);
  toggleAccountListBtn.textContent = accountListCollapsed ? '▸' : '▾';
  toggleAccountListBtn.setAttribute('aria-expanded', String(!accountListCollapsed));
}
applyAccountListCollapse();
toggleAccountListBtn.addEventListener('click', () => {
  accountListCollapsed = !accountListCollapsed;
  localStorage.setItem('schoolAccountListCollapsed', accountListCollapsed ? '1' : '0');
  applyAccountListCollapse();
});

function renderAccounts() {
  const el = document.querySelector('#accountList');
  const approved = accounts.filter((a) => !(a.role === 'teacher' && a.pending));
  el.innerHTML = approved.length ? approved.map((a) =>
    `<div class="rounded-r-xl border-l-[5px] border-amber-500 bg-amber-50 py-3.5 pl-4 pr-4 text-amber-900">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <b class="block">${escapeHtml(a.name)}${a.role === 'student' ? ` · klasa ${a.classroom}` : ''}</b>
          <span class="text-[.9em] text-amber-800">${roleLabel(a)}</span>
          ${a.adminNote ? `<span class="mt-1 block max-w-[320px] text-[.85em] italic text-amber-700">${icon('note')} ${escapeHtml(a.adminNote)}</span>` : ''}
        </div>
        <div class="flex shrink-0 gap-1.5">
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-amber-800" data-edit-account="${escapeHtml(a.name)}">Edytuj</button>
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-amber-800" data-account="${escapeHtml(a.name)}">Zmień dostęp</button>
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-red-700" data-remove-account="${escapeHtml(a.name)}">Usuń</button>
        </div>
      </div>
    </div>`
  ).join('') : `<div class="col-span-full rounded-[20px] border-2 border-dashed border-line px-5 py-11 text-center text-muted">Brak kont.</div>`;

  el.querySelectorAll('[data-edit-account]').forEach((b) => b.addEventListener('click', () => openAccountEditor(b.dataset.editAccount)));
  el.querySelectorAll('[data-account]').forEach((b) => b.addEventListener('click', () => {
    const account = accounts.find((a) => normalise(a.name) === normalise(b.dataset.account));
    account.admin = !account.admin;
    setDoc(accountDocRef(account.name), account);
    renderAccounts();
  }));
  el.querySelectorAll('[data-remove-account]').forEach((b) => b.addEventListener('click', () => {
    if (normalise(b.dataset.removeAccount) === 'tpraglowski' || !confirm('Usunąć to konto?')) return;
    accounts = accounts.filter((a) => normalise(a.name) !== normalise(b.dataset.removeAccount));
    deleteDoc(accountDocRef(b.dataset.removeAccount));
    renderAccounts();
  }));
}

function renderPendingTeachers() {
  const el = document.querySelector('#pendingTeachers');
  if (!el) return;
  const pending = accounts.filter((a) => a.role === 'teacher' && a.pending);
  el.innerHTML = pending.length ? pending.map((a) => `
    <div class="rounded-r-xl border-l-[5px] border-amber-500 bg-amber-50 py-3.5 pl-4 pr-4 text-amber-900">
      <div class="flex items-center justify-between gap-3">
        <b class="block">${escapeHtml(a.name)} <span class="ml-1 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold">Nauczyciel</span></b>
        <div class="flex shrink-0 gap-1.5">
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-green-700" data-approve-teacher="${escapeHtml(a.name)}">Zatwierdź</button>
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-red-700" data-reject-teacher="${escapeHtml(a.name)}">Odrzuć</button>
        </div>
      </div>
    </div>`
  ).join('') : `<div class="col-span-full rounded-[20px] border-2 border-dashed border-line px-5 py-11 text-center text-muted">Brak zgłoszeń.</div>`;
  el.querySelectorAll('[data-approve-teacher]').forEach((b) => b.addEventListener('click', () => {
    const account = accounts.find((a) => normalise(a.name) === normalise(b.dataset.approveTeacher));
    account.pending = false;
    setDoc(accountDocRef(account.name), account);
    renderPendingTeachers();
    renderAccounts();
  }));
  el.querySelectorAll('[data-reject-teacher]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Odrzucić to konto nauczyciela?')) return;
    accounts = accounts.filter((a) => normalise(a.name) !== normalise(b.dataset.rejectTeacher));
    deleteDoc(accountDocRef(b.dataset.rejectTeacher));
    renderPendingTeachers();
  }));
}

// ---------- Admin: edit any account's role/class ----------
const accountEditorDialog = document.querySelector('#accountEditor');
const editAccountRole = document.querySelector('#editAccountRole');
const editAccountClassField = document.querySelector('#editAccountClassField');
const editAccountClass = document.querySelector('#editAccountClass');
const editAccountChildClassesField = document.querySelector('#editAccountChildClassesField');
const editAccountChildClasses = document.querySelector('#editAccountChildClasses');
editAccountClass.innerHTML = classOptionsHtml;
editAccountChildClasses.innerHTML = classOptionsHtml;
let editingAccountName = null;

function updateEditAccountFields() {
  const role = editAccountRole.value;
  editAccountClassField.classList.toggle('hidden', role !== 'student');
  editAccountChildClassesField.classList.toggle('hidden', role !== 'parent');
}
editAccountRole.addEventListener('change', updateEditAccountFields);
editAccountChildClasses.addEventListener('change', () => {
  const selected = [...editAccountChildClasses.selectedOptions];
  if (selected.length > 5) {
    selected[selected.length - 1].selected = false;
    alert('Możesz wybrać maksymalnie 5 klas.');
  }
});

function openAccountEditor(name) {
  const account = accounts.find((a) => normalise(a.name) === normalise(name));
  if (!account) return;
  editingAccountName = account.name;
  document.querySelector('#editAccountName').value = account.name;
  editAccountRole.value = account.role || 'student';
  editAccountClass.value = account.classroom || classCodes[0];
  [...editAccountChildClasses.options].forEach((o) => { o.selected = (account.childClasses || []).includes(o.value); });
  document.querySelector('#editAccountNote').value = account.adminNote || '';
  updateEditAccountFields();
  accountEditorDialog.showModal();
}
document.querySelector('#cancelAccountEditor').addEventListener('click', () => accountEditorDialog.close('cancel'));

accountEditorDialog.addEventListener('close', () => {
  if (accountEditorDialog.returnValue !== 'save' || !editingAccountName) return;
  const oldName = editingAccountName;
  const newName = capitalize(document.querySelector('#editAccountName').value.trim());
  if (!newName) return;
  const nameChanged = normalise(newName) !== normalise(oldName);
  if (nameChanged && accounts.some((a) => normalise(a.name) === normalise(newName))) return alert('Konto o tej nazwie już istnieje.');
  const role = editAccountRole.value;
  const childClasses = role === 'parent' ? [...editAccountChildClasses.selectedOptions].map((o) => o.value) : [];
  if (role === 'parent' && (!childClasses.length || childClasses.length > 5)) return alert('Wybierz od 1 do 5 klas dziecka.');
  const classroom = role === 'student' ? editAccountClass.value : role === 'parent' ? childClasses[0] : null;
  const adminNote = document.querySelector('#editAccountNote').value.trim();
  const original = accounts.find((a) => normalise(a.name) === normalise(oldName));
  const updated = { ...original, name: newName, role, classroom, childClasses, pending: false, adminNote };
  accounts = accounts.map((a) => (normalise(a.name) === normalise(oldName) ? updated : a));
  if (nameChanged) deleteDoc(accountDocRef(oldName));
  setDoc(accountDocRef(newName), updated);
  if (original.role !== role || original.classroom !== classroom) {
    pushNotification({ title: 'Nastąpiła zmiana dotycząca Twojej klasy', text: 'Administrator zmienił Twoją rolę lub klasę na koncie. Zaloguj się ponownie, aby zobaczyć zmiany.', targetUser: newName, type: 'account' });
  }
  renderAccounts();
});

// ---------- Automatic school-year rollover ----------
// Every Sept 1st, each student moves up a grade (3B -> 4B); 8th-graders have nowhere
// further to go, so they're flagged "graduated" instead and shown a notice that their
// account will be removed on Oct 1st, when the cleanup step actually deletes it.
// Parents' children's classes move up the same way. This has no server/cron behind it —
// whichever browser happens to load the app first after each date runs it — so a
// Firestore transaction is used purely as a claim ticket (whoever wins the transaction
// is the one that actually applies the change) to guarantee it only ever runs once even
// if several people open the app at the same moment.
const schoolYearStateRef = doc(db, 'store', 'schoolYearState');
const schoolYearLabel = (date) => (date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1);
function promotedClassroom(cls) {
  const grade = Number(gradeOfClass(cls));
  const letter = cls.slice(-1);
  return grade < 8 ? `${grade + 1}${letter}` : null;
}
async function claimSchoolYearStep(field, label) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(schoolYearStateRef);
    if (!snap.exists()) {
      // This feature's very first run ever, at some arbitrary point in the school year
      // (not necessarily Sept 1st). Record the current label as the baseline WITHOUT
      // acting on it — otherwise deploying this mid-year would immediately "promote"
      // everyone for a transition that already happened before this code existed.
      // Only a later, genuine Sept 1st (label advancing past this baseline) promotes.
      tx.set(schoolYearStateRef, { promotedYear: label, cleanedYear: label });
      return false;
    }
    const data = snap.data();
    if (data[field] === label) return false;
    tx.set(schoolYearStateRef, { ...data, [field]: label }, { merge: true });
    return true;
  });
}
async function runSchoolYearRollover() {
  const now = new Date();
  const label = schoolYearLabel(now);

  if (await claimSchoolYearStep('promotedYear', label)) {
    // Mutate each account object in place (not just write to Firestore) so the in-memory
    // `accounts` array is already up to date for the Oct-1 cleanup check further down —
    // otherwise a first visit that happens to land after Oct 1st (promotion and cleanup
    // both firing in this same pass) would miss deleting students who just graduated.
    await Promise.all(accounts.map((a) => {
      if (a.role === 'student' && a.classroom) {
        const next = promotedClassroom(a.classroom);
        Object.assign(a, next ? { classroom: next } : { graduated: true, graduatedAt: now.toISOString() });
        return setDoc(accountDocRef(a.name), a);
      }
      if (a.role === 'parent' && a.childClasses?.length) {
        const nextClasses = a.childClasses.map((c) => promotedClassroom(c) || c);
        Object.assign(a, { childClasses: nextClasses, classroom: nextClasses[0] });
        return setDoc(accountDocRef(a.name), a);
      }
      return Promise.resolve();
    }));
    accounts.forEach((a) => {
      if (a.role !== 'student' || a.graduated || !a.classroom) return;
      if (!subjectsForClass(a.classroom).length) seedClassSubjectsFromStarter(a.classroom);
    });
    pushNotification({ title: 'Nastąpiła zmiana dotycząca Twojej klasy', text: 'Rozpoczął się nowy rok szkolny — sprawdź swoją klasę i plan lekcji.', classroom: 'all', type: 'account' });
  }

  const octFirst = new Date(label, 9, 1);
  if (now >= octFirst && (await claimSchoolYearStep('cleanedYear', label))) {
    await Promise.all(accounts.filter((a) => a.graduated).map((a) => deleteDoc(accountDocRef(a.name))));
  }
}

// ---------- Teacher tools ----------
// Lives entirely on the teacher's own account doc (like personalLessons/settings),
// so it's private to that teacher — no one else ever sees or syncs it. Only "timer"
// exists as a tool type for now; the add button is built so more types can slot in
// later without changing this shape. The countdown itself (remaining/running) is
// local-only runtime state, never persisted — only the label/duration configuration
// (and the last-used duration, for the preset shortcut) is.
function teacherToolsFor() {
  const account = currentAccount();
  if (!account) return [];
  return account.teacherTools || (account.teacherTools = []);
}
function saveTeacherTools() {
  const account = currentAccount();
  if (!account) return;
  setDoc(accountDocRef(account.name), account);
}
function formatTimer(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
// Every tool type the "+" picker offers. Add an entry here (plus rendering for it)
// to make a new kind of tool available.
const toolTypes = [
  { type: 'timer', icon: 'timer', name: 'Timer', description: 'Odliczanie czasu na pełnym ekranie' },
  { type: 'picker', icon: 'dice', name: 'Losowanie osoby', description: 'Losuje ucznia z klasy; wylosowany nie wypadnie przez następne 5 losowań' },
  { type: 'groups', icon: 'users', name: 'Losowanie grup', description: 'Dzieli klasę na grupy, z możliwością rozdzielenia wybranych osób' },
  { type: 'seating', icon: 'seat', name: 'Rozsadzanie osób', description: 'Losowo sadza klasę przy stolikach (miejsca, ławki): własny układ stolików, wybrany rząd dla osoby i „nie obok”' },
];
const toolTypeInfo = (type) => toolTypes.find((t) => t.type === type) || toolTypes[0];
const toolPickerDialog = document.querySelector('#toolPicker');
function renderToolPickerList() {
  const query = document.querySelector('#toolSearch').value.trim().toLocaleLowerCase('pl-PL');
  const matches = toolTypes.filter((t) => `${t.name} ${t.description}`.toLocaleLowerCase('pl-PL').includes(query));
  const list = document.querySelector('#toolPickerList');
  list.innerHTML = matches.length ? matches.map((t) =>
    `<button type="button" class="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left shadow-[0_4px_15px_var(--shadow)] transition hover:border-primary" data-pick-tool="${t.type}">
      <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-app text-2xl">${icon(t.icon)}</span>
      <span><b class="block">${t.name}</b><span class="text-[.85em] text-muted">${t.description}</span></span>
    </button>`
  ).join('') : emptyState('Brak wyników', 'Żadna funkcja nie pasuje do wyszukiwania.');
  list.querySelectorAll('[data-pick-tool]').forEach((b) => b.addEventListener('click', () => {
    addTeacherTool(b.dataset.pickTool);
    toolPickerDialog.close();
  }));
}
function openToolPicker() {
  document.querySelector('#toolSearch').value = '';
  renderToolPickerList();
  toolPickerDialog.showModal();
  document.querySelector('#toolSearch').focus();
}
document.querySelector('#toolSearch').addEventListener('input', renderToolPickerList);
document.querySelector('#cancelToolPicker').addEventListener('click', () => toolPickerDialog.close());
function addTeacherTool(type) {
  const account = currentAccount();
  const tool = { id: crypto.randomUUID(), type, label: '' };
  if (type === 'timer') tool.duration = account?.lastTimerSeconds || 300;
  if (type === 'picker' || type === 'groups' || type === 'seating') tool.classId = teacherClasses().length === 1 ? teacherClasses()[0].id : null;
  if (type === 'seating') Object.assign(tool, { desks: defaultDesks(), seatPlans: {} });
  if (type === 'groups') Object.assign(tool, { groupMode: 'count', groupValue: 2 });
  teacherToolsFor().push(tool);
  saveTeacherTools();
  renderTeacherTools();
}
function ensureTimerRuntime(tool) {
  return state.timerRuntime[tool.id] || (state.timerRuntime[tool.id] = { remaining: tool.duration, running: false });
}
// A tile is just an entry point — clicking it opens that tool's own full-screen view
// (the timer tile never shows the countdown itself).
const MAX_PINNED_TOOLS = 5;
// Deleting a tool takes two clicks on the trash button (the first one arms it for 4 s),
// so a stray tap can't remove a tool and there's no native dialog that could be blocked.
let armedDeleteTool = null;
let armedDeleteTimer = null;
function armToolDelete(id) {
  armedDeleteTool = id;
  clearTimeout(armedDeleteTimer);
  armedDeleteTimer = setTimeout(() => { armedDeleteTool = null; renderTeacherTools(); }, 4000);
  renderTeacherTools();
}
const pinnedCount = () => teacherToolsFor().filter((t) => t.pinned).length;
const tileButton = (attrs, label, content, extra = '') => `<span role="button" tabindex="0" class="grid h-8 min-w-8 place-items-center rounded-lg bg-app px-1.5 text-sm font-bold ${extra}" ${attrs} aria-label="${label}" title="${label}">${content}</span>`;
function toolTileHtml(tool, editing) {
  const info = toolTypeInfo(tool.type);
  return `<button type="button" class="relative min-h-[140px] rounded-[20px] border bg-card p-5 text-left shadow-[0_7px_22px_var(--shadow)] transition hover:-translate-y-1 hover:shadow-lg ${tool.pinned ? 'border-primary' : 'border-line'}" data-open-tool="${tool.id}">
    <span class="absolute right-3 top-3 z-10 flex gap-1.5">
      ${tileButton(`data-pin-tool="${tool.id}"`, tool.pinned ? 'Odepnij' : 'Przypnij', icon('pin'), tool.pinned ? 'bg-primary text-white' : 'opacity-60')}
      ${tool.type === 'seating' ? tileButton(`data-settings-tool="${tool.id}"`, 'Ustawienia rozsadzania', icon('gear')) : ''}
      ${armedDeleteTool === tool.id ? tileButton(`data-delete-tool="${tool.id}"`, 'Kliknij ponownie, aby usunąć', icon('trash'), 'bg-red-600 text-white') : tileButton(`data-delete-tool="${tool.id}"`, 'Usuń narzędzie', icon('trash'), 'text-red-600')}
    </span>
    <span class="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-app text-xl">${icon(info.icon)}</span>
    <b class="block truncate">${escapeHtml(tool.label || info.name)}</b>
    <span class="text-[.85em] text-muted">${info.name}</span>
  </button>`;
}
function openTool(id) {
  const tool = teacherToolsFor().find((t) => t.id === id);
  if (!tool) return;
  if (tool.type === 'picker') openPickerScreen(id);
  else if (tool.type === 'groups') openGroupsScreen(id);
  else if (tool.type === 'seating') openSeatingScreen(id);
  else openTimerScreen(id);
}
function deleteTool(id) {
  const account = currentAccount();
  if (!account) return;
  account.teacherTools = teacherToolsFor().filter((t) => t.id !== id);
  delete state.timerRuntime[id];
  delete state.pickerResult[id];
  delete state.groupsResult[id];
  saveTeacherTools();
  renderTeacherTools();
  updateHeaderTimerIndicator();
}
// At most MAX_PINNED_TOOLS tools can be pinned; pinned ones are listed first.
function setPinned(tool, pinned) {
  if (pinned && !tool.pinned && pinnedCount() >= MAX_PINNED_TOOLS) return false;
  tool.pinned = pinned;
  saveTeacherTools();
  renderTeacherTools();
  return true;
}
let pinNoteTimer = null;
function showPinNote() {
  const note = document.querySelector('#pinNote');
  note.textContent = `Możesz przypiąć maksymalnie ${MAX_PINNED_TOOLS} narzędzi — najpierw odepnij któreś.`;
  note.classList.remove('hidden');
  clearTimeout(pinNoteTimer);
  pinNoteTimer = setTimeout(() => note.classList.add('hidden'), 4000);
}
function bindTeacherToolsEvents(el) {
  document.querySelector('#addTeacherTool')?.addEventListener('click', openToolPicker);
  const onTileButton = (selector, handler) => el.querySelectorAll(selector).forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    const run = (e) => { e.preventDefault(); e.stopPropagation(); handler(b); };
    b.addEventListener('click', run);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') run(e); });
  });
  onTileButton('[data-delete-tool]', (b) => {
    if (armedDeleteTool !== b.dataset.deleteTool) { armToolDelete(b.dataset.deleteTool); return; }
    armedDeleteTool = null;
    clearTimeout(armedDeleteTimer);
    deleteTool(b.dataset.deleteTool);
  });
  onTileButton('[data-pin-tool]', (b) => {
    const tool = teacherToolsFor().find((t) => t.id === b.dataset.pinTool);
    if (tool && !setPinned(tool, !tool.pinned)) showPinNote();
  });
  onTileButton('[data-settings-tool]', (b) => openToolSettings(b.dataset.settingsTool));
  el.querySelectorAll('[data-open-tool]').forEach((b) => b.addEventListener('click', () => openTool(b.dataset.openTool)));
}
const toolSectionTitle = (text) => `<h3 class="col-span-full text-sm font-bold uppercase tracking-wide text-muted">${text}</h3>`;
function renderToolSections(tools, editing) {
  const pinned = tools.filter((t) => t.pinned);
  if (!pinned.length) return tools.map((t) => toolTileHtml(t, editing)).join('');
  const rest = tools.filter((t) => !t.pinned);
  return toolSectionTitle(`${icon('pin')} Przypięte (${pinned.length}/${MAX_PINNED_TOOLS})`)
    + pinned.map((t) => toolTileHtml(t, editing)).join('')
    + (rest.length || editing ? toolSectionTitle('Pozostałe narzędzia') : '')
    + rest.map((t) => toolTileHtml(t, editing)).join('');
}
// Settings dialog of the seating tool. They belong to the tool and hold for every class
// (never for just the one class that happens to be selected). Everything applies
// immediately (no save button to forget).
const toolSettingsDialog = document.querySelector('#toolSettings');
let settingsToolId = null;
const settingsTool = () => teacherToolsFor().find((t) => t.id === settingsToolId);
function renderToolSettings() {
  const tool = settingsTool();
  if (!tool) { toolSettingsDialog.close(); return; }
  const info = toolTypeInfo(tool.type);
  document.querySelector('#toolSettingsType').innerHTML = `${icon(info.icon)} ${escapeHtml(info.name)}`;
  document.querySelector('#toolSettingsName').placeholder = info.name;
  if (document.activeElement !== document.querySelector('#toolSettingsName')) document.querySelector('#toolSettingsName').value = tool.label || '';
  document.querySelector('#toolSettingsManual').checked = !!tool.manualRows;
  document.querySelectorAll('input[name="seatDrawMode"]').forEach((r) => { r.checked = r.value === (tool.drawMode || 'random'); });
  const pin = document.querySelector('#toolSettingsPin');
  pin.checked = !!tool.pinned;
  const full = !tool.pinned && pinnedCount() >= MAX_PINNED_TOOLS;
  pin.disabled = full;
  document.querySelector('#toolSettingsPinNote').textContent = full
    ? `Masz już ${MAX_PINNED_TOOLS} przypiętych narzędzi — odepnij któreś, żeby przypiąć to.`
    : `Przypięte narzędzia są na górze listy (${pinnedCount()}/${MAX_PINNED_TOOLS}).`;
}
function openToolSettings(id) {
  settingsToolId = id;
  renderToolSettings();
  document.querySelector('#toolSettingsName').value = settingsTool()?.label || '';
  toolSettingsDialog.showModal();
}
document.querySelector('#toolSettingsName').addEventListener('change', (e) => {
  const tool = settingsTool();
  if (!tool) return;
  renameTool(tool, e.target.value);
  renderTeacherTools();
});
document.querySelectorAll('input[name="seatDrawMode"]').forEach((radio) => radio.addEventListener('change', () => {
  const tool = settingsTool();
  if (!tool || !radio.checked) return;
  tool.drawMode = radio.value;
  saveTeacherTools();
}));
document.querySelector('#toolSettingsManual').addEventListener('change', (e) => {
  const tool = settingsTool();
  if (!tool) return;
  setSeatManualRows(tool, e.target.checked);
  saveTeacherTools();
});
document.querySelector('#toolSettingsPin').addEventListener('change', (e) => {
  const tool = settingsTool();
  if (!tool) return;
  if (!setPinned(tool, e.target.checked)) e.target.checked = false;
  renderToolSettings();
});
let settingsDeleteTimer = null;
const disarmSettingsDelete = () => {
  clearTimeout(settingsDeleteTimer);
  settingsDeleteTimer = null;
  document.querySelector('#toolSettingsDelete').lastChild.textContent = 'Usuń narzędzie';
};
document.querySelector('#toolSettingsDelete').addEventListener('click', () => {
  if (!settingsTool()) return;
  if (!settingsDeleteTimer) {
    document.querySelector('#toolSettingsDelete').lastChild.textContent = 'Na pewno? Kliknij ponownie';
    settingsDeleteTimer = setTimeout(disarmSettingsDelete, 4000);
    return;
  }
  disarmSettingsDelete();
  deleteTool(settingsToolId);
  toolSettingsDialog.close();
});
document.querySelector('#toolSettingsDone').addEventListener('click', () => toolSettingsDialog.close());
function renderTeacherTools() {
  if (!isTeacher()) return;
  const tools = teacherToolsFor();
  const editing = state.teacherToolsEditing;
  document.querySelector('#editTeacherTools').textContent = editing ? 'Gotowe' : 'Edytuj';
  const addTileHtml = editing ? `<button type="button" class="grid min-h-[140px] place-items-center rounded-[20px] border-2 border-dashed border-line text-4xl font-bold text-muted" id="addTeacherTool" aria-label="Dodaj narzędzie">+</button>` : '';
  const el = document.querySelector('#teacherToolsGrid');
  el.innerHTML = !tools.length && !editing
    ? emptyState('Brak narzędzi', 'Kliknij „Edytuj”, aby dodać pierwsze narzędzie.')
    : renderToolSections(tools, editing) + addTileHtml;
  bindTeacherToolsEvents(el);
}
document.querySelector('#editTeacherTools').addEventListener('click', () => {
  state.teacherToolsEditing = !state.teacherToolsEditing;
  renderTeacherTools();
});

// ---------- Timer full-screen view ----------
function openTimerScreen(id) {
  const tool = teacherToolsFor().find((t) => t.id === id);
  if (!tool) return;
  state.activeTimerTool = id;
  ensureTimerRuntime(tool);
  renderTimerScreen();
  show('timerScreen');
}
function applyTimerDuration(seconds) {
  const tool = teacherToolsFor().find((t) => t.id === state.activeTimerTool);
  if (!tool || seconds <= 0) return;
  tool.duration = seconds;
  const account = currentAccount();
  if (account) account.lastTimerSeconds = seconds;
  state.timerRuntime[tool.id] = { remaining: seconds, running: false };
  saveTeacherTools();
  renderTimerScreen();
  updateHeaderTimerIndicator();
}
function renderTimerPresets(tool) {
  const lastUsed = currentAccount()?.lastTimerSeconds || 300;
  const presets = [
    { seconds: 60, label: '1 min' },
    { seconds: 300, label: '5 min' },
    { seconds: 600, label: '10 min' },
    { seconds: lastUsed, label: `Ostatnio: ${formatTimer(lastUsed)}` },
  ];
  document.querySelector('#timerPresets').innerHTML = presets.map((p) =>
    `<button type="button" class="rounded-lg border px-3 py-1.5 text-sm font-bold${p.seconds === tool.duration ? ' border-primary bg-primary text-white' : ' border-line bg-app text-ink'}" data-preset-seconds="${p.seconds}">${p.label}</button>`
  ).join('');
  document.querySelectorAll('[data-preset-seconds]').forEach((b) => b.addEventListener('click', () => applyTimerDuration(Number(b.dataset.presetSeconds))));
}
function renderTimerScreen() {
  const tool = teacherToolsFor().find((t) => t.id === state.activeTimerTool);
  if (!tool) { show('teacherTools'); return; }
  const runtime = ensureTimerRuntime(tool);
  document.querySelector('#timerScreenLabel').value = tool.label || '';
  document.querySelector('#timerScreenDisplay').textContent = formatTimer(runtime.remaining);
  document.querySelector('#timerScreenToggle').textContent = runtime.running ? 'Pauza' : 'Start';
  document.querySelector('#timerHours').value = Math.floor(tool.duration / 3600);
  document.querySelector('#timerMinutes').value = Math.floor((tool.duration % 3600) / 60);
  document.querySelector('#timerSeconds').value = tool.duration % 60;
  renderTimerPresets(tool);
}
document.querySelector('#timerScreenLabel').addEventListener('change', () => {
  const tool = teacherToolsFor().find((t) => t.id === state.activeTimerTool);
  if (!tool) return;
  tool.label = document.querySelector('#timerScreenLabel').value.trim();
  saveTeacherTools();
  updateHeaderTimerIndicator();
});
document.querySelector('#timerScreenToggle').addEventListener('click', () => {
  const runtime = state.timerRuntime[state.activeTimerTool];
  if (!runtime) return;
  runtime.running = !runtime.running;
  renderTimerScreen();
  updateHeaderTimerIndicator();
});
document.querySelector('#timerScreenReset').addEventListener('click', () => {
  const tool = teacherToolsFor().find((t) => t.id === state.activeTimerTool);
  if (!tool) return;
  state.timerRuntime[tool.id] = { remaining: tool.duration, running: false };
  renderTimerScreen();
  updateHeaderTimerIndicator();
});
document.querySelector('#timerSetCustom').addEventListener('click', () => {
  const h = Math.min(23, Math.max(0, Number(document.querySelector('#timerHours').value) || 0));
  const m = Math.min(59, Math.max(0, Number(document.querySelector('#timerMinutes').value) || 0));
  const s = Math.min(59, Math.max(0, Number(document.querySelector('#timerSeconds').value) || 0));
  applyTimerDuration(h * 3600 + m * 60 + s);
});

// ---------- Class tools: classes, random person, random groups ----------
// A "klasa" (name, students, "not in the same group" pairs, and the random-person draw
// history) is entered once, saved on the teacher's own account, and then picked from
// either draw tool — like the class manager on the Random Seat site. Each tool only
// remembers which class it uses (tool.classId) plus its own settings.
const PICK_COOLDOWN = 5;
function titleCaseWords(text) {
  return text.replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('pl-PL'));
}
function parseRoster(text) {
  const seen = new Set();
  return text.split(/\n+/).map((s) => titleCaseWords(s.trim().replace(/\s+/g, ' '))).filter((s) => {
    const key = s.toLocaleLowerCase('pl-PL');
    if (!s || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 60);
}
function randomInt(n) {
  const max = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= max);
  return buf[0] % n;
}
function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// The solvers (groups, seating) shuffle inside their innermost loops, millions of times
// when the rules are unsatisfiable — far too many for crypto.getRandomValues, which made
// the page freeze for a long time. They use Math.random (plenty for who-sits-where) and
// give up after SOLVER_BUDGET_MS instead of grinding on.
const SOLVER_BUDGET_MS = 1200;
function fastShuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const studentsLabel = (n) => `${n} ${n === 1 ? 'uczeń' : 'uczniów'}`;
// Classes are shared by every teacher: they live in the store/teacherClasses document
// (live-synced like lessons and announcements), not on any one teacher's account. Each
// write is a transaction that replaces/adds/removes just the one class by id, so two
// teachers working on different classes at once don't overwrite each other. What stays
// private per teacher is the random-person draw history (account.pickHistory), since
// one teacher's draws shouldn't lock students out of another teacher's draws.
const teacherClasses = () => state.teacherClasses;
const publicClass = ({ id, name, students, apart, seatApart, seatRows, createdBy }) => ({
  id, name, students, apart: apart || [], seatApart: seatApart || [], seatRows: seatRows || [], createdBy: createdBy || '',
});
// Writes are queued so they reach the server in order, and while any is in flight the
// incoming live snapshots of this document are ignored (they'd be older than our own
// local edits and would briefly revert them); once the queue drains the latest version
// is fetched and applied.
let classWriteChain = Promise.resolve();
let classWritesPending = 0;
function writeClasses(mutator) {
  classWritesPending++;
  const run = () => runTransaction(db, async (tx) => {
    const snap = await tx.get(storeDoc('teacherClasses'));
    const list = snap.exists() ? (snap.data().value || []) : [];
    tx.set(storeDoc('teacherClasses'), { value: mutator(list) });
  });
  const result = classWriteChain.then(run);
  classWriteChain = result.catch(() => {});
  return result.finally(async () => {
    if (--classWritesPending > 0) return;
    const latest = await getDoc(storeDoc('teacherClasses'));
    applyStoreValue('teacherClasses', latest.data()?.value);
    renderAfterStoreChange('teacherClasses');
  });
}
const saveClass = (cls) => {
  const clean = publicClass(cls);
  return writeClasses((list) => (list.some((c) => c.id === clean.id) ? list.map((c) => (c.id === clean.id ? clean : c)) : [...list, clean]))
    .catch((err) => console.error('Nie udało się zapisać klasy', err));
};
// Edits are applied to the server's current copy of the class (not to our possibly
// stale one), so two quick edits — or two teachers editing different fields — can't
// overwrite each other. `mutate` therefore runs twice (locally for instant feedback,
// then on the server copy) and must only use its closed-over values.
function updateClass(id, mutate) {
  const local = teacherClasses().find((c) => c.id === id);
  if (local) mutate(local);
  return writeClasses((list) => list.map((c) => {
    if (c.id !== id) return c;
    const copy = { ...c, students: [...c.students], apart: [...(c.apart || [])], seatApart: [...(c.seatApart || [])], seatRows: [...(c.seatRows || [])] };
    mutate(copy);
    return publicClass(copy);
  })).catch((err) => console.error('Nie udało się zapisać klasy', err));
}
const deleteClassRemote = (id) => writeClasses((list) => list.filter((c) => c.id !== id))
  .catch((err) => console.error('Nie udało się usunąć klasy', err));
function createClass(fields) {
  const cls = { id: crypto.randomUUID(), name: `Klasa ${teacherClasses().length + 1}`, students: [], apart: [], seatApart: [], seatRows: [], createdBy: currentUser?.name || '', ...fields };
  state.teacherClasses = [...state.teacherClasses, cls];
  saveClass(cls);
  return cls;
}
// The draw history is per teacher and per class.
const pickHistory = (classId) => currentAccount()?.pickHistory?.[classId] || [];
function setPickHistory(classId, names) {
  const account = currentAccount();
  if (!account) return;
  (account.pickHistory || (account.pickHistory = {}))[classId] = names;
  saveTeacherTools();
}
// Classes used to be stored on each teacher's own account; move any such leftovers into
// the shared list (skipping ids already there) and carry their draw history across.
async function migrateAccountClasses() {
  const before = currentAccount();
  const own = before?.teacherClasses;
  if (!own?.length) return;
  const moved = own.map((c) => publicClass({ ...c, createdBy: c.createdBy || before.name }));
  const histories = Object.fromEntries(own.filter((c) => c.recent?.length).map((c) => [c.id, c.recent]));
  await writeClasses((list) => [...list, ...moved.filter((c) => !list.some((x) => x.id === c.id))]);
  // Re-fetch the account: a live update may have replaced the object during the await.
  const account = currentAccount();
  if (!account) return;
  account.pickHistory = { ...histories, ...(account.pickHistory || {}) };
  account.teacherClasses = [];
  saveTeacherTools();
}
const activeClassTool = () => teacherToolsFor().find((t) => t.id === state.activeTool);
const toolClass = (tool) => teacherClasses().find((c) => c.id === tool?.classId) || null;
function renameTool(tool, value) {
  tool.label = value.trim();
  saveTeacherTools();
  updateToolsNav();
}
// Tools saved before classes existed carried their own student list; turn it into a
// class once, then link the tool to it (or to the teacher's only class if it has none).
function linkToolToClass(tool) {
  if (!tool.classId && tool.students?.length) {
    const cls = createClass({ name: tool.label || `Klasa ${teacherClasses().length + 1}`, students: tool.students, apart: tool.apart || [] });
    if (tool.recent?.length) setPickHistory(cls.id, tool.recent);
    tool.classId = cls.id;
  }
  ['students', 'apart', 'recent'].forEach((key) => delete tool[key]);
  if (!toolClass(tool)) tool.classId = teacherClasses().length === 1 ? teacherClasses()[0].id : null;
  saveTeacherTools();
}
function renderToolScreen() {
  const tool = activeClassTool();
  if (!tool) return;
  if (tool.type === 'picker') renderPickerScreen();
  else if (tool.type === 'seating') renderSeatingScreen();
  else renderGroupsScreen();
}
// Each teacher can pin up to MAX_PINNED_CLASSES classes (stored on their own account);
// pinned classes are listed first in the class pickers.
const MAX_PINNED_CLASSES = 5;
const isClassPinned = (id) => (currentAccount()?.pinnedClasses || []).includes(id);
const pinnedClassCount = () => teacherClasses().filter((c) => isClassPinned(c.id)).length;
function renderClassBars() {
  const tool = activeClassTool();
  const classes = [...teacherClasses().filter((c) => isClassPinned(c.id)), ...teacherClasses().filter((c) => !isClassPinned(c.id))];
  const cls = toolClass(tool);
  document.querySelectorAll('[data-class-bar]').forEach((bar) => {
    bar.querySelector('[data-class-select]').innerHTML =
      `<option value="">${classes.length ? 'Wybierz klasę…' : 'Brak klas — dodaj pierwszą (+)'}</option>` +
      classes.map((c) => `<option value="${c.id}">${isClassPinned(c.id) ? '★ ' : ''}${escapeHtml(c.name)}</option>`).join('');
    bar.querySelector('[data-class-select]').value = cls ? cls.id : '';
    bar.querySelector('[data-class-edit]').disabled = !cls;
    const pin = bar.querySelector('[data-class-pin]');
    pin.disabled = !cls;
    const pinned = !!cls && isClassPinned(cls.id);
    pin.classList.toggle('bg-primary', pinned);
    pin.classList.toggle('text-white', pinned);
    pin.classList.toggle('bg-app', !pinned);
    pin.title = pin.ariaLabel = pinned ? 'Odepnij klasę' : 'Przypnij klasę';
    bar.querySelector('[data-class-summary]').textContent = cls
      ? `${studentsLabel(cls.students.length)}${cls.apart.length ? ` · reguł grup: ${cls.apart.length}` : ''}${cls.seatApart.length + cls.seatRows.length ? ` · reguł miejsc: ${cls.seatApart.length + cls.seatRows.length}` : ''}${cls.createdBy ? ` · dodał(a): ${cls.createdBy}` : ''}`
      : '';
  });
}
document.querySelectorAll('[data-class-bar]').forEach((bar) => {
  bar.querySelector('[data-class-select]').addEventListener('change', (e) => {
    const tool = activeClassTool();
    if (!tool) return;
    tool.classId = e.target.value || null;
    delete state.pickerResult[tool.id];
    delete state.groupsResult[tool.id];
    saveTeacherTools();
    renderToolScreen();
  });
  bar.querySelector('[data-class-add]').addEventListener('click', () => {
    const tool = activeClassTool();
    if (!tool) return;
    const cls = createClass({});
    tool.classId = cls.id;
    delete state.pickerResult[tool.id];
    delete state.groupsResult[tool.id];
    saveTeacherTools();
    renderToolScreen();
    openClassEditor(cls.id);
  });
  bar.querySelector('[data-class-edit]').addEventListener('click', () => {
    const cls = toolClass(activeClassTool());
    if (cls) openClassEditor(cls.id);
  });
  bar.querySelector('[data-class-pin]').addEventListener('click', () => {
    const cls = toolClass(activeClassTool());
    const account = currentAccount();
    if (!cls || !account) return;
    const pinned = (account.pinnedClasses || []).filter((id) => teacherClasses().some((c) => c.id === id));
    if (pinned.includes(cls.id)) {
      account.pinnedClasses = pinned.filter((id) => id !== cls.id);
    } else if (pinned.length >= MAX_PINNED_CLASSES) {
      const summary = bar.querySelector('[data-class-summary]');
      summary.textContent = `Możesz przypiąć maksymalnie ${MAX_PINNED_CLASSES} klas — najpierw odepnij którąś.`;
      setTimeout(renderClassBars, 3500);
      return;
    } else {
      account.pinnedClasses = [...pinned, cls.id];
    }
    saveTeacherTools();
    renderClassBars();
  });
});

// -- Class editor (name, students, groups rules) --
// Every change saves right away and refreshes the screen behind the dialog, so closing
// it any way (button, backdrop, Esc) leaves nothing unsaved.
const classEditorDialog = document.querySelector('#classEditor');
let editingClassId = null;
const editingClass = () => teacherClasses().find((c) => c.id === editingClassId);
function renderClassEditor() {
  const cls = editingClass();
  if (!cls) return;
  document.querySelector('#classNameInput').value = cls.name;
  document.querySelector('#classNamesInput').value = cls.students.join('\n');
  document.querySelector('#classNameCount').textContent = studentsLabel(cls.students.length);
  const options = cls.students.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  document.querySelector('#classApartA').innerHTML = options;
  document.querySelector('#classApartB').innerHTML = options;
  if (cls.students.length > 1) document.querySelector('#classApartB').selectedIndex = 1;
  const list = document.querySelector('#classApartList');
  list.innerHTML = cls.apart.length ? cls.apart.map(({ a, b }, i) =>
    `<span class="inline-flex items-center gap-1.5 rounded-lg bg-app px-2.5 py-1 text-sm font-bold">${escapeHtml(a)} ✕ ${escapeHtml(b)}<button type="button" class="font-bold text-red-600" data-remove-apart="${i}" aria-label="Usuń regułę">×</button></span>`
  ).join('') : '<span class="text-sm text-muted">Brak reguł.</span>';
  list.querySelectorAll('[data-remove-apart]').forEach((b) => b.addEventListener('click', () => {
    const { a, b: other } = cls.apart[Number(b.dataset.removeApart)];
    updateClass(cls.id, (c) => { c.apart = c.apart.filter((p) => !(p.a === a && p.b === other)); });
    renderClassEditor();
    renderToolScreen();
  }));

  // Seating rules: pairs who shouldn't sit next to each other, and person -> row.
  document.querySelector('#classSeatApartA').innerHTML = options;
  document.querySelector('#classSeatApartB').innerHTML = options;
  if (cls.students.length > 1) document.querySelector('#classSeatApartB').selectedIndex = 1;
  document.querySelector('#classSeatRowName').innerHTML = options;
  document.querySelector('#classSeatRowNo').innerHTML = Array.from({ length: SEAT_ROW_MAX }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  const chip = (text, attr, i) => `<span class="inline-flex items-center gap-1.5 rounded-lg bg-app px-2.5 py-1 text-sm font-bold">${text}<button type="button" class="font-bold text-red-600" ${attr}="${i}" aria-label="Usuń regułę">×</button></span>`;
  const seatApartList = document.querySelector('#classSeatApartList');
  seatApartList.innerHTML = cls.seatApart.length ? cls.seatApart.map(({ a, b }, i) => chip(`${escapeHtml(a)} ✕ ${escapeHtml(b)}`, 'data-remove-seat-apart', i)).join('') : '<span class="text-sm text-muted">Brak reguł.</span>';
  seatApartList.querySelectorAll('[data-remove-seat-apart]').forEach((btn) => btn.addEventListener('click', () => {
    const { a, b } = cls.seatApart[Number(btn.dataset.removeSeatApart)];
    updateClass(cls.id, (c) => { c.seatApart = c.seatApart.filter((p) => !(p.a === a && p.b === b)); });
    renderClassEditor();
    renderToolScreen();
  }));
  const seatRowList = document.querySelector('#classSeatRowList');
  seatRowList.innerHTML = cls.seatRows.length ? cls.seatRows.map(({ name, row }, i) => chip(`${escapeHtml(name)} → rząd ${row}`, 'data-remove-seat-row', i)).join('') : '<span class="text-sm text-muted">Brak reguł.</span>';
  seatRowList.querySelectorAll('[data-remove-seat-row]').forEach((btn) => btn.addEventListener('click', () => {
    const { name, row } = cls.seatRows[Number(btn.dataset.removeSeatRow)];
    updateClass(cls.id, (c) => { c.seatRows = c.seatRows.filter((p) => !(p.name === name && p.row === row)); });
    renderClassEditor();
    renderToolScreen();
  }));
}
document.querySelector('#classSeatApartAdd').addEventListener('click', () => {
  const cls = editingClass();
  if (!cls) return;
  const a = document.querySelector('#classSeatApartA').value;
  const b = document.querySelector('#classSeatApartB').value;
  if (!a || !b || a === b) return;
  updateClass(cls.id, (c) => { if (!c.seatApart.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) c.seatApart.push({ a, b }); });
  renderClassEditor();
  renderToolScreen();
});
document.querySelector('#classSeatRowAdd').addEventListener('click', () => {
  const cls = editingClass();
  if (!cls) return;
  const name = document.querySelector('#classSeatRowName').value;
  const row = Number(document.querySelector('#classSeatRowNo').value);
  if (!name || !row) return;
  updateClass(cls.id, (c) => { if (!c.seatRows.some((p) => p.name === name && p.row === row)) c.seatRows.push({ name, row }); });
  renderClassEditor();
  renderToolScreen();
});
function openClassEditor(id) {
  editingClassId = id;
  renderClassEditor();
  classEditorDialog.showModal();
}
document.querySelector('#classNameInput').addEventListener('change', (e) => {
  const cls = editingClass();
  if (!cls) return;
  const name = e.target.value.trim() || cls.name;
  e.target.value = name;
  updateClass(cls.id, (c) => { c.name = name; });
  renderToolScreen();
});
document.querySelector('#classNamesInput').addEventListener('input', (e) => {
  document.querySelector('#classNameCount').textContent = studentsLabel(parseRoster(e.target.value).length);
});
document.querySelector('#classNamesInput').addEventListener('change', (e) => {
  const cls = editingClass();
  if (!cls) return;
  const names = parseRoster(e.target.value);
  updateClass(cls.id, (c) => {
    c.students = names;
    c.apart = c.apart.filter(({ a, b }) => names.includes(a) && names.includes(b));
    c.seatApart = c.seatApart.filter(({ a, b }) => names.includes(a) && names.includes(b));
    c.seatRows = c.seatRows.filter(({ name }) => names.includes(name));
  });
  renderClassEditor();
  renderToolScreen();
});
document.querySelector('#classApartAdd').addEventListener('click', () => {
  const cls = editingClass();
  if (!cls) return;
  const a = document.querySelector('#classApartA').value;
  const b = document.querySelector('#classApartB').value;
  if (!a || !b || a === b || cls.apart.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) return;
  // objects, not [a, b]: Firestore rejects nested arrays
  updateClass(cls.id, (c) => { if (!c.apart.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) c.apart.push({ a, b }); });
  renderClassEditor();
  renderToolScreen();
});
document.querySelector('#classDeleteBtn').addEventListener('click', () => {
  const cls = editingClass();
  if (!cls || !confirm(`Usunąć klasę „${cls.name}” dla wszystkich nauczycieli?`)) return;
  state.teacherClasses = teacherClasses().filter((c) => c.id !== cls.id);
  deleteClassRemote(cls.id);
  teacherToolsFor().forEach((t) => { if (t.classId === cls.id) t.classId = null; });
  saveTeacherTools();
  classEditorDialog.close();
  renderToolScreen();
});
['#classEditorClose', '#classEditorDone'].forEach((sel) => document.querySelector(sel).addEventListener('click', () => classEditorDialog.close()));

// The draw animations are ported from the Random Seat site. Random person: names flick
// past, each dropping in from above, every flick a little slower than the last (ease-out,
// like a slot machine winding down) until PICK_FLICKER.totalMs has passed; then the real
// name drops in with a bouncy overshoot. Groups: the group cards slide in one by one and
// each name drops into its card with the same bounce. Everything is ~1.3-2 s at most.
// The result is decided and saved before any of it starts, and the whole animation is
// skipped when the "Animacje" setting is off.
const PICK_FLICKER = { tickStart: 45, growth: 1.16, totalMs: 900, landMs: 400 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const animationsOn = () => !document.body.classList.contains('no-animations');
let drawInProgress = false;
function dropInText(el, text, isFinal) {
  el.textContent = text;
  el.classList.remove('name-drop', 'name-drop-final');
  void el.offsetWidth; // force a reflow so the animation restarts on every flick
  el.classList.add(isFinal ? 'name-drop-final' : 'name-drop');
}
function flickerToFinal(el, pool, finalName) {
  return new Promise((resolve) => {
    let elapsed = 0;
    let delay = PICK_FLICKER.tickStart;
    let previous = null;
    const tick = () => {
      if (elapsed + delay >= PICK_FLICKER.totalMs) {
        dropInText(el, finalName, true);
        setTimeout(resolve, PICK_FLICKER.landMs);
        return;
      }
      const others = pool.filter((s) => s !== previous);
      const candidates = others.length ? others : pool;
      previous = candidates[randomInt(candidates.length)];
      dropInText(el, previous, false);
      elapsed += delay;
      delay *= PICK_FLICKER.growth;
      setTimeout(tick, delay);
    };
    tick();
  });
}
// Cards pop in one after another, then each name drops into its card. The gaps shrink
// for big classes / many groups so the whole thing never runs past about 2 s.
function animateGroupCards(list, groups) {
  const mostMembers = Math.max(...groups.map((g) => g.length));
  const seatStagger = Math.min(60, Math.floor(700 / Math.max(1, mostMembers - 1)));
  const tableStagger = Math.max(30, Math.min(260, Math.floor((1480 - (mostMembers - 1) * seatStagger) / Math.max(1, groups.length - 1))));
  list.innerHTML = '';
  let lastDrop = 0;
  groups.forEach((members, gi) => {
    const card = document.createElement('div');
    card.className = 'group-card-pop rounded-2xl border border-line bg-app p-3.5';
    card.innerHTML = `<b class="mb-1.5 block">Grupa ${gi + 1} <span class="font-normal text-muted">(${members.length})</span></b><ul class="grid gap-0.5 text-sm"></ul>`;
    list.appendChild(card);
    const cardDelay = gi * tableStagger;
    setTimeout(() => card.classList.add('group-card-in'), cardDelay);
    members.forEach((name, ni) => {
      const li = document.createElement('li');
      li.className = 'chip-hidden';
      li.textContent = name;
      card.querySelector('ul').appendChild(li);
      const delay = cardDelay + 120 + ni * seatStagger;
      lastDrop = Math.max(lastDrop, delay);
      setTimeout(() => li.classList.add('chip-drop-final'), delay);
    });
  });
  return sleep(lastDrop + 400);
}
function setDrawButton(selector, busy) {
  const button = document.querySelector(selector);
  button.disabled = busy;
  button.classList.toggle('opacity-60', busy);
}

// -- Random person --
// This teacher's own recent draws for the class (people since removed from the class
// are ignored).
const recentPicks = (cls) => pickHistory(cls.id).filter((n) => cls.students.includes(n)).slice(-PICK_COOLDOWN);
function pickerBlocked(cls) {
  const cooldown = Math.min(PICK_COOLDOWN, Math.max(0, cls.students.length - 1));
  return { cooldown, names: cooldown > 0 ? recentPicks(cls).slice(-cooldown) : [] };
}
// "Widok" switch (Prosty / Pełny) of the picker and seating tools, saved per tool.
function applyToolLayout(screenId, tool) {
  const screen = document.querySelector(`#${screenId}`);
  const simple = !!tool.simpleView;
  screen.classList.toggle('layout-simple', simple);
  screen.querySelectorAll('[data-layout]').forEach((b) => setSelected(b, (b.dataset.layout === 'simple') === simple, ['bg-primary', 'text-white'], ['text-muted']));
}
['pickerScreen', 'seatingScreen'].forEach((screenId) => {
  document.querySelectorAll(`#${screenId} [data-layout]`).forEach((b) => b.addEventListener('click', () => {
    const tool = activeClassTool();
    if (!tool) return;
    tool.simpleView = b.dataset.layout === 'simple';
    if (tool.simpleView && screenId === 'seatingScreen') { state.seatEditing = false; state.selectedDesk = null; }
    saveTeacherTools();
    renderToolScreen();
  }));
});
function renderPickerScreen() {
  const tool = activeClassTool();
  if (!tool) { show('teacherTools'); return; }
  const cls = toolClass(tool);
  document.querySelector('#pickerScreenLabel').value = tool.label || '';
  applyToolLayout('pickerScreen', tool);
  document.querySelector('#pickerClassName').textContent = cls ? `Klasa: ${cls.name}` : '';
  renderClassBars();
  document.querySelector('#pickerResult').textContent = state.pickerResult[tool.id] || '—';
  const info = document.querySelector('#pickerInfo');
  const recentEl = document.querySelector('#pickerRecent');
  document.querySelector('#pickerClearRecent').disabled = !cls;
  if (!cls || !cls.students.length) {
    info.textContent = !cls ? (tool.simpleView ? 'Nie wybrano klasy — przełącz na widok „Pełny”, żeby ją wybrać.' : 'Wybierz klasę albo dodaj nową (+).') : 'Ta klasa nie ma jeszcze uczniów — kliknij ✎ i wpisz listę.';
    recentEl.innerHTML = '';
    return;
  }
  const { cooldown } = pickerBlocked(cls);
  info.textContent = `Wylosowana osoba nie wypadnie przez następne ${cooldown} ${cooldown === 1 ? 'losowanie' : cooldown < 5 ? 'losowania' : 'losowań'}.${cls.students.length - 1 < PICK_COOLDOWN ? ' (Przy tak małej klasie blokada jest krótsza.)' : ''}`;
  const recent = recentPicks(cls).reverse();
  recentEl.innerHTML = recent.length ? recent.map((name, i) => {
    const left = cooldown - i;
    return `<span class="rounded-lg bg-app px-2.5 py-1 text-sm font-bold${left > 0 ? '' : ' text-muted line-through'}">${escapeHtml(name)}${left > 0 ? ` <span class="font-normal text-muted">(jeszcze ${left})</span>` : ''}</span>`;
  }).join('') : '<span class="text-sm text-muted">Nikt jeszcze nie został wylosowany.</span>';
}
function openPickerScreen(id) {
  state.activeTool = id;
  const tool = activeClassTool();
  if (tool) linkToolToClass(tool);
  renderPickerScreen();
  show('pickerScreen');
}
async function drawPerson() {
  if (drawInProgress) return;
  const tool = activeClassTool();
  const cls = toolClass(tool);
  if (!cls || !cls.students.length) { renderPickerScreen(); return; }
  const blocked = new Set(pickerBlocked(cls).names);
  const candidates = cls.students.filter((s) => !blocked.has(s));
  const name = candidates[randomInt(candidates.length)];
  setPickHistory(cls.id, [...recentPicks(cls), name].slice(-PICK_COOLDOWN));
  state.pickerResult[tool.id] = name;
  if (animationsOn()) {
    drawInProgress = true;
    setDrawButton('#pickerDraw', true);
    try {
      await flickerToFinal(document.querySelector('#pickerResult'), cls.students, name);
    } finally {
      drawInProgress = false;
      setDrawButton('#pickerDraw', false);
    }
  }
  if (state.activeTool === tool.id) renderPickerScreen();
}
document.querySelector('#pickerDraw').addEventListener('click', drawPerson);
document.querySelector('#pickerScreenLabel').addEventListener('change', (e) => { const t = activeClassTool(); if (t) renameTool(t, e.target.value); });
document.querySelector('#pickerClearRecent').addEventListener('click', () => {
  const cls = toolClass(activeClassTool());
  if (!cls) return;
  setPickHistory(cls.id, []);
  renderPickerScreen();
});

// -- Random groups --
// Randomized backtracking: students are placed one at a time into a random group that
// still has room and holds nobody they must be kept apart from; if that dead-ends it
// backs up, and after a bounded number of tries it gives up (impossible constraints).
function buildGroups(students, k, apart) {
  const conflicts = new Map(students.map((s) => [s, new Set()]));
  apart.forEach(({ a, b }) => { conflicts.get(a)?.add(b); conflicts.get(b)?.add(a); });
  const base = Math.floor(students.length / k);
  const extra = students.length % k;
  const deadline = performance.now() + SOLVER_BUDGET_MS;
  let timedOut = false;
  for (let attempt = 0; attempt < 30 && !timedOut; attempt++) {
    const order = fastShuffled(students).sort((a, b) => conflicts.get(b).size - conflicts.get(a).size);
    const caps = fastShuffled(Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0)));
    const groups = Array.from({ length: k }, () => []);
    let steps = 0;
    const place = (i) => {
      if (i === order.length) return true;
      if ((++steps & 255) === 0 && performance.now() > deadline) timedOut = true;
      if (timedOut || steps > 20000) return false;
      const s = order[i];
      for (const gi of fastShuffled([...groups.keys()])) {
        if (groups[gi].length >= caps[gi] || groups[gi].some((m) => conflicts.get(s).has(m))) continue;
        groups[gi].push(s);
        if (place(i + 1)) return true;
        groups[gi].pop();
      }
      return false;
    };
    if (place(0)) return groups;
  }
  return null;
}
function groupsHtml(groups) {
  return groups.map((g, i) =>
    `<div class="rounded-2xl border border-line bg-app p-3.5"><b class="mb-1.5 block">Grupa ${i + 1} <span class="font-normal text-muted">(${g.length})</span></b><ul class="grid gap-0.5 text-sm">${g.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`
  ).join('');
}
function renderGroupsScreen() {
  const tool = activeClassTool();
  if (!tool) { show('teacherTools'); return; }
  document.querySelector('#groupsScreenLabel').value = tool.label || '';
  renderClassBars();
  document.querySelector('#groupsMode').value = tool.groupMode;
  document.querySelector('#groupsValue').value = tool.groupValue;
  const groups = state.groupsResult[tool.id];
  document.querySelector('#groupsResultList').innerHTML = groups ? groupsHtml(groups) : '';
}
function openGroupsScreen(id) {
  state.activeTool = id;
  const tool = activeClassTool();
  if (tool) linkToolToClass(tool);
  document.querySelector('#groupsError').classList.add('hidden');
  renderGroupsScreen();
  show('groupsScreen');
}
async function drawGroups() {
  if (drawInProgress) return;
  const tool = activeClassTool();
  if (!tool) return;
  const cls = toolClass(tool);
  const error = document.querySelector('#groupsError');
  const fail = (message) => { error.textContent = message; error.classList.remove('hidden'); };
  if (!cls) return fail('Wybierz klasę albo dodaj nową (+).');
  const n = cls.students.length;
  if (n < 2) return fail('Ta klasa ma mniej niż dwie osoby — kliknij ✎ i wpisz listę.');
  const value = Math.min(30, Math.max(1, Number(document.querySelector('#groupsValue').value) || 1));
  tool.groupMode = document.querySelector('#groupsMode').value;
  tool.groupValue = value;
  const k = Math.min(n, tool.groupMode === 'count' ? value : Math.ceil(n / value));
  const groups = buildGroups(cls.students, k, cls.apart);
  if (!groups) {
    state.groupsResult[tool.id] = null;
    saveTeacherTools();
    renderGroupsScreen();
    return fail('Nie da się podzielić klasy z tymi ograniczeniami — usuń część reguł albo zmień liczbę grup.');
  }
  error.classList.add('hidden');
  state.groupsResult[tool.id] = groups;
  saveTeacherTools();
  if (animationsOn()) {
    drawInProgress = true;
    setDrawButton('#groupsDraw', true);
    try {
      await animateGroupCards(document.querySelector('#groupsResultList'), groups);
    } finally {
      drawInProgress = false;
      setDrawButton('#groupsDraw', false);
    }
  }
  if (state.activeTool === tool.id) renderGroupsScreen();
}
document.querySelector('#groupsDraw').addEventListener('click', drawGroups);
document.querySelector('#groupsScreenLabel').addEventListener('change', (e) => { const t = activeClassTool(); if (t) renameTool(t, e.target.value); });
['#groupsMode', '#groupsValue'].forEach((sel) => document.querySelector(sel).addEventListener('change', () => {
  const t = activeClassTool();
  if (!t) return;
  t.groupMode = document.querySelector('#groupsMode').value;
  t.groupValue = Math.min(30, Math.max(1, Number(document.querySelector('#groupsValue').value) || 1));
  saveTeacherTools();
}));

// ---------- Seating plan: random seats on a freely arranged board ----------
// The board is 100 x BOARD_H units (same scale on both axes). Each desk is a rounded
// trapezoid centered at (x, y) in those units, optionally rotated. The classroom layout
// belongs to the tool (tool.desks) — it's the teacher's room — while the class (shared
// with every teacher) supplies the students plus the seating rules: seatApart (pairs who
// must not sit next to each other) and seatRows (person -> row, 1 = nearest the board).
// "Row" and "next to" are derived from where the desks actually are, so any layout works:
// desks whose y is within ROW_TOLERANCE of a row's first desk belong to that row, and two
// desks are neighbors when their centers are at most NEIGHBOR_DIST apart (sides, front,
// back — not diagonals, at the default spacing). The finished plan is saved per class
// (tool.seatPlans[classId] = { deskId: name }).
const BOARD_H = 68;
const DESK_W = 10;
const DESK_H = 9.2;
const DESK_MIN_Y = 11;
const ROW_TOLERANCE = 5;
const NEIGHBOR_DIST = 17;
const SEAT_ROW_MAX = 10;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// A trapezoid with rounded corners: each corner is cut back `radius` along both edges
// and joined with a quadratic curve through the original corner.
function roundedPolygonPath(points, radius) {
  const n = points.length;
  const toward = (from, to, dist) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy);
    return [from[0] + (dx / len) * dist, from[1] + (dy / len) * dist];
  };
  return `${points.map((p, i) => {
    const before = toward(p, points[(i - 1 + n) % n], radius);
    const after = toward(p, points[(i + 1) % n], radius);
    return `${i ? 'L' : 'M'}${before[0].toFixed(2)} ${before[1].toFixed(2)}Q${p[0]} ${p[1]} ${after[0].toFixed(2)} ${after[1].toFixed(2)}`;
  }).join('')}Z`;
}
const DESK_PATH = roundedPolygonPath([[20, 2], [54, 2], [72, 66], [2, 66]], 9);
function defaultDesks() {
  const desks = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) desks.push({ id: crypto.randomUUID(), x: 12.5 + c * 15, y: 15 + r * 11.5, angle: 0 });
  }
  return desks;
}
// Row numbers come from the desks' positions (the default), or — with the "Własne numery"
// switch on (tool.manualRows) — from the number typed into each desk (desk.num, 1-10);
// desks without a number then belong to no row (0) and never match a row rule. Desks that
// share a number are one row, wherever they stand.
function deskRows(desks, manual = false) {
  const rowOf = {};
  if (manual) {
    desks.forEach((d) => { rowOf[d.id] = d.num || 0; });
  } else {
    let row = 0;
    let anchor = null;
    [...desks].sort((a, b) => a.y - b.y).forEach((d) => {
      if (anchor === null || d.y - anchor > ROW_TOLERANCE) { row++; anchor = d.y; }
      rowOf[d.id] = row;
    });
  }
  const rows = new Set(Object.values(rowOf).filter(Boolean));
  return { rowOf, rows, rowCount: rows.size };
}
const deskDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const seatName = (name) => {
  const i = name.indexOf(' ');
  return i < 0 ? name : `${name.slice(0, i)}\n${name.slice(i + 1)}`;
};

// Randomized backtracking, like the group draw: most-constrained people are seated first
// (row rules shrink a person's choice of desks, "not next to" pairs add conflicts), each
// goes to a random free desk in an allowed row with none of their partners on a
// neighboring desk. Returns { deskId: name }, or null if the rules can't all be met.
// Draw modes (settings of the seating tool): 'random' (anything goes), 'minTwo' (no row is
// left with a single person: every used row holds at least 2) and 'front' (desks are tried
// front row first, so the class fills the room from the board backwards).
const SEAT_MODES = [
  { mode: 'random', name: 'Całkowicie losowo', description: 'Każdy może usiąść przy dowolnym stoliku.' },
  { mode: 'minTwo', name: 'Minimum 2 osoby w rzędzie', description: 'Żaden rząd nie zostaje z jedną osobą (rząd jest pusty albo ma co najmniej 2).' },
  { mode: 'front', name: 'Od przodu do tyłu', description: 'Najpierw zapełniane są stoliki z przodu (przy tablicy), potem kolejne rzędy.' },
];
// minTwo: decide up front how many people each row gets (0, or 2..its desks), preferring
// rows the row rules need, then let the usual search seat people within those quotas.
function seatQuotas(rowOf, desks, n, forcedRows) {
  const need = Math.min(2, n);
  const capacity = new Map();
  desks.forEach((d) => capacity.set(rowOf[d.id], (capacity.get(rowOf[d.id]) || 0) + 1));
  const usable = [...capacity.keys()].filter((r) => capacity.get(r) >= need);
  let active = fastShuffled(forcedRows.filter((r, i) => usable.includes(r) && forcedRows.indexOf(r) === i));
  while (active.length * need > n) active.pop();
  let room = active.reduce((sum, r) => sum + capacity.get(r), 0);
  fastShuffled(usable.filter((r) => !active.includes(r))).forEach((r) => {
    if (room < n || (Math.random() < 0.4 && need * (active.length + 1) <= n)) { active.push(r); room += capacity.get(r); }
  });
  if (room < n) return null;
  const quota = new Map(active.map((r) => [r, need]));
  for (let left = n - need * active.length; left > 0; left--) {
    const open = active.filter((r) => quota.get(r) < capacity.get(r));
    const r = open[Math.floor(Math.random() * open.length)];
    quota.set(r, quota.get(r) + 1);
  }
  return quota;
}
function seatStudents(students, desks, seatRows, seatApart, manual = false, mode = 'random') {
  const { rowOf } = deskRows(desks, manual);
  const allowed = new Map();
  seatRows.forEach(({ name, row }) => { allowed.set(name, (allowed.get(name) || new Set()).add(row)); });
  const partners = new Map(students.map((s) => [s, new Set()]));
  seatApart.forEach(({ a, b }) => { partners.get(a)?.add(b); partners.get(b)?.add(a); });
  const near = new Map(desks.map((d) => [d.id, desks.filter((o) => o.id !== d.id && deskDistance(d, o) <= NEIGHBOR_DIST).map((o) => o.id)]));
  const choices = (s) => (allowed.has(s) ? desks.filter((d) => allowed.get(s).has(rowOf[d.id])).length : desks.length);
  const deadline = performance.now() + SOLVER_BUDGET_MS;
  let timedOut = false;
  for (let attempt = 0; attempt < 40 && !timedOut; attempt++) {
    const quota = mode === 'minTwo' ? seatQuotas(rowOf, desks, students.length, seatRows.map((r) => r.row)) : null;
    if (mode === 'minTwo' && !quota) return null;
    const used = new Map();
    const order = fastShuffled(students).sort((a, b) => choices(a) - choices(b) || partners.get(b).size - partners.get(a).size);
    const seatOf = new Map();
    let steps = 0;
    const place = (i) => {
      if (i === order.length) return true;
      if ((++steps & 255) === 0 && performance.now() > deadline) timedOut = true;
      if (timedOut || steps > 20000) return false;
      const s = order[i];
      const tryOrder = mode === 'front' ? fastShuffled(desks).sort((a, b) => (rowOf[a.id] || 99) - (rowOf[b.id] || 99)) : fastShuffled(desks);
      for (const d of tryOrder) {
        if (seatOf.has(d.id)) continue;
        if (allowed.has(s) && !allowed.get(s).has(rowOf[d.id])) continue;
        if (quota && (used.get(rowOf[d.id]) || 0) >= (quota.get(rowOf[d.id]) || 0)) continue;
        if (near.get(d.id).some((id) => partners.get(s).has(seatOf.get(id)))) continue;
        seatOf.set(d.id, s);
        used.set(rowOf[d.id], (used.get(rowOf[d.id]) || 0) + 1);
        if (place(i + 1)) return true;
        used.set(rowOf[d.id], used.get(rowOf[d.id]) - 1);
        seatOf.delete(d.id);
      }
      return false;
    };
    if (place(0)) return Object.fromEntries(seatOf);
  }
  return null;
}

// Saved layouts ("schematy") are shared by every teacher, like classes: they live in the
// store/seatLayouts document as [{ id, name, desks: [{x, y, angle}], createdBy }]. Using
// one copies its desks (with fresh ids) into the tool, so later edits to the tool never
// change the shared schema. Each write is a small transaction on the server's list, so
// two teachers saving at once don't overwrite each other.
const seatLayouts = () => state.seatLayouts;
function writeSeatLayouts(mutator) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(storeDoc('seatLayouts'));
    tx.set(storeDoc('seatLayouts'), { value: mutator(snap.exists() ? (snap.data().value || []) : []) });
  }).catch((err) => console.error('Nie udało się zapisać schematu', err));
}
const canDeleteLayout = (layout) => !!layout && (isAdmin() || normalise(layout.createdBy || '') === normalise(currentUser?.name || ''));

const seatBoardEl = document.querySelector('#seatBoard');
// Names on the desks are sized in cqw (a share of the board's own width), NOT in rem, so
// they stay big and readable whatever "Wielkość tekstu" is set to. Each name gets the
// largest size at which its longest line (first name / surname) still fits the desk.
function seatFontSize(name) {
  const longest = Math.max(...seatName(name).split('\n').map((line) => line.length));
  return Math.round(clamp(8.4 / (Math.max(longest, 1) * 0.58), 1.15, 3.4) * 100) / 100;
}
// Simple view: scale the board so the whole room AND the "Losuj miejsca" button fit on the
// screen at once — the page never has to be scrolled.
function fitSeatBoard() {
  const screen = document.querySelector('#seatingScreen');
  const wrap = seatBoardEl.parentElement;
  if (!screen.classList.contains('layout-simple') || screen.classList.contains('hidden')) { seatBoardEl.style.width = ''; return; }
  const top = wrap.getBoundingClientRect().top + window.scrollY;
  const available = window.innerHeight - top - 14 - 12 - 6; // card padding + page padding + slack
  const width = Math.max(260, Math.min(wrap.clientWidth, available * (100 / BOARD_H)));
  seatBoardEl.style.width = `${Math.floor(width)}px`;
}
window.addEventListener('resize', fitSeatBoard);
const seatTool = () => activeClassTool();
const seatPlanFor = (tool, cls) => (cls && tool.seatPlans?.[cls.id]) || {};
function renderSeatBoard(animate = false) {
  const tool = seatTool();
  if (!tool) return;
  const cls = toolClass(tool);
  const plan = seatPlanFor(tool, cls);
  const { rowOf } = deskRows(tool.desks, tool.manualRows);
  const seated = (d) => (plan[d.id] && cls?.students.includes(plan[d.id]) ? plan[d.id] : null);
  seatBoardEl.innerHTML = '<div class="seat-front">TABLICA</div>' + tool.desks.map((d) => {
    const name = seated(d);
    const selected = state.seatEditing && state.selectedDesk === d.id;
    const label = name ? (animate ? '' : escapeHtml(seatName(name))) : `<span class="seat-row-no">${rowOf[d.id] || ''}</span>`;
    const fontSize = name ? seatFontSize(name) : null;
    return `<div class="seat-desk${name ? ' filled' : ''}${selected ? ' selected' : ''}${state.seatEditing ? ' editable' : ''}" data-desk="${d.id}" style="left:${d.x}%;top:${(d.y / BOARD_H) * 100}%;width:${DESK_W}%;height:${(DESK_H / BOARD_H) * 100}%">
      <svg class="seat-shape" viewBox="0 0 74 68" preserveAspectRatio="none" style="transform:rotate(${d.angle || 0}deg)"><path d="${DESK_PATH}"/></svg>
      <span class="seat-label"${fontSize ? ` style="--seat-fs:${fontSize}cqw"` : ''}><span class="seat-name">${label}</span></span>
      ${state.seatEditing ? '<button type="button" class="seat-remove" data-desk-del title="Usuń stolik" aria-label="Usuń stolik">×</button>' : ''}
    </div>`;
  }).join('');
}
function renderSeatingScreen() {
  const tool = seatTool();
  if (!tool) { show('teacherTools'); return; }
  const cls = toolClass(tool);
  document.querySelector('#seatingScreenLabel').value = tool.label || '';
  applyToolLayout('seatingScreen', tool);
  renderClassBars();
  renderSeatLayoutBar();
  document.querySelector('#seatEditToggle').textContent = state.seatEditing ? 'Gotowe' : 'Edytuj układ';
  document.querySelector('#seatEditBar').classList.toggle('hidden', !state.seatEditing);
  document.querySelector('#seatEditBar').classList.toggle('flex', state.seatEditing);
  document.querySelector('#seatDelAll').disabled = !tool.desks.length;
  ['#seatRotL', '#seatRotR', '#seatDup', '#seatDel'].forEach((sel) => { document.querySelector(sel).disabled = !state.selectedDesk; });
  document.querySelector('#seatClear').disabled = !cls || !Object.keys(seatPlanFor(tool, cls)).length;
  const { rowCount } = deskRows(tool.desks, tool.manualRows);
  const info = [`Stolików: ${tool.desks.length}`, `rzędów: ${rowCount}${tool.manualRows ? ' (własne numery)' : ''}`];
  document.querySelector('#seatManualToggle').checked = !!tool.manualRows;
  renderSeatNumField();
  if (cls) info.push(`uczniów: ${cls.students.length}`);
  if (tool.drawMode && tool.drawMode !== 'random') info.push(`losowanie: ${SEAT_MODES.find((m) => m.mode === tool.drawMode)?.name.toLocaleLowerCase('pl-PL')}`);
  if (cls?.seatApart.length) info.push(`„nie obok”: ${cls.seatApart.length}`);
  if (cls?.seatRows.length) info.push(`reguł rzędów: ${cls.seatRows.length}`);
  document.querySelector('#seatInfo').textContent = cls ? info.join(' · ') : `${info.join(' · ')} — wybierz klasę albo dodaj nową (+).`;
  renderSeatBoard();
  fitSeatBoard();
}
function openSeatingScreen(id) {
  state.activeTool = id;
  state.seatEditing = false;
  state.selectedDesk = null;
  const tool = seatTool();
  if (tool) linkToolToClass(tool);
  document.querySelector('#seatError').classList.add('hidden');
  renderSeatingScreen();
  show('seatingScreen');
  fitSeatBoard(); // the screen is only measurable once it is visible
}

// Each seated desk flickers through a few random names, then the real one drops in with
// the bounce — desks start a little after one another, front rows first.
function animateSeating(tool, plan) {
  const { rowOf } = deskRows(tool.desks, tool.manualRows);
  const filled = tool.desks.filter((d) => plan[d.id]).sort((a, b) => rowOf[a.id] - rowOf[b.id] || a.x - b.x);
  const pool = Object.values(plan);
  const stagger = Math.min(50, Math.floor(1300 / Math.max(1, filled.length - 1)));
  const flickDelays = [45, 52, 60, 70];
  filled.forEach((d, i) => {
    const el = seatBoardEl.querySelector(`[data-desk="${d.id}"] .seat-name`);
    if (!el) return;
    let step = 0;
    const flick = () => {
      if (step >= flickDelays.length) { dropInText(el, seatName(plan[d.id]), true); return; }
      dropInText(el, seatName(pool[randomInt(pool.length)]), false);
      setTimeout(flick, flickDelays[step++]);
    };
    setTimeout(flick, i * stagger);
  });
  return sleep((filled.length - 1) * stagger + flickDelays.reduce((a, b) => a + b, 0) + 400);
}
async function drawSeating() {
  if (drawInProgress) return;
  const tool = seatTool();
  if (!tool) return;
  const cls = toolClass(tool);
  const error = document.querySelector('#seatError');
  const fail = (message) => { error.textContent = message; error.classList.remove('hidden'); fitSeatBoard(); };
  if (!cls) return fail(tool.simpleView ? 'Wybierz klasę z listy.' : 'Wybierz klasę albo dodaj nową (+).');
  const fullHint = tool.simpleView ? ' Przełącz na widok „Pełny”.' : '';
  if (!cls.students.length) return fail(`Ta klasa nie ma jeszcze uczniów — kliknij ✎ i wpisz listę.${fullHint}`);
  if (tool.desks.length < cls.students.length) return fail(`Za mało stolików: ${cls.students.length} uczniów, ${tool.desks.length} stolików — dodaj stoliki w układzie.${fullHint}`);
  const { rows, rowCount } = deskRows(tool.desks, tool.manualRows);
  const missingRow = cls.seatRows.find(({ row }) => !rows.has(row));
  if (missingRow) return fail(`Reguła „${missingRow.name} → rząd ${missingRow.row}” nie pasuje do układu — ${tool.manualRows ? `żaden stolik nie ma numeru ${missingRow.row}` : `liczba rzędów stolików: ${rowCount}`}.`);
  const plan = seatStudents(cls.students, tool.desks, cls.seatRows, cls.seatApart, !!tool.manualRows, tool.drawMode || 'random');
  if (!plan) return fail(`Nie da się rozsadzić klasy z tymi regułami${tool.drawMode === 'minTwo' ? ' i warunkiem „minimum 2 osoby w rzędzie”' : ''} — usuń część reguł „nie obok” lub rzędów, zmień sposób losowania w ⚙ albo zmień układ stolików.`);
  error.classList.add('hidden');
  (tool.seatPlans || (tool.seatPlans = {}))[cls.id] = plan;
  saveTeacherTools();
  if (animationsOn()) {
    drawInProgress = true;
    setDrawButton('#seatDraw', true);
    try {
      renderSeatBoard(true);
      await animateSeating(tool, plan);
    } finally {
      drawInProgress = false;
      setDrawButton('#seatDraw', false);
    }
  }
  if (state.activeTool === tool.id) renderSeatingScreen();
}
document.querySelector('#seatDraw').addEventListener('click', drawSeating);
document.querySelector('#seatingScreenLabel').addEventListener('change', (e) => { const t = seatTool(); if (t) renameTool(t, e.target.value); });
document.querySelector('#seatClear').addEventListener('click', () => {
  const tool = seatTool();
  const cls = toolClass(tool);
  if (!tool || !cls) return;
  delete tool.seatPlans?.[cls.id];
  saveTeacherTools();
  renderSeatingScreen();
});

// -- Layout editing --
const selectedDesk = () => seatTool()?.desks.find((d) => d.id === state.selectedDesk);
function seatLayoutChanged() {
  saveTeacherTools();
  renderSeatingScreen();
}
document.querySelector('#seatEditToggle').addEventListener('click', () => {
  state.seatEditing = !state.seatEditing;
  state.selectedDesk = null;
  renderSeatingScreen();
});
document.querySelector('#seatAddDesk').addEventListener('click', () => {
  const tool = seatTool();
  if (!tool) return;
  const desk = { id: crypto.randomUUID(), x: 50, y: BOARD_H / 2, angle: 0 };
  tool.desks.push(desk);
  state.selectedDesk = desk.id;
  seatLayoutChanged();
});
document.querySelector('#seatAddRow').addEventListener('click', () => {
  const tool = seatTool();
  if (!tool) return;
  const lowest = tool.desks.length ? Math.max(...tool.desks.map((d) => d.y)) : null;
  const y = lowest === null ? 15 : Math.min(lowest + 11.5, BOARD_H - DESK_H / 2);
  const num = tool.manualRows ? Math.min(SEAT_ROW_MAX, Math.max(0, ...tool.desks.map((d) => d.num || 0)) + 1) : undefined;
  for (let c = 0; c < 6; c++) tool.desks.push({ id: crypto.randomUUID(), x: 12.5 + c * 15, y, angle: 0, ...(num ? { num } : {}) });
  seatLayoutChanged();
});
[['#seatRotL', -15], ['#seatRotR', 15]].forEach(([sel, delta]) => document.querySelector(sel).addEventListener('click', () => {
  const desk = selectedDesk();
  if (!desk) return;
  desk.angle = (((desk.angle || 0) + delta) % 360 + 360) % 360;
  seatLayoutChanged();
}));
document.querySelector('#seatDup').addEventListener('click', () => {
  const tool = seatTool();
  const desk = selectedDesk();
  if (!tool || !desk) return;
  const copy = { id: crypto.randomUUID(), x: clamp(desk.x + 4, DESK_W / 2, 100 - DESK_W / 2), y: clamp(desk.y + 4, DESK_MIN_Y, BOARD_H - DESK_H / 2), angle: desk.angle || 0, ...(desk.num ? { num: desk.num } : {}) };
  tool.desks.push(copy);
  state.selectedDesk = copy.id;
  seatLayoutChanged();
});
function removeDesk(id) {
  const tool = seatTool();
  if (!tool) return;
  tool.desks = tool.desks.filter((d) => d.id !== id);
  Object.values(tool.seatPlans || {}).forEach((plan) => { delete plan[id]; });
  if (state.selectedDesk === id) state.selectedDesk = null;
  seatLayoutChanged();
}
document.querySelector('#seatDel').addEventListener('click', () => { if (state.selectedDesk) removeDesk(state.selectedDesk); });
// Two-step confirmation on the button itself (a native confirm() dialog can be blocked by
// the browser): the first click arms it for 4 s, the second one deletes.
let seatDelAllTimer = null;
const disarmSeatDelAll = () => {
  clearTimeout(seatDelAllTimer);
  seatDelAllTimer = null;
  document.querySelector('#seatDelAll').textContent = 'Usuń wszystkie';
};
document.querySelector('#seatDelAll').addEventListener('click', () => {
  const tool = seatTool();
  if (!tool || !tool.desks.length) return;
  if (!seatDelAllTimer) {
    document.querySelector('#seatDelAll').textContent = 'Na pewno?';
    seatDelAllTimer = setTimeout(disarmSeatDelAll, 4000);
    return;
  }
  disarmSeatDelAll();
  tool.desks = [];
  tool.seatPlans = {};
  state.selectedDesk = null;
  seatLayoutChanged();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Delete' || !state.seatEditing || !state.selectedDesk) return;
  if (document.querySelector('#seatingScreen').classList.contains('hidden') || e.target.closest?.('input, textarea, select')) return;
  removeDesk(state.selectedDesk);
});

// -- Row numbering: automatic (from positions) or typed in per desk --
function setSeatManualRows(tool, on) {
  if (on) {
    // Start from the numbers the automatic system currently shows, so nothing jumps.
    const { rowOf } = deskRows(tool.desks, false);
    tool.desks.forEach((d) => { if (!d.num) d.num = Math.min(SEAT_ROW_MAX, rowOf[d.id]); });
  }
  tool.manualRows = on;
}
document.querySelector('#seatManualToggle').addEventListener('change', (e) => {
  const tool = seatTool();
  if (!tool) return;
  setSeatManualRows(tool, e.target.checked);
  seatLayoutChanged();
});
function renderSeatNumField() {
  const tool = seatTool();
  const wrap = document.querySelector('#seatNumWrap');
  const input = document.querySelector('#seatDeskNum');
  const manual = !!tool?.manualRows;
  wrap.classList.toggle('hidden', !manual);
  wrap.classList.toggle('flex', manual);
  const desk = selectedDesk();
  input.disabled = !desk;
  if (document.activeElement !== input) input.value = desk?.num || '';
}
document.querySelector('#seatDeskNum').addEventListener('input', (e) => {
  const desk = selectedDesk();
  if (!desk) return;
  const n = parseInt(e.target.value, 10);
  if (Number.isNaN(n)) delete desk.num;
  else desk.num = clamp(n, 1, SEAT_ROW_MAX);
  saveTeacherTools();
  renderSeatBoard();
  const { rowCount } = deskRows(seatTool().desks, true);
  document.querySelector('#seatInfo').textContent = document.querySelector('#seatInfo').textContent.replace(/rzędów: \d+/, `rzędów: ${rowCount}`);
});
document.querySelector('#seatDeskNum').addEventListener('change', (e) => { e.target.value = selectedDesk()?.num || ''; });

// -- Shared layouts --
function renderSeatLayoutBar() {
  const select = document.querySelector('#seatLayoutSelect');
  const layouts = seatLayouts();
  if (!layouts.some((l) => l.id === state.seatLayoutId)) state.seatLayoutId = layouts[0]?.id || null;
  select.innerHTML = layouts.length
    ? layouts.map((l) => `<option value="${l.id}"${l.id === state.seatLayoutId ? ' selected' : ''}>${escapeHtml(l.name)} (${l.desks.length})${l.createdBy ? ` — ${escapeHtml(l.createdBy)}` : ''}</option>`).join('')
    : '<option value="">Brak zapisanych schematów</option>';
  select.disabled = !layouts.length;
  const chosen = layouts.find((l) => l.id === state.seatLayoutId);
  document.querySelector('#seatLayoutUse').disabled = !chosen;
  const del = document.querySelector('#seatLayoutDelete');
  del.disabled = !canDeleteLayout(chosen);
  del.title = chosen && !canDeleteLayout(chosen) ? 'Schemat może usunąć tylko jego autor lub administrator' : 'Usuń schemat dla wszystkich';
  document.querySelector('#seatLayoutSave').disabled = !seatTool()?.desks.length;
}
document.querySelector('#seatLayoutSelect').addEventListener('change', (e) => { state.seatLayoutId = e.target.value || null; renderSeatLayoutBar(); });
document.querySelector('#seatLayoutUse').addEventListener('click', () => {
  const tool = seatTool();
  const layout = seatLayouts().find((l) => l.id === state.seatLayoutId);
  if (!tool || !layout) return;
  if (!confirm(`Użyć schematu „${layout.name}”? Obecny układ stolików i zapisane plany rozsadzenia w tym narzędziu zostaną zastąpione.`)) return;
  tool.desks = layout.desks.map((d) => ({ id: crypto.randomUUID(), x: d.x, y: d.y, angle: d.angle || 0, ...(d.num ? { num: d.num } : {}) }));
  tool.manualRows = !!layout.manual;
  tool.seatPlans = {};
  state.selectedDesk = null;
  seatLayoutChanged();
});
document.querySelector('#seatLayoutSave').addEventListener('click', async () => {
  const tool = seatTool();
  if (!tool || !tool.desks.length) return;
  const name = (prompt('Nazwa schematu (widoczny dla wszystkich nauczycieli):') || '').trim().slice(0, 40);
  if (!name) return;
  const mine = normalise(currentUser?.name || '');
  const same = seatLayouts().find((l) => normalise(l.name) === normalise(name));
  if (same && normalise(same.createdBy || '') !== mine && !isAdmin()) {
    alert('Schemat o takiej nazwie już istnieje (dodał go ktoś inny) — wybierz inną nazwę.');
    return;
  }
  if (same && !confirm(`Schemat „${same.name}” już istnieje. Zastąpić go obecnym układem?`)) return;
  const layout = {
    id: same?.id || crypto.randomUUID(),
    name,
    createdBy: same?.createdBy || currentUser?.name || '',
    manual: !!tool.manualRows,
    desks: tool.desks.map((d) => ({ x: Math.round(d.x * 100) / 100, y: Math.round(d.y * 100) / 100, angle: d.angle || 0, ...(d.num ? { num: d.num } : {}) })),
  };
  state.seatLayouts = same ? seatLayouts().map((l) => (l.id === layout.id ? layout : l)) : [...seatLayouts(), layout];
  state.seatLayoutId = layout.id;
  renderSeatLayoutBar();
  await writeSeatLayouts((list) => (list.some((l) => l.id === layout.id) ? list.map((l) => (l.id === layout.id ? layout : l)) : [...list, layout]));
});
document.querySelector('#seatLayoutDelete').addEventListener('click', async () => {
  const layout = seatLayouts().find((l) => l.id === state.seatLayoutId);
  if (!canDeleteLayout(layout) || !confirm(`Usunąć schemat „${layout.name}” dla wszystkich nauczycieli?`)) return;
  state.seatLayouts = seatLayouts().filter((l) => l.id !== layout.id);
  renderSeatLayoutBar();
  await writeSeatLayouts((list) => list.filter((l) => l.id !== layout.id));
});
document.querySelector('#seatDefault').addEventListener('click', () => {
  const tool = seatTool();
  if (!tool || !confirm('Przywrócić domyślny układ stolików? Obecny układ i zapisane plany rozsadzenia zostaną zastąpione.')) return;
  tool.desks = defaultDesks();
  tool.manualRows = false;
  tool.seatPlans = {};
  state.selectedDesk = null;
  seatLayoutChanged();
});
// Dragging uses pointer events on the board itself (desks are re-created on every
// render), so it works the same for mouse and touch.
let seatDrag = null;
seatBoardEl.addEventListener('pointerdown', (e) => {
  if (!state.seatEditing) return;
  const removeBtn = e.target.closest('[data-desk-del]');
  if (removeBtn) {
    e.preventDefault();
    removeDesk(removeBtn.closest('[data-desk]').dataset.desk);
    return;
  }
  const el = e.target.closest('[data-desk]');
  const desk = el && seatTool()?.desks.find((d) => d.id === el.dataset.desk);
  if (!desk) return;
  state.selectedDesk = desk.id;
  seatDrag = { desk, el, startX: e.clientX, startY: e.clientY, originX: desk.x, originY: desk.y, moved: false };
  try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events can't be captured */ }
  seatBoardEl.querySelectorAll('.seat-desk.selected').forEach((n) => n.classList.remove('selected'));
  el.classList.add('selected');
  e.preventDefault();
});
seatBoardEl.addEventListener('pointermove', (e) => {
  if (!seatDrag) return;
  const rect = seatBoardEl.getBoundingClientRect();
  const dx = ((e.clientX - seatDrag.startX) / rect.width) * 100;
  const dy = ((e.clientY - seatDrag.startY) / rect.height) * BOARD_H;
  if (Math.abs(dx) + Math.abs(dy) > 0.3) seatDrag.moved = true;
  seatDrag.desk.x = clamp(seatDrag.originX + dx, DESK_W / 2, 100 - DESK_W / 2);
  seatDrag.desk.y = clamp(seatDrag.originY + dy, DESK_MIN_Y, BOARD_H - DESK_H / 2);
  seatDrag.el.style.left = `${seatDrag.desk.x}%`;
  seatDrag.el.style.top = `${(seatDrag.desk.y / BOARD_H) * 100}%`;
});
const endSeatDrag = () => {
  if (!seatDrag) return;
  const { moved } = seatDrag;
  seatDrag = null;
  if (moved) saveTeacherTools();
  renderSeatingScreen();
};
seatBoardEl.addEventListener('pointerup', endSeatDrag);
seatBoardEl.addEventListener('pointercancel', endSeatDrag);

// Shows the remaining time for whichever timer is currently running, right under the
// logo, so it stays visible no matter which screen the teacher is on — not just while
// looking at the timer itself.
function updateHeaderTimerIndicator() {
  const indicator = document.querySelector('#headerTimerIndicator');
  const runningId = Object.keys(state.timerRuntime).find((id) => state.timerRuntime[id].running);
  if (!runningId || !isTeacher()) {
    indicator.classList.add('hidden');
    return;
  }
  const tool = teacherToolsFor().find((t) => t.id === runningId);
  indicator.innerHTML = `${icon('timer')} ${escapeHtml(tool?.label || 'Timer')}: ${formatTimer(state.timerRuntime[runningId].remaining)}`;
  indicator.classList.remove('hidden');
}
setInterval(() => {
  let changed = false;
  Object.values(state.timerRuntime).forEach((runtime) => {
    if (runtime.running && runtime.remaining > 0) {
      runtime.remaining -= 1;
      changed = true;
      if (runtime.remaining === 0) runtime.running = false;
    }
  });
  if (!changed) return;
  updateHeaderTimerIndicator();
  if (!document.querySelector('#timerScreen').classList.contains('hidden')) {
    const runtime = state.timerRuntime[state.activeTimerTool];
    if (runtime) {
      document.querySelector('#timerScreenDisplay').textContent = formatTimer(runtime.remaining);
      document.querySelector('#timerScreenToggle').textContent = runtime.running ? 'Pauza' : 'Start';
    }
  }
}, 1000);

function setupUserInterface() {
  document.querySelector('#homeAdmin')?.remove();
  document.querySelector('#logoutButton')?.remove();
  const graduatedNotice = document.querySelector('#graduatedNotice');
  const showGraduated = currentUser?.role === 'student' && currentUser?.graduated;
  graduatedNotice.classList.toggle('hidden', !showGraduated);
  if (showGraduated) {
    const deleteDate = new Date(new Date(currentUser.graduatedAt).getFullYear(), 9, 1);
    graduatedNotice.innerHTML = `<b class="block">Ukończyłeś/aś 8 klasę ${icon('cap')}</b>Twoje konto zostanie usunięte ${deleteDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
  }
  if (isAdmin()) {
    document.querySelector('#homeGrid').insertAdjacentHTML('beforeend', `<button class="group relative min-h-[220px] overflow-hidden rounded-[25px] p-7 text-left text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl" id="homeAdmin" style="background:linear-gradient(135deg,#0f172a,#475569)" onclick="show('admin')">
      <span aria-hidden="true" class="pointer-events-none absolute -right-[75px] -top-[78px] h-[220px] w-[220px] rounded-full bg-white/20"></span>
      <span class="relative grid h-[52px] w-[52px] place-items-center rounded-2xl bg-white/15 text-2xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg></span>
      <h2 class="relative mt-12 text-[1.55em] font-bold tracking-tight">Panel administratora</h2>
      <p class="relative mt-1.5 text-white/85">Konta i uprawnienia</p>
    </button>`);
    renderAccounts();
    renderPendingTeachers();
    const adminClassSelect = document.querySelector('#adminClassSelect');
    adminClassSelect.innerHTML = classOptionsHtml;
    adminClassSelect.value = currentUser?.classroom || classCodes[0];
    adminClassSelect.addEventListener('change', renderAdminLessonTable);
    document.querySelector('#addAdminLesson').addEventListener('click', () => openLessonEditor(null, adminClassSelect.value, state.adminScheduleDay));
    renderAdminLessonTable();
    renderPendingReplacements();
    state.adminStarterGrade = currentUser?.classroom ? gradeOfClass(currentUser.classroom) : '1';
    renderStarterSubjects();
  }
  document.querySelector('#addReplacement').textContent = isAdmin() ? '+ Dodaj zastępstwo' : '+ Zgłoś zastępstwo';
  document.querySelector('#addAnnouncement').classList.toggle('hidden', !isAdmin());
  document.querySelector('#addSubject').classList.toggle('hidden', isParent());
  document.querySelector('#navCompetences').classList.toggle('hidden', isTeacher());
  document.querySelector('#navTeacherTools').classList.toggle('hidden', !isTeacher());
  state.teacherToolsEditing = false;
  if (isTeacher()) {
    renderTeacherTools();
    migrateAccountClasses().catch((err) => console.error('Nie udało się przenieść klas na wspólną listę', err));
  }
  renderSubjects();
  renderSchedule();
  renderAnnouncements();
  renderDashboard();
  renderNotifications();
  document.querySelector('#settingsPanel').insertAdjacentHTML('beforeend', `<button class="mt-[18px] rounded-[10px] bg-app px-3.5 py-2.5 font-bold text-muted" id="logoutButton">Wyloguj się</button>`);
  document.querySelector('#logoutButton').addEventListener('click', () => logout());
}

async function boot() {
  try {
    await loadStore();
  } catch (err) {
    console.error('Nie udało się połączyć z bazą danych Firestore', err);
    document.querySelector('#cloudLoadingText').textContent = 'Nie udało się połączyć z bazą danych. Sprawdź internet i konfigurację w firebase-config.js, po czym odśwież stronę.';
    return;
  }
  watchStoreLive();
  document.querySelector('#cloudLoading').classList.add('hidden');
  document.querySelector('#loginLayer').classList.remove('hidden');

  if (currentUser) {
    if (accountStillExists(currentUser)) {
      const latest = accounts.find((a) => normalise(a.name) === normalise(currentUser.name));
      if (latest) currentUser = { name: latest.name, classroom: latest.classroom, role: latest.role || 'student', childClasses: latest.childClasses || [], graduated: latest.graduated || false, graduatedAt: latest.graduatedAt || null };
      state.viewingClassroom = accessibleClasses(currentUser)[0];
      document.querySelector('#loginLayer').classList.add('hidden');
      if (latest) applyAccountSettings(latest.settings);
      setupUserInterface();
    } else {
      logout('Twoje konto zostało usunięte przez administratora.');
    }
  }

  renderSubjects();
  renderAnnouncements();
  renderSchedule();
  renderNotifications();
  show('home');
  setInterval(() => { renderSchedule(); renderDashboard(); }, 60000);

  runSchoolYearRollover().catch((err) => console.error('Nie udało się przeprowadzić rocznej promocji klas', err));
}
boot();
