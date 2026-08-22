// Moja Szkoła — app logic
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

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
const normalizeAccounts = (list) => (list || []).map((a) => ({ role: 'student', childClasses: [], pending: false, ...a }));

const STORE_KEYS = ['subjectsByClass', 'starterSubjectsByGrade', 'lessonsByClass', 'announcements'];
const seedValue = {
  subjectsByClass: normalizeSubjectsByClass(legacySubjectsByClass || { '1A': legacySubjects || defaultSubjects }),
  starterSubjectsByGrade: legacyStarterByGrade || Object.fromEntries(
    gradeNumbers.map((n) => [String(n), JSON.parse(JSON.stringify(legacyStarterSubjects || defaultSubjects))])
  ),
  lessonsByClass: normalizeLessonsByClass(legacyLessonsByClass || { '1A': legacyLessons || defaultLessons }),
  announcements: normalizeAnnouncements(legacyAnnouncements || defaultAnnouncements),
};

const state = {
  subjectsByClass: {},
  starterSubjectsByGrade: {},
  lessonsByClass: {},
  announcements: [],
  activeSubject: null,
  activeTemplateSubject: null,
  mode: 'subject',
  subjectTarget: 'class',
  adminStarterGrade: '1',
  editAnnouncement: null,
  editLesson: null,
  lessonTargetClass: null,
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
const classLessons = (cls) => state.lessonsByClass[cls] || (state.lessonsByClass[cls] = []);

function applyStoreValue(key, value) {
  if (key === 'subjectsByClass') state.subjectsByClass = normalizeSubjectsByClass(value);
  else if (key === 'starterSubjectsByGrade') state.starterSubjectsByGrade = value || {};
  else if (key === 'lessonsByClass') state.lessonsByClass = normalizeLessonsByClass(value);
  else if (key === 'announcements') state.announcements = normalizeAnnouncements(value);
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
  } else if (key === 'announcements') {
    renderAnnouncements();
    renderPendingReplacements();
    renderSchedule();
  }
}

async function loadAccounts() {
  const snap = await getDocs(accountsCollection);
  if (!snap.empty) {
    accounts = normalizeAccounts(snap.docs.map((d) => d.data()));
    return;
  }
  // One-time migration from the old single-array "store/accounts" doc (or pre-Firestore
  // localStorage data) into one document per account, the very first time this runs.
  const legacyDoc = await getDoc(storeDoc('accounts'));
  const migrated = normalizeAccounts(legacyDoc.exists() ? legacyDoc.data().value : legacyAccounts);
  await Promise.all(migrated.map((a) => setDoc(accountDocRef(a.name), a)));
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
    renderAccounts();
    renderPendingTeachers();
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
const navParent = { schedule: 'home', changes: 'home', events: 'home', admin: 'home', detail: 'competences' };
function show(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.id !== id));
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
  locked: { label: 'Nieodblokowane', color: 'linear-gradient(135deg,#64748b,#475569)' },
  unlocked: { label: '⚠ Zdobądź mnie!', color: 'linear-gradient(135deg,#f97316,#ef4444)' },
  known: { label: 'Umiem', color: 'linear-gradient(135deg,#2563eb,#06b6d4)' },
  earned: { label: 'Zdobyta 👍', color: 'linear-gradient(135deg,#16a34a,#22c55e)' },
};

function card(item, type) {
  const status = statusInfo[item.status || 'locked'];
  const background = type === 'competence' ? status.color : item.gradient;
  const earned = type === 'subject' ? item.competences.filter((c) => c.status === 'earned').length : 0;
  const body = type === 'subject'
    ? `Zdobyte: ${earned}/${item.competences.length}`
    : `<span class="mt-2 inline-block rounded-lg bg-white/25 px-2 py-1 text-[.78em] font-extrabold text-white">${status.label}</span>`;
  const canDelete = isAdmin() || item.addedBy !== 'admin';
  return `<article class="group relative min-h-[172px] cursor-pointer overflow-hidden rounded-[25px] p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl" style="background:${background}" data-id="${item.id}" data-type="${type}" tabindex="0" role="button">
    <span aria-hidden="true" class="pointer-events-none absolute -right-[75px] -top-[78px] h-[220px] w-[220px] rounded-full bg-white/20"></span>
    ${canDelete ? `<button class="absolute right-3 top-3 z-10 rounded-lg bg-black/30 px-2 py-1 text-sm font-bold opacity-0 transition group-hover:opacity-100" title="Usuń" data-delete="${item.id}" data-type="${type}">Usuń</button>` : ''}
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
  const canAddCompetence = isAdmin() || subject.addedBy !== 'admin';
  document.querySelector('#addCompetence').classList.toggle('hidden', !canAddCompetence);
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
      } else {
        openStatusEditor(b.dataset.id);
      }
    };
    b.addEventListener('click', open);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

// ---------- Competence status dialog ----------
const statusDialog = document.querySelector('#statusEditor');
let activeCompetence = null;
function openStatusEditor(id) {
  activeCompetence = subjectsForClass(viewingClass()).find((x) => x.id === state.activeSubject).competences.find((x) => x.id === id);
  document.querySelector('#statusTitle').textContent = activeCompetence.name;
  document.querySelector('#statusSelect').value = activeCompetence.status || 'locked';
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

// ---------- Subject / competence / announcement editor dialog ----------
const dialog = document.querySelector('#editor');

function renderPicker() {
  document.querySelector('#gradientPicker').innerHTML = gradients.map((g, i) =>
    `<button type="button" class="h-8 w-[43px] rounded-lg${g === state.chosenGradient ? ' ring-2 ring-ink' : ''}" style="background:${g}" data-gradient="${i}" aria-label="Gradient ${i + 1}"></button>`
  ).join('');
  document.querySelectorAll('[data-gradient]').forEach((b) => b.addEventListener('click', () => {
    state.chosenGradient = gradients[b.dataset.gradient];
    renderPicker();
  }));
}

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
    }
    saveAnnouncements();
    renderAnnouncements();
    renderSchedule();
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

function renderLessonColors() {
  document.querySelector('#lessonColorPicker').innerHTML = lessonColors.map((c) =>
    `<button type="button" class="h-8 w-[43px] rounded-lg${c === state.lessonColor ? ' ring-2 ring-ink' : ''}" style="background:${c}" data-lesson-color="${c}"></button>`
  ).join('');
  document.querySelectorAll('[data-lesson-color]').forEach((b) => b.addEventListener('click', () => {
    state.lessonColor = b.dataset.lessonColor;
    renderLessonColors();
  }));
}

function openLessonEditor(id = null, cls = viewingClass(), day = state.scheduleDay) {
  state.editLesson = id;
  state.lessonTargetClass = cls;
  const item = id ? classLessons(cls).find((x) => x.id === id) : null;
  document.querySelector('#lessonModalTitle').textContent = item ? 'Edytuj lekcję' : 'Dodaj lekcję';
  document.querySelector('#lessonName').value = item?.name || '';
  document.querySelector('#lessonDay').innerHTML = weekdayOptionsHtml;
  document.querySelector('#lessonDay').value = item?.day || day;
  document.querySelector('#lessonTeacher').value = item?.teacher || '';
  document.querySelector('#lessonRoom').value = item?.room || '';
  document.querySelector('#lessonStart').value = item?.start || '08:00';
  document.querySelector('#lessonEnd').value = item?.end || '08:45';
  state.lessonColor = item?.color || lessonColors[0];
  renderLessonColors();
  lessonDialog.showModal();
  setTimeout(() => document.querySelector('#lessonName').focus(), 50);
}
document.querySelector('#addLesson').addEventListener('click', () => openLessonEditor());
document.querySelector('#cancelLesson').addEventListener('click', () => lessonDialog.close('cancel'));

lessonDialog.addEventListener('close', () => {
  if (lessonDialog.returnValue !== 'save') return;
  const name = document.querySelector('#lessonName').value.trim();
  const day = document.querySelector('#lessonDay').value;
  const teacher = document.querySelector('#lessonTeacher').value.trim();
  const room = document.querySelector('#lessonRoom').value.trim();
  const start = document.querySelector('#lessonStart').value;
  const end = document.querySelector('#lessonEnd').value;
  if (!name || !day || !teacher || !start || !end || start >= end) return;
  const lessons = classLessons(state.lessonTargetClass);
  if (state.editLesson) {
    Object.assign(lessons.find((x) => x.id === state.editLesson), { name, day, teacher, room, start, end, color: state.lessonColor });
  } else {
    lessons.push({ id: crypto.randomUUID(), name, day, teacher, room, start, end, color: state.lessonColor, addedBy: isAdmin() ? 'admin' : 'student' });
  }
  saveLessonsByClass();
  if (state.lessonTargetClass === viewingClass()) renderSchedule();
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
  const lessons = classLessons(viewingClass()).filter((x) => x.day === state.scheduleDay).sort((a, b) => a.start.localeCompare(b.start));
  el.innerHTML = lessons.length ? lessons.map((x) => {
    const replacement = state.announcements.find((a) => a.lessonId === x.id && !a.pending);
    const replacementName = replacement?.title.replace(/^Zastępstwo:\s*/i, '');
    const isNow = isToday && current >= minutes(x.start) && current <= minutes(x.end);
    const editable = x.addedBy === 'student';
    return `<div class="relative grid grid-cols-[65px_1fr_auto] items-center overflow-hidden rounded-2xl border border-line${isNow ? ' outline outline-[3px] outline-offset-2 outline-amber-400' : ''}">
      ${isNow ? `<span class="absolute inset-x-0 top-0 z-10 border-t-[3px] border-amber-400 bg-amber-100 py-[3px] pr-2 text-right text-[9px] font-black tracking-widest text-amber-800">TERAZ</span>` : ''}
      <div class="grid h-full place-items-center py-4 text-center text-[.9em] font-extrabold text-white" style="background:${x.color}">${x.start}<br><small>${x.end}</small></div>
      <div class="px-4 py-3"><b class="block">${escapeHtml(x.name)}</b><span class="text-[.9em] text-muted">sala ${escapeHtml(x.room || '—')} · ${escapeHtml(x.teacher)}</span>${replacement ? `<span class="mt-1 inline-block rounded-lg bg-amber-100 px-2 py-1 text-[.78em] font-extrabold text-amber-800">Zastępstwo za: ${escapeHtml(replacementName)}</span>` : ''}</div>
      ${editable ? `<div class="mr-3 flex gap-1"><button class="rounded-lg bg-app px-2 py-2 font-extrabold text-primary" data-edit-lesson="${x.id}" aria-label="Edytuj lekcję">✎</button><button class="rounded-lg bg-app px-2 py-2 font-extrabold text-red-600" data-delete-own-lesson="${x.id}" aria-label="Usuń lekcję">🗑</button></div>` : ''}
    </div>`;
  }).join('') : emptyState('Brak lekcji', `Dodaj pierwszą lekcję na ${weekdayLabel(state.scheduleDay).toLowerCase()}.`);
  el.querySelectorAll('[data-edit-lesson]').forEach((b) => b.addEventListener('click', () => openLessonEditor(b.dataset.editLesson)));
  el.querySelectorAll('[data-delete-own-lesson]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Usunąć tę lekcję ze swojego planu?')) return;
    const lessons = classLessons(viewingClass());
    const idx = lessons.findIndex((x) => x.id === b.dataset.deleteOwnLesson);
    if (idx !== -1) lessons.splice(idx, 1);
    saveLessonsByClass();
    renderSchedule();
  }));
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
    renderAdminLessonTable();
    if (cls === viewingClass()) renderSchedule();
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
    renderPendingReplacements();
    renderAnnouncements();
    renderSchedule();
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
const fontSize = document.querySelector('#fontSize');
const storedFont = localStorage.getItem('schoolFontSize');
fontSize.value = storedFont || 16;
document.documentElement.style.fontSize = fontSize.value + 'px';
fontSize.addEventListener('input', () => {
  document.documentElement.style.fontSize = fontSize.value + 'px';
  localStorage.setItem('schoolFontSize', fontSize.value);
});

const storedBg = localStorage.getItem('schoolBg') || '#f5f7ff';
document.documentElement.style.setProperty('--bg', storedBg);
document.querySelectorAll('[data-bg]').forEach((b) => {
  setSelected(b, b.dataset.bg === storedBg, ['ring-2', 'ring-ink', 'ring-offset-2'], []);
  b.addEventListener('click', () => {
    document.documentElement.style.setProperty('--bg', b.dataset.bg);
    localStorage.setItem('schoolBg', b.dataset.bg);
    document.querySelectorAll('[data-bg]').forEach((x) => setSelected(x, x === b, ['ring-2', 'ring-ink', 'ring-offset-2'], []));
  });
});

const storedMode = localStorage.getItem('schoolMode') || 'light';
document.body.classList.toggle('dark', storedMode === 'dark');
document.querySelectorAll('[data-mode]').forEach((b) => {
  setSelected(b, b.dataset.mode === storedMode, ['bg-primary', 'text-white', 'border-primary'], ['bg-app', 'text-muted', 'border-line']);
  b.addEventListener('click', () => {
    document.body.classList.toggle('dark', b.dataset.mode === 'dark');
    localStorage.setItem('schoolMode', b.dataset.mode);
    document.querySelectorAll('[data-mode]').forEach((x) => setSelected(x, x === b, ['bg-primary', 'text-white', 'border-primary'], ['bg-app', 'text-muted', 'border-line']));
    updateColourVisibility();
  });
});

const colourSettingWrap = document.querySelector('#colourSettingWrap');
const colourSetting = document.querySelector('#backgrounds').closest('[data-setting]');
function updateColourVisibility() {
  const dark = document.body.classList.contains('dark');
  colourSettingWrap.classList.toggle('grid-rows-[0fr]', dark);
  colourSettingWrap.classList.toggle('grid-rows-[1fr]', !dark);
  colourSetting.classList.toggle('opacity-0', dark);
  colourSetting.classList.toggle('opacity-100', !dark);
}
updateColourVisibility();

const storedPattern = localStorage.getItem('schoolPattern') || 'none';
const patternClasses = ['pattern-smile', 'pattern-heart', 'pattern-star', 'pattern-panda'];
if (storedPattern !== 'none') document.body.classList.add('pattern-' + storedPattern);
document.querySelectorAll('[data-pattern]').forEach((b) => {
  setSelected(b, b.dataset.pattern === storedPattern, ['ring-2', 'ring-ink', 'ring-offset-1'], []);
  b.addEventListener('click', () => {
    document.body.classList.remove(...patternClasses);
    if (b.dataset.pattern !== 'none') document.body.classList.add('pattern-' + b.dataset.pattern);
    localStorage.setItem('schoolPattern', b.dataset.pattern);
    document.querySelectorAll('[data-pattern]').forEach((x) => setSelected(x, x === b, ['ring-2', 'ring-ink', 'ring-offset-1'], []));
  });
});

// ---------- Accounts / login ----------
const classSelect = document.querySelector('#classroom');
classSelect.innerHTML += classOptionsHtml;
const childClassesSelect = document.querySelector('#childClasses');
childClassesSelect.innerHTML = classOptionsHtml;
let accounts = [];
let currentUser = JSON.parse(localStorage.getItem('schoolUser') || 'null');
const normalise = (name) => name.trim().toLocaleLowerCase('pl-PL');
const isAdmin = () => currentUser && (normalise(currentUser.name) === 'tpraglowski' || accounts.find((x) => normalise(x.name) === normalise(currentUser.name))?.admin);
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
  document.querySelector('#loginLayer').classList.remove('hidden');
  screen('startScreen');
  show('home');
  if (message) alert(message);
}

function finishLogin(user) {
  currentUser = { name: user.name, classroom: user.classroom, role: user.role || 'student', childClasses: user.childClasses || [] };
  localStorage.setItem('schoolUser', JSON.stringify(currentUser));
  state.viewingClassroom = accessibleClasses(currentUser)[0];
  document.querySelector('#loginLayer').classList.add('hidden');
  setupUserInterface();
}

document.querySelector('#registerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = capitalize(document.querySelector('#registerUsername').value.trim());
  if (accounts.some((x) => normalise(x.name) === normalise(name))) return alert('Takie konto już istnieje.');
  const role = registerRole.value;
  const childClasses = role === 'parent' ? [...childClassesSelect.selectedOptions].map((o) => o.value) : [];
  if (role === 'parent' && (!childClasses.length || childClasses.length > 5)) return alert('Wybierz od 1 do 5 klas dziecka.');
  const classroom = role === 'student' ? classSelect.value : role === 'parent' ? childClasses[0] : null;
  const pending = role === 'teacher';
  const user = { name, role, classroom, childClasses, pending, password: document.querySelector('#registerPassword').value, admin: normalise(name) === 'tpraglowski' };
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

document.querySelector('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = accounts.find((x) => normalise(x.name) === normalise(document.querySelector('#username').value) && x.password === document.querySelector('#password').value);
  if (!user) return alert('Nieprawidłowa nazwa użytkownika lub hasło.');
  if (user.role === 'teacher' && user.pending) return alert('Konto nauczyciela oczekuje jeszcze na zatwierdzenie przez administratora.');
  finishLogin(user);
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
  const original = accounts.find((a) => normalise(a.name) === normalise(oldName));
  const updated = { ...original, name: newName, role, classroom, childClasses, pending: false };
  accounts = accounts.map((a) => (normalise(a.name) === normalise(oldName) ? updated : a));
  if (nameChanged) deleteDoc(accountDocRef(oldName));
  setDoc(accountDocRef(newName), updated);
  renderAccounts();
});

function setupUserInterface() {
  document.querySelector('#homeAdmin')?.remove();
  document.querySelector('#logoutButton')?.remove();
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
  renderSubjects();
  renderSchedule();
  renderAnnouncements();
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
      if (latest) currentUser = { name: latest.name, classroom: latest.classroom, role: latest.role || 'student', childClasses: latest.childClasses || [] };
      state.viewingClassroom = accessibleClasses(currentUser)[0];
      document.querySelector('#loginLayer').classList.add('hidden');
      setupUserInterface();
    } else {
      logout('Twoje konto zostało usunięte przez administratora.');
    }
  }

  renderSubjects();
  renderAnnouncements();
  renderSchedule();
  show('home');
  setInterval(renderSchedule, 60000);
}
boot();
