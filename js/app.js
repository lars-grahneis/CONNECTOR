// Oberfläche von CONNECTOR. Alle Daten bleiben im Browser dieses Geräts.
import * as db from './db.js';
import { todayISO, formatDE, relativeDays, daysBetween, MONTHS } from './dates.js';
import {
  DEFAULT_RHYTHM, BIRTHDAY_WINDOW, contactStatus, sortByUrgency, byName, nextBirthday, todayOverview,
  birthdayParts, birthdayFromParts, formatBirthday, normalizeName,
} from './model.js';
import { parseWhatsAppChat, nameFromFileName } from './whatsapp.js';
import { parseVCards } from './vcard.js';
import { birthdaysToICS } from './ics.js';
import { waNumber } from './phone.js';

const APP_VERSION = '0.1.0';
const BACKUP_WARN_DAYS = 30;
const RHYTHM_PRESETS = [7, 14, 28];

const view = document.getElementById('view');
const titleEl = document.getElementById('title');
const modalEl = document.getElementById('modal');
const toastEl = document.getElementById('toast');
const wide = window.matchMedia('(min-width: 900px)');
const pickerSupported = 'contacts' in navigator && 'ContactsManager' in window;

let contacts = [];
let settings = { defaultRhythm: DEFAULT_RHYTHM, countryCode: '49' };
let lastBackup = null;
let listQuery = '';
let listSort = 'due';

// ---------- Hilfen ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => todayISO();
const byId = id => contacts.find(c => c.id === id);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

function newContact(fields) {
  const now = new Date().toISOString();
  return {
    id: newId(), name: '', phone: '', birthday: '', rhythmDays: settings.defaultRhythm,
    lastContact: '', followUp: '', history: [], createdAt: now, updatedAt: now, ...fields,
  };
}

async function saveContact(c) {
  c.updatedAt = new Date().toISOString();
  await db.putContact(c);
  await reload();
  requestPersistence();
}

async function saveContacts(list) {
  const now = new Date().toISOString();
  for (const c of list) c.updatedAt = now;
  await db.putContacts(list);
  await reload();
  requestPersistence();
}

async function reload() {
  contacts = await db.getAllContacts();
}

// Bittet den Browser, die Daten nicht automatisch zu löschen, wenn Speicher knapp wird.
async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* nicht unterstützt */ }
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function pickFile(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.click();
  });
}

function statusText(st) {
  if (st.state === 'unknown') return 'Noch kein Kontakt erfasst';
  const last = `Zuletzt ${relativeDays(-st.since)}`;
  if (st.daysUntil < 0) return `${last} · ${plural(-st.daysUntil, 'Tag', 'Tage')} überfällig`;
  if (st.daysUntil === 0) return `${last} · heute fällig`;
  return `${last} · fällig ${relativeDays(st.daysUntil)}`;
}

function birthdayText(nb) {
  const when = nb.daysUntil === 0 ? 'heute' : relativeDays(nb.daysUntil);
  return nb.age != null ? `${when}, wird ${nb.age}` : when;
}

// ---------- Modal ----------

function openModal(html, setup) {
  modalEl.innerHTML = html;
  modalEl.showModal();
  modalEl.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  setup?.(modalEl);
}

function closeModal() {
  if (modalEl.open) modalEl.close();
}

// Beim Schließen alles entfernen, damit z. B. Chattext nicht im Speicher der Seite bleibt.
modalEl.addEventListener('close', () => { modalEl.innerHTML = ''; });
modalEl.addEventListener('click', e => { if (e.target === modalEl) closeModal(); });

// ---------- Routing ----------

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { page: parts[0] || 'heute', id: parts[1], sub: parts[2] };
}

function setTab(tab, title) {
  titleEl.textContent = title;
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
}

function render() {
  const { page, id, sub } = route();
  switch (page) {
    case 'heute': return renderToday();
    case 'kontakte': return renderContactsPage(null);
    case 'kontakt': return sub === 'bearbeiten' ? renderEdit(id) : renderContactsPage(id);
    case 'neu': return renderEdit(null);
    case 'mehr': return renderMore();
    default: location.replace('#/heute');
  }
}

function show(html) {
  view.innerHTML = html;
  window.scrollTo(0, 0);
}

// ---------- Ansicht: Heute ----------

function contactRow(c, extra = '') {
  const st = contactStatus(c, today());
  return `<li class="row state-${st.state}">
    <a class="row-main" href="#/kontakt/${encodeURIComponent(c.id)}">
      <span class="dot" aria-hidden="true"></span>
      <span class="row-text">
        <span class="row-name">${esc(c.name)}</span>
        <span class="row-sub">${esc(extra || statusText(st))}</span>
        ${c.followUp ? `<span class="row-follow">↪ ${esc(c.followUp)}</span>` : ''}
      </span>
    </a>
    <button class="btn-small" data-action="contacted" data-id="${esc(c.id)}" aria-label="Gemeldet bei ${esc(c.name)}">✓ Gemeldet</button>
  </li>`;
}

function renderToday() {
  setTab('heute', 'Heute');
  const t = today();
  if (!contacts.length) {
    return show(`<section class="empty">
      <h2>Willkommen bei CONNECTOR</h2>
      <p>Hier sehen Sie jeden Tag, bei wem Sie sich melden wollten und wer bald Geburtstag hat.</p>
      <p><a class="btn primary" href="#/neu">Ersten Kontakt anlegen</a></p>
      <p><a class="btn" href="#/mehr">Kontakte importieren</a></p>
    </section>`);
  }
  const o = todayOverview(contacts, t);
  const backupAge = lastBackup ? daysBetween(lastBackup, t) : null;
  let html = '';
  if (backupAge == null || backupAge > BACKUP_WARN_DAYS) {
    html += `<div class="banner">
      <span>${backupAge == null ? 'Noch keine Datensicherung erstellt.' : `Letzte Datensicherung vor ${backupAge} Tagen.`}</span>
      <button class="btn-small" data-action="backup">Jetzt sichern</button>
    </div>`;
  }

  html += `<section><h2>Geburtstage <small>nächste ${BIRTHDAY_WINDOW} Tage</small></h2>`;
  html += o.birthdays.length
    ? `<ul class="list">${o.birthdays.map(b => contactRow(b.contact, `🎂 ${formatBirthday(b.contact.birthday).replace(/ \d{4}$/, '')} · ${birthdayText(b.next)}`)).join('')}</ul>`
    : '<p class="muted">Keine Geburtstage in den nächsten zwei Wochen.</p>';
  html += '</section>';

  html += `<section><h2>Fällig <small>${o.overdue.length}</small></h2>`;
  html += o.overdue.length
    ? `<ul class="list">${o.overdue.map(c => contactRow(c)).join('')}</ul>`
    : '<p class="muted">Niemand ist überfällig.</p>';
  html += '</section>';

  html += `<section><h2>Bald fällig <small>nächste 7 Tage</small></h2>`;
  html += o.soon.length
    ? `<ul class="list">${o.soon.map(c => contactRow(c)).join('')}</ul>`
    : '<p class="muted">In den nächsten 7 Tagen wird niemand fällig.</p>';
  html += '</section>';

  if (o.unknown.length) {
    html += `<section><details><summary><h2>Ohne Kontaktdatum <small>${o.unknown.length}</small></h2></summary>
      <ul class="list">${o.unknown.map(c => contactRow(c)).join('')}</ul></details></section>`;
  }
  show(html);
}

// ---------- Ansicht: Kontakte ----------

function filteredContacts() {
  const q = normalizeName(listQuery);
  const list = q ? contacts.filter(c => normalizeName(c.name).includes(q)) : contacts;
  return listSort === 'name' ? [...list].sort(byName) : sortByUrgency(list, today());
}

function listHtml(activeId) {
  const list = filteredContacts();
  if (!list.length) return `<p class="muted">${contacts.length ? 'Kein Treffer.' : 'Noch keine Kontakte.'}</p>`;
  return `<ul class="list">${list.map(c => contactRow(c).replace('class="row ', `class="row ${c.id === activeId ? 'active ' : ''}`)).join('')}</ul>`;
}

function listPane(activeId) {
  return `<div class="list-tools">
      <input type="search" id="search" placeholder="Name suchen" value="${esc(listQuery)}" aria-label="Name suchen">
      <select id="sort" aria-label="Sortierung">
        <option value="due" ${listSort === 'due' ? 'selected' : ''}>Nach Fälligkeit</option>
        <option value="name" ${listSort === 'name' ? 'selected' : ''}>Nach Name</option>
      </select>
      <a class="btn primary" href="#/neu" aria-label="Neuer Kontakt">＋ Neu</a>
    </div>
    <div id="list" data-active="${esc(activeId || '')}">${listHtml(activeId)}</div>`;
}

function renderContactsPage(id) {
  const c = id ? byId(id) : null;
  if (id && !c) return location.replace('#/kontakte');
  setTab('kontakte', c && !wide.matches ? 'Kontakt' : 'Kontakte');
  if (wide.matches) {
    show(`<div class="split"><div class="pane-list">${listPane(id)}</div>
      <div class="pane-detail">${c ? detailHtml(c) : '<p class="muted placeholder">Kontakt links auswählen.</p>'}</div></div>`);
  } else {
    show(c ? detailHtml(c) : listPane(null));
  }
}

function detailHtml(c) {
  const t = today();
  const st = contactStatus(c, t);
  const nb = nextBirthday(c.birthday, t);
  const wa = waNumber(c.phone, settings.countryCode);
  const history = [...(c.history || [])].sort((a, b) => b.date.localeCompare(a.date));
  return `<article class="detail state-${st.state}">
    <header class="detail-head">
      <h2>${esc(c.name)}</h2>
      ${wide.matches ? '' : '<a class="back" href="#/kontakte">‹ Alle Kontakte</a>'}
    </header>
    <div class="follow ${c.followUp ? '' : 'empty'}">
      <h3>Anknüpfen beim nächsten Mal</h3>
      <p>${c.followUp ? esc(c.followUp) : 'Noch nichts notiert.'}</p>
    </div>
    <dl class="facts">
      <dt>Letzter Kontakt</dt><dd>${c.lastContact ? `${formatDE(c.lastContact)} (${relativeDays(-st.since)})` : '–'}</dd>
      <dt>Rhythmus</dt><dd>alle ${c.rhythmDays} Tage${st.due ? ` · ${st.daysUntil < 0 ? `${plural(-st.daysUntil, 'Tag', 'Tage')} überfällig` : st.daysUntil === 0 ? 'heute fällig' : `fällig ${relativeDays(st.daysUntil)}`}` : ''}</dd>
      <dt>Geburtstag</dt><dd>${c.birthday ? `${esc(formatBirthday(c.birthday))} · ${birthdayText(nb)}` : '–'}</dd>
      <dt>Telefon</dt><dd>${c.phone ? esc(c.phone) : '–'}</dd>
    </dl>
    <div class="actions wrap">
      <button class="btn primary" data-action="contacted" data-id="${esc(c.id)}">✓ Gemeldet</button>
      ${wa ? `<a class="btn" href="https://wa.me/${wa}" target="_blank" rel="noopener noreferrer">WhatsApp öffnen</a>` : ''}
      <button class="btn" data-action="chat" data-id="${esc(c.id)}">Chat importieren</button>
      <a class="btn" href="#/kontakt/${encodeURIComponent(c.id)}/bearbeiten">Bearbeiten</a>
    </div>
    <section>
      <h3>Gesprächshistorie</h3>
      ${history.length ? `<ul class="history">${history.map(h => `<li>
        <time>${formatDE(h.date)}</time>
        <p>${h.note ? esc(h.note) : '<span class="muted">ohne Notiz</span>'}</p>
        <button class="icon-btn" data-action="delete-history" data-id="${esc(c.id)}" data-hid="${esc(h.id)}" aria-label="Eintrag löschen">✕</button>
      </li>`).join('')}</ul>` : '<p class="muted">Noch keine Einträge.</p>'}
    </section>
  </article>`;
}

// ---------- Ansicht: Bearbeiten ----------

function rhythmFields(value) {
  const preset = RHYTHM_PRESETS.includes(value);
  return `<label>Rhythmus
      <select name="rhythm">
        <option value="7" ${value === 7 ? 'selected' : ''}>wöchentlich (7 Tage)</option>
        <option value="14" ${value === 14 ? 'selected' : ''}>alle 2 Wochen (14 Tage)</option>
        <option value="28" ${value === 28 ? 'selected' : ''}>alle 4 Wochen (28 Tage)</option>
        <option value="custom" ${preset ? '' : 'selected'}>anderer Wert …</option>
      </select>
    </label>
    <label class="rhythm-custom" ${preset ? 'hidden' : ''}>Tage
      <input type="number" name="rhythmCustom" min="1" max="730" value="${value}">
    </label>`;
}

function readRhythm(f) {
  const v = f.get('rhythm');
  const n = v === 'custom' ? Number(f.get('rhythmCustom')) : Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 730 ? n : null;
}

function renderEdit(id) {
  const c = id ? byId(id) : newContact({});
  if (id && !c) return location.replace('#/kontakte');
  setTab('kontakte', id ? 'Bearbeiten' : 'Neuer Kontakt');
  const b = birthdayParts(c.birthday) || {};
  const form = `<form id="edit-form" class="form" data-id="${esc(id || '')}" novalidate>
    <label>Name <input name="name" required value="${esc(c.name)}" autocomplete="off"></label>
    <label>Telefon (für WhatsApp) <input name="phone" type="tel" value="${esc(c.phone)}" placeholder="z. B. 0171 1234567"></label>
    <fieldset class="bday"><legend>Geburtstag</legend>
      <select name="bday" aria-label="Tag"><option value="">Tag</option>${Array.from({ length: 31 }, (_, i) => `<option ${b.day === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
      <select name="bmonth" aria-label="Monat"><option value="">Monat</option>${MONTHS.map((m, i) => `<option value="${i + 1}" ${b.month === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <input name="byear" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear()}" placeholder="Jahr (optional)" value="${b.year || ''}" aria-label="Jahr">
    </fieldset>
    ${rhythmFields(c.rhythmDays)}
    <label>Letzter Kontakt <input type="date" name="lastContact" value="${esc(c.lastContact)}" max="${today()}"></label>
    <label>Anknüpfen beim nächsten Mal <textarea name="followUp" rows="4">${esc(c.followUp)}</textarea></label>
    <p class="error" id="form-error" role="alert"></p>
    <div class="actions">
      <a class="btn" href="${id ? `#/kontakt/${encodeURIComponent(id)}` : '#/kontakte'}">Abbrechen</a>
      <button class="btn primary" type="submit">Speichern</button>
    </div>
    ${id ? `<div class="danger-zone"><button type="button" class="btn danger" data-action="delete-contact" data-id="${esc(id)}">Kontakt löschen</button></div>` : ''}
  </form>`;
  if (wide.matches) show(`<div class="split"><div class="pane-list">${listPane(id)}</div><div class="pane-detail">${form}</div></div>`);
  else show(form);
  view.querySelector('input[name="name"]').focus();
}

async function submitEdit(form) {
  const f = new FormData(form);
  const err = form.querySelector('#form-error');
  const name = String(f.get('name')).trim();
  if (!name) { err.textContent = 'Bitte einen Namen eingeben.'; return; }
  const rhythm = readRhythm(f);
  if (!rhythm) { err.textContent = 'Rhythmus: bitte eine ganze Zahl zwischen 1 und 730 Tagen.'; return; }
  const day = f.get('bday'), month = f.get('bmonth'), year = String(f.get('byear')).trim();
  let birthday = '';
  if (day || month || year) {
    if (!day || !month) { err.textContent = 'Geburtstag: bitte Tag und Monat wählen.'; return; }
    if (year && (!/^\d{4}$/.test(year) || +year < 1900 || +year > new Date().getFullYear())) {
      err.textContent = 'Geburtstag: Jahr bitte vierstellig oder leer lassen.'; return;
    }
    birthday = birthdayFromParts(day, month, year);
    if (!birthday) { err.textContent = 'Geburtstag: dieses Datum gibt es nicht.'; return; }
  }
  const lastContact = String(f.get('lastContact'));
  if (lastContact > today()) { err.textContent = 'Der letzte Kontakt kann nicht in der Zukunft liegen.'; return; }

  const id = form.dataset.id;
  const c = id ? byId(id) : newContact({});
  Object.assign(c, {
    name, phone: String(f.get('phone')).trim(), birthday, rhythmDays: rhythm,
    lastContact, followUp: String(f.get('followUp')).trim(),
  });
  await saveContact(c);
  toast('Gespeichert');
  location.hash = `#/kontakt/${encodeURIComponent(c.id)}`;
}

// ---------- Dialog: Gemeldet ----------

function openContactedDialog(id) {
  const c = byId(id);
  if (!c) return;
  openModal(`<form class="form" id="contacted-form">
    <h2>Gemeldet bei ${esc(c.name)}</h2>
    <label>Datum <input type="date" name="date" value="${today()}" max="${today()}" required></label>
    <label>Notiz zum Gespräch <textarea name="note" rows="3" placeholder="Worüber habt ihr gesprochen?"></textarea></label>
    <label>Anknüpfen beim nächsten Mal <textarea name="followUp" rows="3">${esc(c.followUp)}</textarea></label>
    <div class="actions">
      <button type="button" class="btn" data-close>Abbrechen</button>
      <button type="submit" class="btn primary">Speichern</button>
    </div>
  </form>`, m => {
    m.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const date = String(f.get('date')) || today();
      if (date > today()) return;
      if (!c.lastContact || date > c.lastContact) c.lastContact = date;
      c.followUp = String(f.get('followUp')).trim();
      c.history = [...(c.history || []), { id: newId(), date, note: String(f.get('note')).trim() }];
      await saveContact(c);
      closeModal();
      toast(`Kontakt mit ${c.name} eingetragen`);
      render();
    });
  });
}

// ---------- Dialog: WhatsApp-Chat importieren ----------

async function openChatImport(presetId) {
  const file = await pickFile('.txt,text/plain');
  if (!file) return;
  let chat;
  try {
    chat = parseWhatsAppChat(await file.text());
  } catch {
    openModal(`<div class="form">
      <h2>Format nicht erkannt</h2>
      <p>In der Datei „${esc(file.name)}“ wurden keine WhatsApp-Nachrichten gefunden.</p>
      <p>Bitte die <strong>.txt</strong>-Datei aus „Chat exportieren“ → „Ohne Medien“ wählen. Kommt sie als .zip, vorher entpacken.</p>
      <p class="muted">Falls es trotzdem nicht klappt: eine Beispielzeile mit erfundenem Namen und Text an Claude schicken, damit das Format ergänzt werden kann.</p>
      <div class="actions"><button class="btn primary" data-close>OK</button></div>
    </div>`);
    return;
  }

  const fromFile = nameFromFileName(file.name);
  const norm = normalizeName;
  let preset = presetId && byId(presetId) ? presetId : '';
  if (!preset && fromFile) preset = contacts.find(c => norm(c.name) === norm(fromFile))?.id || '';
  if (!preset) preset = contacts.find(c => chat.senders.some(s => norm(s.name) === norm(c.name)))?.id || '';
  const suggestion = fromFile || '';
  const selected = preset || (suggestion ? '__new__' : '');

  const options = [...contacts].sort(byName)
    .map(c => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

  openModal(`<form class="form" id="chat-form">
    <h2>WhatsApp-Chat</h2>
    <p class="muted small">Die Datei wird nur auf diesem Gerät gelesen. Gespeichert werden nur das Datum der letzten Nachricht und was Sie unten selbst eintragen, nicht der Chattext.</p>
    <dl class="facts">
      <dt>Nachrichten</dt><dd>${chat.count}</dd>
      <dt>Zeitraum</dt><dd>${formatDE(chat.firstDate)} – ${formatDE(chat.lastDate)}</dd>
      <dt>Letzte Nachricht</dt><dd>${formatDE(chat.lastDate)}, ${chat.lastTime} Uhr (${relativeDays(daysBetween(today(), chat.lastDate))})</dd>
      <dt>Teilnehmer</dt><dd>${chat.senders.map(s => `${esc(s.name)} (${s.count})`).join(', ')}</dd>
    </dl>
    <label>Zu Kontakt
      <select name="contact" required>
        <option value="" ${selected ? '' : 'selected'} disabled>Bitte wählen</option>
        ${options}
        <option value="__new__" ${selected === '__new__' ? 'selected' : ''}>＋ Neuen Kontakt anlegen</option>
      </select>
    </label>
    <label class="new-name" ${selected === '__new__' ? '' : 'hidden'}>Name des neuen Kontakts
      <input name="newName" value="${esc(suggestion)}">
    </label>
    <p class="hint" id="chat-hint"></p>
    <details open><summary>Letzte ${chat.recent.length} Nachrichten (nur Ansicht)</summary>
      <ol class="chat">${chat.recent.map(m => `<li><span class="meta">${formatDE(m.date)} ${m.time} · ${esc(m.sender)}</span>${esc(m.text)}</li>`).join('')}</ol>
    </details>
    <label>Notiz zum letzten Gespräch (optional)
      <textarea name="note" rows="2" placeholder="Wird mit Datum ${formatDE(chat.lastDate)} in die Historie eingetragen"></textarea>
    </label>
    <label>Anknüpfen beim nächsten Mal <textarea name="followUp" rows="3"></textarea></label>
    <p class="error" role="alert"></p>
    <div class="actions">
      <button type="button" class="btn" data-close>Abbrechen</button>
      <button type="submit" class="btn primary">Übernehmen</button>
    </div>
  </form>`, m => {
    const form = m.querySelector('form');
    const sel = form.elements.contact;
    const follow = form.elements.followUp;
    const hint = m.querySelector('#chat-hint');
    const update = () => {
      const c = byId(sel.value);
      m.querySelector('.new-name').hidden = sel.value !== '__new__';
      follow.value = c ? c.followUp : '';
      hint.textContent = c && c.lastContact && c.lastContact > chat.lastDate
        ? `Der gespeicherte letzte Kontakt (${formatDE(c.lastContact)}) ist neuer und bleibt erhalten.` : '';
    };
    sel.addEventListener('change', update);
    update();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = form.querySelector('.error');
      let c;
      if (sel.value === '__new__') {
        const name = form.elements.newName.value.trim();
        if (!name) { err.textContent = 'Bitte einen Namen für den neuen Kontakt eingeben.'; return; }
        c = newContact({ name });
      } else {
        c = byId(sel.value);
        if (!c) { err.textContent = 'Bitte einen Kontakt wählen.'; return; }
      }
      if (!c.lastContact || chat.lastDate > c.lastContact) c.lastContact = chat.lastDate;
      c.followUp = follow.value.trim();
      const note = form.elements.note.value.trim();
      if (note) c.history = [...(c.history || []), { id: newId(), date: chat.lastDate, note }];
      await saveContact(c);
      chat = null;
      closeModal();
      toast(`Chat übernommen: ${c.name}`);
      location.hash = `#/kontakt/${encodeURIComponent(c.id)}`;
      render();
    });
  });
}

// ---------- Kontakte hinzufügen: Telefonbuch und vCard ----------

async function pickFromPhonebook() {
  let picked;
  try {
    picked = await navigator.contacts.select(['name', 'tel'], { multiple: true });
  } catch {
    return toast('Auswahl abgebrochen');
  }
  const known = new Set(contacts.map(c => normalizeName(c.name)));
  const created = [];
  for (const p of picked || []) {
    const name = (p.name || []).find(Boolean)?.trim();
    if (!name || known.has(normalizeName(name))) continue;
    known.add(normalizeName(name));
    created.push(newContact({ name, phone: (p.tel || []).find(Boolean) || '' }));
  }
  if (created.length) await saveContacts(created);
  toast(created.length ? `${plural(created.length, 'Kontakt', 'Kontakte')} hinzugefügt` : 'Keine neuen Kontakte');
  render();
}

async function importVCard() {
  const file = await pickFile('.vcf,text/vcard,text/x-vcard');
  if (!file) return;
  const cards = parseVCards(await file.text());
  if (!cards.length) return toast('Keine Kontakte in der Datei gefunden');
  const known = new Map(contacts.map(c => [normalizeName(c.name), c]));
  const rows = cards.map((v, i) => {
    const ex = known.get(normalizeName(v.name));
    const adds = ex ? [!ex.phone && v.phone && 'Telefon', !ex.birthday && v.birthday && 'Geburtstag'].filter(Boolean) : [];
    const note = ex ? (adds.length ? `vorhanden – ergänzt: ${adds.join(', ')}` : 'schon vorhanden') : [v.phone, v.birthday && formatBirthday(v.birthday)].filter(Boolean).join(' · ');
    const disabled = ex && !adds.length;
    return `<li><label class="check"><input type="checkbox" name="pick" value="${i}" ${disabled ? 'disabled' : 'checked'}>
      <span><strong>${esc(v.name)}</strong><br><small class="muted">${esc(note)}</small></span></label></li>`;
  }).join('');
  openModal(`<form class="form" id="vcard-form">
    <h2>vCard-Import</h2>
    <p class="muted small">${plural(cards.length, 'Kontakt', 'Kontakte')} in „${esc(file.name)}“. Häkchen entfernen, wen Sie nicht übernehmen wollen.</p>
    <p><button type="button" class="btn-small" data-toggle-all>Alle an/aus</button></p>
    <ul class="checklist">${rows}</ul>
    <div class="actions">
      <button type="button" class="btn" data-close>Abbrechen</button>
      <button type="submit" class="btn primary">Übernehmen</button>
    </div>
  </form>`, m => {
    const boxes = () => [...m.querySelectorAll('input[name="pick"]:not(:disabled)')];
    m.querySelector('[data-toggle-all]').addEventListener('click', () => {
      const on = !boxes().every(b => b.checked);
      boxes().forEach(b => { b.checked = on; });
    });
    m.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const changed = [];
      for (const b of boxes().filter(x => x.checked)) {
        const v = cards[+b.value];
        const ex = known.get(normalizeName(v.name));
        if (ex) {
          if (!ex.phone && v.phone) ex.phone = v.phone;
          if (!ex.birthday && v.birthday) ex.birthday = v.birthday;
          changed.push(ex);
        } else {
          const c = newContact(v);
          known.set(normalizeName(v.name), c);
          changed.push(c);
        }
      }
      if (changed.length) await saveContacts(changed);
      closeModal();
      toast(`${plural(changed.length, 'Kontakt', 'Kontakte')} übernommen`);
      render();
    });
  });
}

// ---------- Datensicherung ----------

async function exportBackup() {
  const data = { app: 'connector', version: 1, exportedAt: new Date().toISOString(), settings, contacts };
  download(`connector-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
  lastBackup = today();
  await db.setMeta('lastBackup', lastBackup);
  toast('Sicherung gespeichert');
  render();
}

async function importBackup() {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
    if (data.app !== 'connector' || !Array.isArray(data.contacts)) throw new Error();
  } catch {
    return toast('Keine gültige CONNECTOR-Sicherung');
  }
  const incoming = data.contacts.filter(c => c && c.id && c.name);
  openModal(`<div class="form">
    <h2>Sicherung einspielen</h2>
    <p>${plural(incoming.length, 'Kontakt', 'Kontakte')} in der Datei vom ${formatDE(String(data.exportedAt).slice(0, 10))}. Auf diesem Gerät: ${contacts.length}.</p>
    <p class="muted small"><strong>Zusammenführen:</strong> neue Kontakte kommen hinzu, bei gleichen Kontakten gewinnt die neuere Fassung.<br>
    <strong>Ersetzen:</strong> alle Kontakte auf diesem Gerät werden durch die Datei ersetzt.</p>
    <div class="actions wrap">
      <button class="btn" data-close>Abbrechen</button>
      <button class="btn danger" data-mode="replace">Ersetzen</button>
      <button class="btn primary" data-mode="merge">Zusammenführen</button>
    </div>
  </div>`, m => {
    m.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', async () => {
      if (b.dataset.mode === 'replace') {
        if (!confirm(`Wirklich alle ${contacts.length} Kontakte auf diesem Gerät ersetzen?`)) return;
        await db.replaceContacts(incoming);
      } else {
        const cur = new Map(contacts.map(c => [c.id, c]));
        await db.putContacts(incoming.filter(c => !cur.has(c.id) || (c.updatedAt || '') > (cur.get(c.id).updatedAt || '')));
      }
      await reload();
      closeModal();
      toast('Sicherung eingespielt');
      render();
    }));
  });
}

function exportCalendar() {
  const withBday = contacts.filter(c => birthdayParts(c.birthday));
  if (!withBday.length) return toast('Keine Geburtstage eingetragen');
  download('connector-geburtstage.ics', birthdaysToICS(withBday), 'text/calendar');
  toast(`${plural(withBday.length, 'Geburtstag', 'Geburtstage')} exportiert`);
}

// ---------- Ansicht: Mehr ----------

async function renderMore() {
  setTab('mehr', 'Mehr');
  const withBday = contacts.filter(c => birthdayParts(c.birthday)).length;
  let persisted = null;
  try { persisted = await navigator.storage?.persisted?.(); } catch { /* nicht unterstützt */ }
  if (route().page !== 'mehr') return;
  show(`<section class="card">
      <h2>Kontakte hinzufügen</h2>
      <div class="actions wrap">
        <a class="btn" href="#/neu">Von Hand</a>
        ${pickerSupported ? '<button class="btn" data-action="picker">Aus Telefonbuch wählen</button>' : ''}
        <button class="btn" data-action="vcard">vCard-Datei (.vcf)</button>
      </div>
      ${pickerSupported ? '' : '<p class="muted small">Die Auswahl aus dem Telefonbuch gibt es nur in Chrome auf Android.</p>'}
    </section>
    <section class="card">
      <h2>WhatsApp</h2>
      <p class="muted small">In WhatsApp: Chat öffnen → ⋮ → Mehr → Chat exportieren → Ohne Medien → Datei speichern. Danach hier die .txt-Datei wählen.</p>
      <button class="btn" data-action="chat">Chat-Export importieren</button>
    </section>
    <section class="card">
      <h2>Kalender</h2>
      <p class="muted small">Geburtstage als Kalenderdatei (.ics) speichern und in Google Kalender importieren (calendar.google.com → Einstellungen → Importieren). Dann erinnert der Kalender auch, wenn die App geschlossen ist.</p>
      <button class="btn" data-action="ics" ${withBday ? '' : 'disabled'}>${plural(withBday, 'Geburtstag', 'Geburtstage')} exportieren</button>
    </section>
    <section class="card">
      <h2>Datensicherung</h2>
      <p class="muted small">Ihre Daten liegen nur in diesem Browser. Löschen Sie die Browserdaten oder wechseln Sie das Gerät, sind sie ohne Sicherung weg. Die Sicherungsdatei enthält alle Kontaktdaten: nicht hochladen und nicht unverschlüsselt verschicken.</p>
      <p>Letzte Sicherung: <strong>${lastBackup ? formatDE(lastBackup) : 'noch keine'}</strong></p>
      <div class="actions wrap">
        <button class="btn primary" data-action="backup">Sicherung speichern</button>
        <button class="btn" data-action="restore">Sicherung einspielen</button>
      </div>
    </section>
    <section class="card">
      <h2>Einstellungen</h2>
      <form id="settings-form" class="form">
        <label>Standard-Rhythmus für neue Kontakte (Tage)
          <input type="number" name="defaultRhythm" min="1" max="730" value="${settings.defaultRhythm}">
        </label>
        <label>Ländervorwahl für WhatsApp-Links (ohne +)
          <input name="countryCode" inputmode="numeric" value="${esc(settings.countryCode)}">
        </label>
      </form>
    </section>
    <section class="card">
      <h2>Speicher und Datenschutz</h2>
      <p class="small">${plural(contacts.length, 'Kontakt', 'Kontakte')} auf diesem Gerät.
        Dauerhafter Speicher: <strong>${persisted == null ? 'unbekannt' : persisted ? 'aktiv' : 'nicht bestätigt'}</strong></p>
      <p class="muted small">CONNECTOR hat keinen Server und sendet keine Daten. Kontaktdaten, Notizen und Chats bleiben in diesem Browser. Einzige Ausnahme: „WhatsApp öffnen“ ruft wa.me mit der Telefonnummer auf.</p>
      <button class="btn danger" data-action="wipe">Alle Daten auf diesem Gerät löschen</button>
    </section>
    <p class="muted small center">CONNECTOR ${APP_VERSION} · Code: github.com/lars-grahneis/CONNECTOR</p>`);
}

async function saveSettings(form) {
  const f = new FormData(form);
  const r = Number(f.get('defaultRhythm'));
  if (Number.isInteger(r) && r >= 1 && r <= 730) settings.defaultRhythm = r;
  const cc = String(f.get('countryCode')).replace(/\D/g, '');
  if (cc) settings.countryCode = cc;
  await db.setMeta('settings', settings);
  toast('Einstellungen gespeichert');
}

async function wipe() {
  if (!confirm('Alle Kontakte, Notizen und Einstellungen auf diesem Gerät löschen?')) return;
  if (!confirm('Wirklich? Das lässt sich ohne Sicherungsdatei nicht rückgängig machen.')) return;
  await db.clearAll();
  settings = { defaultRhythm: DEFAULT_RHYTHM, countryCode: '49' };
  lastBackup = null;
  await reload();
  toast('Alle Daten gelöscht');
  location.hash = '#/heute';
}

// ---------- Ereignisse ----------

const actions = {
  contacted: d => openContactedDialog(d.id),
  chat: d => openChatImport(d.id),
  picker: () => pickFromPhonebook(),
  vcard: () => importVCard(),
  ics: () => exportCalendar(),
  backup: () => exportBackup(),
  restore: () => importBackup(),
  wipe: () => wipe(),
  'delete-history': async d => {
    const c = byId(d.id);
    if (!c || !confirm('Diesen Eintrag löschen?')) return;
    c.history = (c.history || []).filter(h => h.id !== d.hid);
    await saveContact(c);
    render();
  },
  'delete-contact': async d => {
    const c = byId(d.id);
    if (!c || !confirm(`${c.name} mit allen Notizen löschen?`)) return;
    await db.deleteContact(c.id);
    await reload();
    toast('Kontakt gelöscht');
    location.hash = '#/kontakte';
  },
};

view.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  actions[el.dataset.action]?.(el.dataset);
});

view.addEventListener('input', e => {
  if (e.target.id === 'search') {
    listQuery = e.target.value;
    const list = view.querySelector('#list');
    list.innerHTML = listHtml(list.dataset.active);
  }
});

view.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'sort') {
    listSort = t.value;
    const list = view.querySelector('#list');
    list.innerHTML = listHtml(list.dataset.active);
  } else if (t.name === 'rhythm') {
    t.form.querySelector('.rhythm-custom').hidden = t.value !== 'custom';
  } else if (t.form?.id === 'settings-form') {
    saveSettings(t.form);
  }
});

view.addEventListener('submit', e => {
  if (e.target.id === 'edit-form') { e.preventDefault(); submitEdit(e.target); }
  if (e.target.id === 'settings-form') { e.preventDefault(); saveSettings(e.target); }
});

window.addEventListener('hashchange', render);
wide.addEventListener('change', render);

// Beim Zurückkehren in die App (z. B. am nächsten Tag) die Fälligkeiten neu berechnen
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !modalEl.open && route().page !== 'neu' && route().sub !== 'bearbeiten') render();
});

async function init() {
  try {
    await reload();
    settings = { ...settings, ...(await db.getMeta('settings')) };
    lastBackup = (await db.getMeta('lastBackup')) || null;
  } catch (err) {
    view.innerHTML = `<section class="empty"><h2>Speicher nicht verfügbar</h2>
      <p>Der Browser erlaubt keinen lokalen Speicher (z. B. im Inkognito-Modus). Bitte CONNECTOR in einem normalen Chrome-Fenster öffnen.</p></section>`;
    return;
  }
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
