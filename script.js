// Moja Szkoła — app logic
const gradients = ['linear-gradient(135deg,#4f46e5,#8b5cf6)', 'linear-gradient(135deg,#0891b2,#22c55e)', 'linear-gradient(135deg,#ea580c,#f43f5e)', 'linear-gradient(135deg,#0f766e,#0ea5e9)', 'linear-gradient(135deg,#be123c,#a855f7)', 'linear-gradient(135deg,#ca8a04,#f97316)'];
const lessonColors = ['#4f46e5', '#0891b2', '#7c3aed', '#dc2626', '#16a34a', '#ea580c'];

const defaultSubjects = [
  { id: 'math', name: 'Matematyka', gradient: gradients[0], competences: [{ id: 'algebra', name: 'Algebra', gradient: gradients[4] }, { id: 'geometry', name: 'Geometria', gradient: gradients[1] }] },
  { id: 'polish', name: 'Język polski', gradient: gradients[2], competences: [{ id: 'reading', name: 'Czytanie ze zrozumieniem', gradient: gradients[3] }] },
];
const defaultLessons = [
  { id: 'l1', name: 'Matematyka', teacher: 'AN', room: '24', start: '08:00', end: '08:45', color: '#4f46e5' },
  { id: 'l2', name: 'Język polski', teacher: 'PK', room: '12', start: '09:00', end: '09:45', color: '#0891b2' },
  { id: 'l3', name: 'Informatyka', teacher: 'MW', room: '8', start: '10:00', end: '10:45', color: '#7c3aed' },
];
const defaultAnnouncements = [
  { id: 'room-change', title: 'Zastępstwo: Informatyka', text: 'Zajęcia odbędą się w sali 11.', lessonId: 'l3', type: 'replacement', classroom: '1A', pending: false, date: '', time: '' },
  { id: 'reminder', title: 'Przypomnienie', text: 'Do poniedziałku oddaj projekt z biologii.', lessonId: '', type: 'reminder', classroom: 'all', pending: false, date: '', time: '' },
];
const classCodes = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => ['A', 'B', 'C'].map((letter) => `${n}${letter}`));
const classOptionsHtml = classCodes.map((c) => `<option value="${c}">${c}</option>`).join('');
const classroomOptionsHtml = (includeAll) => (includeAll ? '<option value="all">Wszystkie klasy</option>' : '') + classOptionsHtml;
const classLabel = (cls) => (cls === 'all' ? 'Wszystkie klasy' : cls);

// Migrate the old single shared schedule (pre-per-class) into class 1A so existing data isn't lost,
// and backfill fields added later (addedBy / classroom / pending / date / time) for data saved by older versions.
const legacyLessons = JSON.parse(localStorage.getItem('schoolLessons') || 'null');
const storedLessonsByClass = JSON.parse(localStorage.getItem('schoolLessonsByClass') || 'null');
const normalizeLessonsByClass = (byClass) => {
  const out = {};
  for (const [cls, lessons] of Object.entries(byClass || {})) out[cls] = (lessons || []).map((l) => ({ addedBy: 'admin', ...l }));
  return out;
};
const initialLessonsByClass = normalizeLessonsByClass(storedLessonsByClass || { '1A': legacyLessons || defaultLessons });

const storedAnnouncements = JSON.parse(localStorage.getItem('schoolAnnouncements') || 'null');
const normalizeAnnouncements = (list) => (list || []).map((a) => ({ classroom: a.lessonId ? '1A' : 'all', pending: false, date: '', time: '', ...a }));

const state = {
  subjects: JSON.parse(localStorage.getItem('schoolSubjects') || 'null') || defaultSubjects,
  lessonsByClass: initialLessonsByClass,
  announcements: normalizeAnnouncements(storedAnnouncements || defaultAnnouncements),
  activeSubject: null,
  mode: 'subject',
  editAnnouncement: null,
  editLesson: null,
  lessonTargetClass: null,
  forceReplacement: false,
  isReplacementEditing: false,
  chosenGradient: gradients[0],
  lessonColor: lessonColors[0],
};

const saveSubjects = () => localStorage.setItem('schoolSubjects', JSON.stringify(state.subjects));
const saveLessonsByClass = () => localStorage.setItem('schoolLessonsByClass', JSON.stringify(state.lessonsByClass));
const saveAnnouncements = () => localStorage.setItem('schoolAnnouncements', JSON.stringify(state.announcements));
const classLessons = (cls) => state.lessonsByClass[cls] || (state.lessonsByClass[cls] = []);

const escapeHtml = (s) => s.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const capitalize = (s) => (s ? `${s.charAt(0).toLocaleUpperCase('pl-PL')}${s.slice(1)}` : s);
const minutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function setSelected(el, isSelected, onClasses, offClasses) {
  el.classList.remove(...(isSelected ? offClasses : onClasses));
  el.classList.add(...(isSelected ? onClasses : offClasses));
}

// ---------- Navigation ----------
function show(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.id !== id));
  document.querySelectorAll('#mainNav [data-view]').forEach((b) => {
    const active = b.dataset.view === id;
    setSelected(b, active, ['bg-primary', 'text-white'], ['text-muted']);
  });
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
  const body = type === 'subject'
    ? `Kompetencje: ${item.competences.length}`
    : `<span class="mt-2 inline-block rounded-lg bg-white/25 px-2 py-1 text-[.78em] font-extrabold text-white">${status.label}</span>`;
  return `<article class="group relative min-h-[172px] cursor-pointer overflow-hidden rounded-[25px] p-5 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl" style="background:${background}" data-id="${item.id}" data-type="${type}" tabindex="0" role="button">
    <span aria-hidden="true" class="pointer-events-none absolute -right-[75px] -top-[78px] h-[220px] w-[220px] rounded-full bg-white/20"></span>
    <button class="absolute right-3 top-3 z-10 rounded-lg bg-black/30 px-2 py-1 text-sm font-bold opacity-0 transition group-hover:opacity-100" title="Usuń" data-delete="${item.id}" data-type="${type}">Usuń</button>
    <h2 class="relative mt-14 text-[1.3em] font-bold tracking-tight">${escapeHtml(item.name)}</h2>
    <p class="relative mt-1 text-[.9em] text-white/85">${body}</p>
  </article>`;
}

function renderSubjects() {
  const el = document.querySelector('#subjectGrid');
  el.innerHTML = state.subjects.length
    ? state.subjects.map((x) => card(x, 'subject')).join('')
    : emptyState('Nie masz jeszcze przedmiotów', 'Dodaj pierwszy przedmiot, aby zacząć.');
  bindCards(el);
}

function renderCompetences() {
  const subject = state.subjects.find((x) => x.id === state.activeSubject);
  if (!subject) return show('competences');
  document.querySelector('#detailTitle').textContent = subject.name;
  document.querySelector('#crumbName').textContent = subject.name;
  const el = document.querySelector('#competenceGrid');
  el.innerHTML = subject.competences.length
    ? subject.competences.map((x) => card(x, 'competence')).join('')
    : emptyState('Brak kompetencji', 'Dodaj pierwszą kompetencję dla tego przedmiotu.');
  bindCards(el);
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
      if (type === 'subject') {
        state.subjects = state.subjects.filter((x) => x.id !== id);
      } else {
        const subject = state.subjects.find((x) => x.id === state.activeSubject);
        subject.competences = subject.competences.filter((x) => x.id !== id);
      }
      saveSubjects();
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
  activeCompetence = state.subjects.find((x) => x.id === state.activeSubject).competences.find((x) => x.id === id);
  document.querySelector('#statusTitle').textContent = activeCompetence.name;
  document.querySelector('#statusSelect').value = activeCompetence.status || 'locked';
  statusDialog.showModal();
}
document.querySelector('#cancelStatus').addEventListener('click', () => statusDialog.close('cancel'));
statusDialog.addEventListener('close', () => {
  if (statusDialog.returnValue !== 'save' || !activeCompetence) return;
  activeCompetence.status = document.querySelector('#statusSelect').value;
  saveSubjects();
  renderCompetences();
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
  lessonSelect.innerHTML = '<option value="">Wybierz lekcję</option>' + classLessons(cls).map((x) => `<option value="${x.id}">${x.start} · ${escapeHtml(x.name)}</option>`).join('');
  if ([...lessonSelect.options].some((o) => o.value === previousValue)) lessonSelect.value = previousValue;
}
document.querySelector('#announcementClassroom').addEventListener('change', (e) => {
  if (!document.querySelector('#announcementLessonField').classList.contains('hidden')) refreshReplacementLessonOptions(e.target.value);
});

function openEditor(mode, announcementId = null) {
  state.mode = mode;
  state.editAnnouncement = announcementId;
  const isAnnouncement = mode === 'announcement';
  const existing = isAnnouncement && announcementId ? state.announcements.find((x) => x.id === announcementId) : null;
  const isReplacement = state.forceReplacement || !!existing?.lessonId;
  const admin = isAdmin();
  state.isReplacementEditing = isReplacement;
  state.chosenGradient = gradients[state.subjects.length % gradients.length];

  document.querySelector('#modalTitle').textContent = isAnnouncement ? (existing ? 'Edytuj wpis' : isReplacement ? (admin ? 'Dodaj zastępstwo' : 'Zgłoś zastępstwo') : 'Dodaj wpis') : mode === 'subject' ? 'Dodaj przedmiot' : 'Dodaj kompetencję';
  document.querySelector('#nameLabel').textContent = isAnnouncement ? (isReplacement ? 'Nazwa zastępstwa' : 'Tytuł ogłoszenia') : mode === 'subject' ? 'Nazwa przedmiotu' : 'Nazwa kompetencji';
  document.querySelector('#itemName').placeholder = isAnnouncement ? (isReplacement ? 'np. Informatyka — pani Nowak' : 'np. Kiermasz szkolny') : mode === 'subject' ? 'np. Matematyka' : 'np. Rozwiązywanie równań';
  document.querySelector('#itemName').value = existing ? existing.title : '';
  document.querySelector('#itemDescription').value = existing ? existing.text : '';
  document.querySelector('#descriptionField').classList.toggle('hidden', !isAnnouncement);
  document.querySelector('#itemDescription').required = isAnnouncement;
  document.querySelector('#gradientField').classList.toggle('hidden', isAnnouncement);

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
    classroomSelect.value = existing?.classroom || (isReplacement ? currentUser?.classroom || classCodes[0] : 'all');
  }

  const lessonField = document.querySelector('#announcementLessonField');
  const lessonSelect = document.querySelector('#announcementLesson');
  const typeField = document.querySelector('#announcementTypeField');
  lessonField.classList.toggle('hidden', !isAnnouncement || !isReplacement);
  typeField.classList.toggle('hidden', !isAnnouncement || isReplacement);
  if (isReplacement) {
    const targetClass = admin ? classroomSelect.value : currentUser?.classroom || classCodes[0];
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
      ? admin ? document.querySelector('#announcementClassroom').value : currentUser?.classroom || classCodes[0]
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
      state.announcements.push({ id: crypto.randomUUID(), title: name, text, lessonId, type, classroom, date, time, pending });
    }
    saveAnnouncements();
    renderAnnouncements();
    renderSchedule();
    if (admin) renderPendingReplacements();
    return;
  }

  const item = { id: crypto.randomUUID(), name, gradient: state.chosenGradient };
  if (state.mode === 'subject') {
    item.competences = [];
    state.subjects.push(item);
  } else {
    state.subjects.find((x) => x.id === state.activeSubject).competences.push(item);
  }
  saveSubjects();
  state.mode === 'subject' ? renderSubjects() : renderCompetences();
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

function openLessonEditor(id = null, cls = currentUser?.classroom) {
  state.editLesson = id;
  state.lessonTargetClass = cls;
  const item = id ? classLessons(cls).find((x) => x.id === id) : null;
  document.querySelector('#lessonModalTitle').textContent = item ? 'Edytuj lekcję' : 'Dodaj lekcję';
  document.querySelector('#lessonName').value = item?.name || '';
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
  const teacher = document.querySelector('#lessonTeacher').value.trim();
  const room = document.querySelector('#lessonRoom').value.trim();
  const start = document.querySelector('#lessonStart').value;
  const end = document.querySelector('#lessonEnd').value;
  if (!name || !teacher || !start || !end || start >= end) return;
  const lessons = classLessons(state.lessonTargetClass);
  if (state.editLesson) {
    Object.assign(lessons.find((x) => x.id === state.editLesson), { name, teacher, room, start, end, color: state.lessonColor });
  } else {
    lessons.push({ id: crypto.randomUUID(), name, teacher, room, start, end, color: state.lessonColor, addedBy: isAdmin() ? 'admin' : 'student' });
  }
  saveLessonsByClass();
  if (state.lessonTargetClass === currentUser?.classroom) renderSchedule();
  if (document.querySelector('#adminClassSelect')?.value === state.lessonTargetClass) renderAdminLessonTable();
});

function renderSchedule() {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const el = document.querySelector('#lessonList');
  document.querySelector('#todayDate').textContent = now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
  const lessons = [...classLessons(currentUser?.classroom)].sort((a, b) => a.start.localeCompare(b.start));
  el.innerHTML = lessons.length ? lessons.map((x) => {
    const replacement = state.announcements.find((a) => a.lessonId === x.id && !a.pending);
    const replacementName = replacement?.title.replace(/^Zastępstwo:\s*/i, '');
    const isNow = current >= minutes(x.start) && current <= minutes(x.end);
    const editable = x.addedBy === 'student';
    return `<div class="relative grid grid-cols-[65px_1fr_auto] items-center overflow-hidden rounded-2xl border border-line${isNow ? ' outline outline-[3px] outline-offset-2 outline-amber-400' : ''}">
      ${isNow ? `<span class="absolute inset-x-0 top-0 z-10 border-t-[3px] border-amber-400 bg-amber-100 py-[3px] pr-2 text-right text-[9px] font-black tracking-widest text-amber-800">TERAZ</span>` : ''}
      <div class="grid h-full place-items-center py-4 text-center text-[.9em] font-extrabold text-white" style="background:${x.color}">${x.start}<br><small>${x.end}</small></div>
      <div class="px-4 py-3"><b class="block">${escapeHtml(x.name)}</b><span class="text-[.9em] text-muted">sala ${escapeHtml(x.room || '—')} · ${escapeHtml(x.teacher)}</span>${replacement ? `<span class="mt-1 inline-block rounded-lg bg-amber-100 px-2 py-1 text-[.78em] font-extrabold text-amber-800">Zastępstwo za: ${escapeHtml(replacementName)}</span>` : ''}</div>
      ${editable ? `<div class="mr-3 flex gap-1"><button class="rounded-lg bg-app px-2 py-2 font-extrabold text-primary" data-edit-lesson="${x.id}" aria-label="Edytuj lekcję">✎</button><button class="rounded-lg bg-app px-2 py-2 font-extrabold text-red-600" data-delete-own-lesson="${x.id}" aria-label="Usuń lekcję">🗑</button></div>` : ''}
    </div>`;
  }).join('') : emptyState('Brak lekcji', 'Dodaj pierwszą lekcję do planu.');
  el.querySelectorAll('[data-edit-lesson]').forEach((b) => b.addEventListener('click', () => openLessonEditor(b.dataset.editLesson)));
  el.querySelectorAll('[data-delete-own-lesson]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Usunąć tę lekcję ze swojego planu?')) return;
    const lessons = classLessons(currentUser.classroom);
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
  const lessons = [...classLessons(cls)].sort((a, b) => a.start.localeCompare(b.start));
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
    if (cls === currentUser?.classroom) renderSchedule();
  }));
}

// ---------- Announcements / replacements ----------
const eventStyles = { event: 'bg-blue-100 text-blue-900', reminder: 'bg-green-100 text-green-900', other: 'bg-amber-100 text-amber-900' };

function renderAnnouncements() {
  const admin = isAdmin();
  const cls = currentUser?.classroom;
  const events = state.announcements.filter((x) => !x.lessonId && (admin || x.classroom === 'all' || x.classroom === cls));
  const replacements = state.announcements.filter((x) => x.lessonId && !x.pending && (admin || x.classroom === cls));
  const eventEl = document.querySelector('#announcementList');
  const replacementEl = document.querySelector('#replacementList');

  eventEl.innerHTML = events.length ? events.map((x) => {
    const meta = [x.date, x.time].filter(Boolean).join(' · ');
    return `<article class="relative min-h-[145px] rounded-[25px] p-5 ${eventStyles[x.type] || eventStyles.other}" data-edit-announcement="${x.id}">
      <button class="absolute right-3 top-3 rounded-lg bg-white/70 px-2 py-1 text-sm font-bold" title="Edytuj" data-edit-announcement="${x.id}">✎</button>
      <h2 class="mt-9 text-[1.2em] font-bold">${escapeHtml(x.title)}</h2><p class="mt-1 text-[.9em]">${escapeHtml(x.text)}</p>
      ${meta ? `<p class="mt-2 text-xs font-bold opacity-80">${escapeHtml(meta)}</p>` : ''}
      ${admin ? `<span class="mt-2 inline-block rounded bg-white/60 px-1.5 py-0.5 text-xs font-bold">${escapeHtml(classLabel(x.classroom))}</span>` : ''}
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

const colourSetting = document.querySelector('#backgrounds').closest('[data-setting]');
const updateColourVisibility = () => colourSetting.classList.toggle('hidden', document.body.classList.contains('dark'));
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
let accounts = JSON.parse(localStorage.getItem('schoolAccounts') || '[]');
let currentUser = JSON.parse(localStorage.getItem('schoolUser') || 'null');
const normalise = (name) => name.trim().toLocaleLowerCase('pl-PL');
const isAdmin = () => currentUser && (normalise(currentUser.name) === 'tpraglowski' || accounts.find((x) => normalise(x.name) === normalise(currentUser.name))?.admin);
const screen = (id) => document.querySelectorAll('#startScreen,#loginForm,#registerForm').forEach((x) => x.classList.toggle('hidden', x.id !== id));

document.querySelector('#openLogin').addEventListener('click', () => screen('loginForm'));
document.querySelector('#openRegister').addEventListener('click', () => screen('registerForm'));
document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => screen('startScreen')));

function finishLogin(user) {
  currentUser = { name: user.name, classroom: user.classroom };
  localStorage.setItem('schoolUser', JSON.stringify(currentUser));
  document.querySelector('#loginLayer').classList.add('hidden');
  setupUserInterface();
}

document.querySelector('#registerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = capitalize(document.querySelector('#registerUsername').value.trim());
  if (accounts.some((x) => normalise(x.name) === normalise(name))) return alert('Takie konto już istnieje.');
  const user = { name, classroom: classSelect.value, password: document.querySelector('#registerPassword').value, admin: normalise(name) === 'tpraglowski' };
  accounts.push(user);
  localStorage.setItem('schoolAccounts', JSON.stringify(accounts));
  finishLogin(user);
});

document.querySelector('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const user = accounts.find((x) => normalise(x.name) === normalise(document.querySelector('#username').value) && x.password === document.querySelector('#password').value);
  if (!user) return alert('Nieprawidłowa nazwa użytkownika lub hasło.');
  finishLogin(user);
});

function renderAccounts() {
  const el = document.querySelector('#accountList');
  el.innerHTML = accounts.length ? accounts.map((a) =>
    `<div class="relative rounded-r-xl border-l-[5px] border-amber-500 bg-amber-50 py-3.5 pl-4 pr-32 text-amber-900">
      <b class="block">${escapeHtml(a.name)} · klasa ${a.classroom}</b><span class="text-[.9em] text-amber-800">${a.admin ? 'Administrator' : 'Uczeń'}</span>
      <button class="absolute right-[7.5rem] top-3 rounded-lg bg-white/70 px-2 py-1.5 font-bold text-amber-800" data-account="${escapeHtml(a.name)}">Zmień dostęp</button>
      <button class="absolute right-2.5 top-3 rounded-lg bg-white/70 px-2 py-1.5 font-bold text-amber-800" data-remove-account="${escapeHtml(a.name)}">Usuń</button>
    </div>`
  ).join('') : `<div class="col-span-full rounded-[20px] border-2 border-dashed border-line px-5 py-11 text-center text-muted">Brak kont.</div>`;

  el.querySelectorAll('[data-account]').forEach((b) => b.addEventListener('click', () => {
    const account = accounts.find((a) => normalise(a.name) === normalise(b.dataset.account));
    account.admin = !account.admin;
    localStorage.setItem('schoolAccounts', JSON.stringify(accounts));
    renderAccounts();
  }));
  el.querySelectorAll('[data-remove-account]').forEach((b) => b.addEventListener('click', () => {
    if (normalise(b.dataset.removeAccount) === 'tpraglowski' || !confirm('Usunąć to konto?')) return;
    accounts = accounts.filter((a) => normalise(a.name) !== normalise(b.dataset.removeAccount));
    localStorage.setItem('schoolAccounts', JSON.stringify(accounts));
    renderAccounts();
  }));
}

function setupUserInterface() {
  document.querySelector('#homeAdmin')?.remove();
  document.querySelector('#logoutButton')?.remove();
  if (isAdmin()) {
    document.querySelector('#homeGrid').insertAdjacentHTML('beforeend', `<button class="group relative min-h-[220px] overflow-hidden rounded-[25px] p-7 text-left text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl" id="homeAdmin" style="background:linear-gradient(135deg,#0f172a,#475569)" onclick="show('admin')">
      <span aria-hidden="true" class="pointer-events-none absolute -right-[75px] -top-[78px] h-[220px] w-[220px] rounded-full bg-white/20"></span>
      <span class="relative grid h-[52px] w-[52px] place-items-center rounded-2xl bg-white/15 text-2xl">⚙</span>
      <h2 class="relative mt-12 text-[1.55em] font-bold tracking-tight">Panel administratora</h2>
      <p class="relative mt-1.5 text-white/85">Konta i uprawnienia</p>
    </button>`);
    renderAccounts();
    const adminClassSelect = document.querySelector('#adminClassSelect');
    adminClassSelect.innerHTML = classOptionsHtml;
    adminClassSelect.value = currentUser?.classroom || classCodes[0];
    adminClassSelect.addEventListener('change', renderAdminLessonTable);
    document.querySelector('#addAdminLesson').addEventListener('click', () => openLessonEditor(null, adminClassSelect.value));
    renderAdminLessonTable();
    renderPendingReplacements();
  }
  document.querySelector('#addReplacement').textContent = isAdmin() ? '+ Dodaj zastępstwo' : '+ Zgłoś zastępstwo';
  renderSchedule();
  renderAnnouncements();
  document.querySelector('#settingsPanel').insertAdjacentHTML('beforeend', `<button class="mt-[18px] rounded-[10px] bg-app px-3.5 py-2.5 font-bold text-muted" id="logoutButton">Wyloguj się</button>`);
  document.querySelector('#logoutButton').addEventListener('click', () => {
    localStorage.removeItem('schoolUser');
    currentUser = null;
    document.querySelector('#loginLayer').classList.remove('hidden');
    screen('startScreen');
    show('home');
  });
}

if (currentUser) {
  document.querySelector('#loginLayer').classList.add('hidden');
  setupUserInterface();
}

renderSubjects();
renderAnnouncements();
renderSchedule();
setInterval(renderSchedule, 60000);
