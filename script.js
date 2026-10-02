// Moja Szkoła — app logic
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

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
const normalizeAccounts = (list) => (list || []).map((a) => ({ role: 'student', childClasses: [], pending: false, graduated: false, authUids: [], notifReadIds: [], settings: null, personalLessons: [], adminNote: '', teacherTools: [], lastTimerSeconds: 300, lastRoster: [], ...a }));

const STORE_KEYS = ['subjectsByClass', 'starterSubjectsByGrade', 'lessonsByClass', 'announcements', 'notifications'];
const seedValue = {
  subjectsByClass: normalizeSubjectsByClass(legacySubjectsByClass || { '1A': legacySubjects || defaultSubjects }),
  starterSubjectsByGrade: legacyStarterByGrade || Object.fromEntries(
    gradeNumbers.map((n) => [String(n), JSON.parse(JSON.stringify(legacyStarterSubjects || defaultSubjects))])
  ),
  lessonsByClass: normalizeLessonsByClass(legacyLessonsByClass || { '1A': legacyLessons || defaultLessons }),
  announcements: normalizeAnnouncements(legacyAnnouncements || defaultAnnouncements),
  notifications: [],
};

const state = {
  subjectsByClass: {},
  starterSubjectsByGrade: {},
  lessonsByClass: {},
  announcements: [],
  notifications: [],
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
const navParent = { schedule: 'home', changes: 'home', events: 'home', admin: 'home', detail: 'competences', timerScreen: 'teacherTools', pickerScreen: 'teacherTools', groupsScreen: 'teacherTools' };
function show(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.id !== id));
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.show = show;
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => show(b.dataset.open)));
document.querySelector('[data-open="events"]').addEventListener('click', () => { state.forceReplacement = false; });

// ---------- Subject / competence cards ----------
const statusInfo = {
  locked: { label: 'Nieodblokowane', color: 'linear-gradient(135deg,#facc15,#f59e0b)' },
  unlocked: { label: '⚠ Zdobądź mnie!', color: 'linear-gradient(135deg,#f97316,#ef4444)' },
  known: { label: 'Umiem', color: 'linear-gradient(135deg,#2563eb,#06b6d4)' },
  earned_basic: { label: 'Zdobyta — poziom podstawowy 👍', color: 'linear-gradient(135deg,#16a34a,#22c55e)' },
  earned_advanced: { label: 'Zdobyta — poziom zaawansowany 🏆', color: 'linear-gradient(135deg,#065f46,#10b981)' },
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
    ${canChangeColor ? `<button class="absolute right-3 top-3 z-10 rounded-lg bg-black/30 px-2 py-1 text-sm font-bold opacity-0 transition group-hover:opacity-100" title="Zmień kolor" data-change-color="${item.id}">🎨</button>` : ''}
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
      <div class="px-4 py-3"><b class="block">${escapeHtml(x.name)}</b><span class="text-[.9em] text-muted">sala ${escapeHtml(x.room || '—')} · ${escapeHtml(x.teacher)}</span>${replacement ? `<span class="mt-1 inline-block rounded-lg bg-amber-100 px-2 py-1 text-[.78em] font-extrabold text-amber-800">Zastępstwo za: ${escapeHtml(replacementName)}</span>` : ''}${x.personal ? `<span class="mt-1 inline-block rounded-lg bg-indigo-100 px-2 py-1 text-[.78em] font-extrabold text-indigo-800">🔒 Tylko dla Ciebie</span>` : ''}</div>
      ${editable ? `<div class="mr-3 flex gap-1"><button class="rounded-lg bg-app px-2 py-2 font-extrabold text-primary" data-edit-lesson="${x.id}" data-personal="${x.personal ? '1' : ''}" aria-label="Edytuj lekcję">✎</button><button class="rounded-lg bg-app px-2 py-2 font-extrabold text-red-600" data-delete-own-lesson="${x.id}" data-personal="${x.personal ? '1' : ''}" aria-label="Usuń lekcję">🗑</button></div>` : ''}
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
        <button class="rounded-lg bg-white/70 px-2 py-1 text-sm font-bold" title="Edytuj" data-edit-announcement="${x.id}">✎</button>
        <button class="rounded-lg bg-white/70 px-2 py-1 text-sm font-bold" title="Usuń" data-delete-announcement="${x.id}">🗑</button>
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
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-amber-800" data-edit-announcement="${x.id}" aria-label="Edytuj zastępstwo">✎</button>
          <button class="rounded-lg bg-white/70 px-2 py-1.5 font-bold text-red-700" data-delete-replacement="${x.id}" aria-label="Usuń zastępstwo">🗑</button>
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

function applyAnimations(enabled) {
  document.body.classList.toggle('no-animations', !enabled);
  document.querySelectorAll('[data-animations]').forEach((x) => setSelected(x, x.dataset.animations === (enabled ? 'on' : 'off'), ['bg-primary', 'text-white', 'border-primary'], ['bg-app', 'text-muted', 'border-line']));
}
applyAnimations(localStorage.getItem('schoolAnimations') !== 'off');
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
  applyFontSize(settings.fontSize || 16);
  applyBg(settings.bg || '#f5f7ff');
  applyMode(settings.mode || 'auto');
  applyPattern(settings.pattern || 'none');
  applyAnimations(settings.animations !== false);
  applyRadius(settings.radius || 'large');
  applyAccent(settings.accent || '#4f46e5');
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
  state.pickerResult = {};
  state.groupsResult = {};
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
          ${a.adminNote ? `<span class="mt-1 block max-w-[320px] text-[.85em] italic text-amber-700">📝 ${escapeHtml(a.adminNote)}</span>` : ''}
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
  { type: 'timer', icon: '⏱', name: 'Timer', description: 'Odliczanie czasu na pełnym ekranie' },
  { type: 'picker', icon: '🎲', name: 'Losowanie osoby', description: 'Losuje ucznia z klasy; wylosowany nie wypadnie przez następne 5 losowań' },
  { type: 'groups', icon: '👥', name: 'Losowanie grup', description: 'Dzieli klasę na grupy, z możliwością rozdzielenia wybranych osób' },
];
const toolTypeInfo = (type) => toolTypes.find((t) => t.type === type) || toolTypes[0];
const toolPickerDialog = document.querySelector('#toolPicker');
function renderToolPickerList() {
  const query = document.querySelector('#toolSearch').value.trim().toLocaleLowerCase('pl-PL');
  const matches = toolTypes.filter((t) => `${t.name} ${t.description}`.toLocaleLowerCase('pl-PL').includes(query));
  const list = document.querySelector('#toolPickerList');
  list.innerHTML = matches.length ? matches.map((t) =>
    `<button type="button" class="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left shadow-[0_4px_15px_var(--shadow)] transition hover:border-primary" data-pick-tool="${t.type}">
      <span class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-app text-2xl">${t.icon}</span>
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
  if (type === 'picker' || type === 'groups') tool.students = [...(account?.lastRoster || [])];
  if (type === 'picker') tool.recent = [];
  if (type === 'groups') Object.assign(tool, { apart: [], groupMode: 'count', groupValue: 2 });
  teacherToolsFor().push(tool);
  saveTeacherTools();
  renderTeacherTools();
}
function ensureTimerRuntime(tool) {
  return state.timerRuntime[tool.id] || (state.timerRuntime[tool.id] = { remaining: tool.duration, running: false });
}
// A tile is just an entry point — clicking it opens that tool's own full-screen view
// (the timer tile never shows the countdown itself).
function toolTileHtml(tool, editing) {
  const info = toolTypeInfo(tool.type);
  return `<button type="button" class="relative min-h-[140px] rounded-[20px] border border-line bg-card p-5 text-left shadow-[0_7px_22px_var(--shadow)] transition hover:-translate-y-1 hover:shadow-lg" data-open-tool="${tool.id}">
    ${editing ? `<span class="absolute right-3 top-3 z-10 rounded-lg bg-app px-2 py-1 text-sm font-bold text-red-600" data-delete-tool="${tool.id}" aria-label="Usuń narzędzie">🗑</span>` : ''}
    <span class="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-app text-xl">${info.icon}</span>
    <b class="block truncate">${escapeHtml(tool.label || info.name)}</b>
    <span class="text-[.85em] text-muted">${info.name}</span>
  </button>`;
}
function openTool(id) {
  const tool = teacherToolsFor().find((t) => t.id === id);
  if (!tool) return;
  if (tool.type === 'picker') openPickerScreen(id);
  else if (tool.type === 'groups') openGroupsScreen(id);
  else openTimerScreen(id);
}
function bindTeacherToolsEvents(el) {
  document.querySelector('#addTeacherTool')?.addEventListener('click', openToolPicker);
  el.querySelectorAll('[data-delete-tool]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm('Usunąć to narzędzie?')) return;
      const account = currentAccount();
      account.teacherTools = teacherToolsFor().filter((t) => t.id !== b.dataset.deleteTool);
      delete state.timerRuntime[b.dataset.deleteTool];
      delete state.pickerResult[b.dataset.deleteTool];
      delete state.groupsResult[b.dataset.deleteTool];
      saveTeacherTools();
      renderTeacherTools();
      updateHeaderTimerIndicator();
    });
  });
  el.querySelectorAll('[data-open-tool]').forEach((b) => b.addEventListener('click', () => openTool(b.dataset.openTool)));
}
function renderTeacherTools() {
  if (!isTeacher()) return;
  const tools = teacherToolsFor();
  const editing = state.teacherToolsEditing;
  document.querySelector('#editTeacherTools').textContent = editing ? 'Gotowe' : 'Edytuj';
  const addTileHtml = editing ? `<button type="button" class="grid min-h-[140px] place-items-center rounded-[20px] border-2 border-dashed border-line text-4xl font-bold text-muted" id="addTeacherTool" aria-label="Dodaj narzędzie">+</button>` : '';
  const el = document.querySelector('#teacherToolsGrid');
  el.innerHTML = !tools.length && !editing
    ? emptyState('Brak narzędzi', 'Kliknij „Edytuj”, aby dodać pierwsze narzędzie.')
    : tools.map((tool) => toolTileHtml(tool, editing)).join('') + addTileHtml;
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

// ---------- Class tools: random person / random groups ----------
// Both keep their class list (tool.students) on the tool itself, so it's saved with the
// teacher's account like the rest of Teacher Tools. The most recently typed list is also
// remembered (account.lastRoster) so a new tool starts with it instead of an empty box.
const PICK_COOLDOWN = 5;
function parseRoster(text) {
  const seen = new Set();
  return text.split(/[\n,;]+/).map((s) => s.trim()).filter((s) => {
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
const activeClassTool = () => teacherToolsFor().find((t) => t.id === state.activeTool);
function saveRoster(tool, text) {
  const names = parseRoster(text);
  tool.students = names;
  if (tool.apart) tool.apart = tool.apart.filter(({ a, b }) => names.includes(a) && names.includes(b));
  const account = currentAccount();
  if (account) account.lastRoster = names;
  saveTeacherTools();
}
function renameTool(tool, value) {
  tool.label = value.trim();
  saveTeacherTools();
}

// -- Random person --
function pickerBlocked(tool) {
  const cooldown = Math.min(PICK_COOLDOWN, Math.max(0, tool.students.length - 1));
  return { cooldown, names: cooldown > 0 ? (tool.recent || []).slice(-cooldown) : [] };
}
function renderPickerScreen() {
  const tool = activeClassTool();
  if (!tool) { show('teacherTools'); return; }
  document.querySelector('#pickerScreenLabel').value = tool.label || '';
  document.querySelector('#pickerRoster').value = tool.students.join('\n');
  document.querySelector('#pickerRosterCount').textContent = `Uczniów: ${tool.students.length}`;
  document.querySelector('#pickerResult').textContent = state.pickerResult[tool.id] || '—';
  const { cooldown } = pickerBlocked(tool);
  document.querySelector('#pickerInfo').textContent = tool.students.length
    ? `Wylosowana osoba nie wypadnie przez następne ${cooldown} ${cooldown === 1 ? 'losowanie' : cooldown < 5 ? 'losowania' : 'losowań'}.${tool.students.length - 1 < PICK_COOLDOWN ? ' (Przy tak małej klasie blokada jest krótsza.)' : ''}`
    : 'Najpierw wpisz listę klasy.';
  const recent = (tool.recent || []).slice(-PICK_COOLDOWN).reverse();
  document.querySelector('#pickerRecent').innerHTML = recent.length ? recent.map((name, i) => {
    const left = cooldown - i;
    return `<span class="rounded-lg bg-app px-2.5 py-1 text-sm font-bold${left > 0 ? '' : ' text-muted line-through'}">${escapeHtml(name)}${left > 0 ? ` <span class="font-normal text-muted">(jeszcze ${left})</span>` : ''}</span>`;
  }).join('') : '<span class="text-sm text-muted">Nikt jeszcze nie został wylosowany.</span>';
}
function openPickerScreen(id) {
  state.activeTool = id;
  renderPickerScreen();
  show('pickerScreen');
}
// The draw animation: the result drops in from above DRAW_FALLS times in a row. The first
// four are decoys (random names / random groupings) and the last one is the real result,
// which is decided and saved before the animation starts. Skipped entirely when the
// "Animacje" setting is off.
const DRAW_FALLS = 5;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const animationsOn = () => !document.body.classList.contains('no-animations');
let drawInProgress = false;
function playDrop(el) {
  el.classList.remove('drop-in');
  void el.offsetWidth;
  el.classList.add('drop-in');
}
function setDrawButton(selector, busy) {
  const button = document.querySelector(selector);
  button.disabled = busy;
  button.classList.toggle('opacity-60', busy);
}
async function drawPerson() {
  if (drawInProgress) return;
  const tool = activeClassTool();
  if (!tool) return;
  saveRoster(tool, document.querySelector('#pickerRoster').value);
  if (!tool.students.length) { renderPickerScreen(); return; }
  const blocked = new Set(pickerBlocked(tool).names);
  const candidates = tool.students.filter((s) => !blocked.has(s));
  const name = candidates[randomInt(candidates.length)];
  tool.recent = [...(tool.recent || []), name].slice(-PICK_COOLDOWN);
  state.pickerResult[tool.id] = name;
  saveTeacherTools();
  if (animationsOn()) {
    drawInProgress = true;
    setDrawButton('#pickerDraw', true);
    try {
      const resultEl = document.querySelector('#pickerResult');
      const decoys = tool.students.filter((s) => s !== name);
      let previous = null;
      for (let i = 0; i < DRAW_FALLS; i++) {
        let shown = name;
        if (i < DRAW_FALLS - 1) {
          const options = (decoys.length ? decoys : tool.students).filter((s) => s !== previous);
          const pool = options.length ? options : tool.students;
          shown = pool[randomInt(pool.length)];
        }
        previous = shown;
        resultEl.textContent = shown;
        playDrop(resultEl);
        await sleep(650);
      }
    } finally {
      drawInProgress = false;
      setDrawButton('#pickerDraw', false);
    }
  }
  if (state.activeTool === tool.id) renderPickerScreen();
}
document.querySelector('#pickerDraw').addEventListener('click', drawPerson);
document.querySelector('#pickerScreenLabel').addEventListener('change', (e) => { const t = activeClassTool(); if (t) renameTool(t, e.target.value); });
document.querySelector('#pickerRoster').addEventListener('change', (e) => { const t = activeClassTool(); if (t) { saveRoster(t, e.target.value); renderPickerScreen(); } });
document.querySelector('#pickerClearRecent').addEventListener('click', () => {
  const t = activeClassTool();
  if (!t) return;
  t.recent = [];
  saveTeacherTools();
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
  for (let attempt = 0; attempt < 30; attempt++) {
    const order = shuffled(students).sort((a, b) => conflicts.get(b).size - conflicts.get(a).size);
    const caps = shuffled(Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0)));
    const groups = Array.from({ length: k }, () => []);
    let steps = 0;
    const place = (i) => {
      if (i === order.length) return true;
      if (++steps > 20000) return false;
      const s = order[i];
      for (const gi of shuffled([...groups.keys()])) {
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
function renderGroupsScreen() {
  const tool = activeClassTool();
  if (!tool) { show('teacherTools'); return; }
  document.querySelector('#groupsScreenLabel').value = tool.label || '';
  document.querySelector('#groupsRoster').value = tool.students.join('\n');
  document.querySelector('#groupsRosterCount').textContent = `Uczniów: ${tool.students.length}`;
  document.querySelector('#groupsMode').value = tool.groupMode;
  document.querySelector('#groupsValue').value = tool.groupValue;
  const options = tool.students.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  document.querySelector('#apartA').innerHTML = options;
  document.querySelector('#apartB').innerHTML = options;
  if (tool.students.length > 1) document.querySelector('#apartB').selectedIndex = 1;
  const apartList = document.querySelector('#apartList');
  apartList.innerHTML = tool.apart.length ? tool.apart.map(({ a, b }, i) =>
    `<span class="inline-flex items-center gap-1.5 rounded-lg bg-app px-2.5 py-1 text-sm font-bold">${escapeHtml(a)} ✕ ${escapeHtml(b)}<button class="font-bold text-red-600" data-remove-apart="${i}" aria-label="Usuń regułę">×</button></span>`
  ).join('') : '<span class="text-sm text-muted">Brak ograniczeń.</span>';
  apartList.querySelectorAll('[data-remove-apart]').forEach((b) => b.addEventListener('click', () => {
    tool.apart.splice(Number(b.dataset.removeApart), 1);
    saveTeacherTools();
    renderGroupsScreen();
  }));
  const groups = state.groupsResult[tool.id];
  document.querySelector('#groupsResultList').innerHTML = groups ? groupsHtml(groups, false) : '';
}
function groupsHtml(groups, animate) {
  return groups.map((g, i) =>
    `<div class="rounded-2xl border border-line bg-app p-3.5${animate ? ' drop-in' : ''}"${animate ? ` style="animation-delay:${Math.min(i, 6) * 70}ms"` : ''}><b class="mb-1.5 block">Grupa ${i + 1} <span class="font-normal text-muted">(${g.length})</span></b><ul class="grid gap-0.5 text-sm">${g.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>`
  ).join('');
}
function openGroupsScreen(id) {
  state.activeTool = id;
  document.querySelector('#groupsError').classList.add('hidden');
  renderGroupsScreen();
  show('groupsScreen');
}
async function drawGroups() {
  if (drawInProgress) return;
  const tool = activeClassTool();
  if (!tool) return;
  saveRoster(tool, document.querySelector('#groupsRoster').value);
  const error = document.querySelector('#groupsError');
  const n = tool.students.length;
  if (n < 2) {
    error.textContent = 'Wpisz co najmniej dwie osoby.';
    error.classList.remove('hidden');
    return;
  }
  const value = Math.min(30, Math.max(1, Number(document.querySelector('#groupsValue').value) || 1));
  tool.groupMode = document.querySelector('#groupsMode').value;
  tool.groupValue = value;
  const k = Math.min(n, tool.groupMode === 'count' ? value : Math.ceil(n / value));
  const groups = buildGroups(tool.students, k, tool.apart);
  if (!groups) {
    error.textContent = 'Nie da się podzielić klasy z tymi ograniczeniami — usuń część reguł „nie mogą być razem” albo zmień liczbę grup.';
    error.classList.remove('hidden');
    state.groupsResult[tool.id] = null;
  } else {
    error.classList.add('hidden');
    state.groupsResult[tool.id] = groups;
  }
  saveTeacherTools();
  if (groups && animationsOn()) {
    drawInProgress = true;
    setDrawButton('#groupsDraw', true);
    try {
      const list = document.querySelector('#groupsResultList');
      for (let i = 0; i < DRAW_FALLS; i++) {
        const frame = i < DRAW_FALLS - 1 ? (buildGroups(tool.students, k, tool.apart) || groups) : groups;
        list.innerHTML = groupsHtml(frame, true);
        await sleep(900);
      }
    } finally {
      drawInProgress = false;
      setDrawButton('#groupsDraw', false);
    }
  }
  if (state.activeTool === tool.id) renderGroupsScreen();
}
document.querySelector('#groupsDraw').addEventListener('click', drawGroups);
document.querySelector('#groupsScreenLabel').addEventListener('change', (e) => { const t = activeClassTool(); if (t) renameTool(t, e.target.value); });
document.querySelector('#groupsRoster').addEventListener('change', (e) => { const t = activeClassTool(); if (t) { saveRoster(t, e.target.value); renderGroupsScreen(); } });
['#groupsMode', '#groupsValue'].forEach((sel) => document.querySelector(sel).addEventListener('change', () => {
  const t = activeClassTool();
  if (!t) return;
  t.groupMode = document.querySelector('#groupsMode').value;
  t.groupValue = Math.min(30, Math.max(1, Number(document.querySelector('#groupsValue').value) || 1));
  saveTeacherTools();
}));
document.querySelector('#apartAdd').addEventListener('click', () => {
  const t = activeClassTool();
  if (!t) return;
  const a = document.querySelector('#apartA').value;
  const b = document.querySelector('#apartB').value;
  if (!a || !b || a === b || t.apart.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) return;
  t.apart.push({ a, b }); // objects, not [a, b]: Firestore rejects nested arrays
  saveTeacherTools();
  renderGroupsScreen();
});

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
  indicator.textContent = `⏱ ${tool?.label || 'Timer'}: ${formatTimer(state.timerRuntime[runningId].remaining)}`;
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
    graduatedNotice.innerHTML = `<b class="block">Ukończyłeś/aś 8 klasę 🎓</b>Twoje konto zostanie usunięte ${deleteDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
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
  if (isTeacher()) renderTeacherTools();
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
