// ---- Supabase クライアント初期化 ----
const sbClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

function isMobile() {
  return window.matchMedia('(pointer: coarse)').matches;
}

const state = {
  tasks: [],
  editingId: null,
  activePane: 'pending',
  selectedIndex: 0,
  searchQuery: '',
};

const els = {
  authScreen: document.getElementById('auth-screen'),
  authSub: document.getElementById('auth-sub'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  authSubmitBtn: document.getElementById('auth-submit-btn'),
  authMsg: document.getElementById('auth-msg'),
  authModeToggle: document.getElementById('auth-mode-toggle'),
  appRoot: document.getElementById('app-root'),
  userEmail: document.getElementById('user-email'),
  logoutBtn: document.getElementById('logout-btn'),

  input: document.getElementById('command-input'),
  prompt: document.getElementById('prompt'),
  editFlag: document.getElementById('edit-flag'),
  msg: document.getElementById('msg'),
  pendingList: document.getElementById('pending-list'),
  archivedList: document.getElementById('archived-list'),
  pendingCount: document.getElementById('pending-count'),
  archivedCount: document.getElementById('archived-count'),
  panePending: document.getElementById('pane-pending'),
  paneArchived: document.getElementById('pane-archived'),
  memoSection: document.getElementById('memo-section'),
  memoInput: document.getElementById('memo-input'),
  memoBackdrop: document.getElementById('memo-backdrop'),
  inputBackdrop: document.getElementById('input-backdrop'),
  searchline: document.getElementById('searchline'),
  searchInput: document.getElementById('search-input'),
  searchStatus: document.getElementById('search-status'),
  mobTabPending: document.getElementById('mobile-tab-pending'),
  mobTabArchived: document.getElementById('mobile-tab-archived'),
  mobCountPending: document.getElementById('mobile-count-pending'),
  mobCountArchived: document.getElementById('mobile-count-archived'),
  mobUp: document.getElementById('mob-up'),
  mobDown: document.getElementById('mob-down'),
  mobEdit: document.getElementById('mob-edit'),
  mobArchive: document.getElementById('mob-archive'),
  mobDelete: document.getElementById('mob-delete'),
  mobSearch: document.getElementById('mob-search'),
  csvExportBtn: document.getElementById('csv-export-btn'),
  csvImportBtn: document.getElementById('csv-import-btn'),
  csvFileInput: document.getElementById('csv-file-input'),
  snippetsBtn: document.getElementById('snippets-btn'),
  snippetsPanel: document.getElementById('snippets-panel'),
  snippetsList: document.getElementById('snippets-list'),
  snippetsFormTitle: document.getElementById('snippets-form-title'),
  snippetTriggerInput: document.getElementById('snippet-trigger-input'),
  snippetExpansionInput: document.getElementById('snippet-expansion-input'),
  snippetSaveBtn: document.getElementById('snippet-save-btn'),
  snippetNewBtn: document.getElementById('snippet-new-btn'),
  snippetsCloseBtn: document.getElementById('snippets-close-btn'),
};

// =========================================================
// 認証
// =========================================================

let authMode = 'login';
let realtimeChannel = null;

function setAuthMessage(text, type) {
  els.authMsg.textContent = text || '';
  els.authMsg.className = 'auth-msg' + (type ? ' ' + type : '');
}

els.authModeToggle.addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  els.authSubmitBtn.textContent = authMode === 'login' ? 'ログイン' : '新規登録';
  els.authModeToggle.textContent = authMode === 'login' ? '新規登録' : 'ログイン';
  els.authModeToggle.previousSibling.textContent = authMode === 'login'
    ? 'アカウントをお持ちでない場合は '
    : 'すでにアカウントをお持ちの場合は ';
  setAuthMessage('');
});

async function handleAuthSubmit() {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) {
    setAuthMessage('error: メールアドレスとパスワードを入力してください', 'error');
    return;
  }
  els.authSubmitBtn.disabled = true;
  try {
    if (authMode === 'login') {
      const { error } = await sbClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { data, error } = await sbClient.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session === null) {
        setAuthMessage('確認メールを送信しました。メール内のリンクを開いてからログインしてください。', 'ok');
      }
    }
  } catch (err) {
    setAuthMessage(`error: ${err.message}`, 'error');
  } finally {
    els.authSubmitBtn.disabled = false;
  }
}

els.authSubmitBtn.addEventListener('click', handleAuthSubmit);
[els.authEmail, els.authPassword].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAuthSubmit();
    }
  });
});

els.logoutBtn.addEventListener('click', async () => {
  await sbClient.auth.signOut();
});

function subscribeRealtime(userId) {
  if (realtimeChannel) {
    sbClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeChannel = sbClient
    .channel('tasks-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` }, () => {
      fetchTasks();
    })
    .subscribe();
}

function showApp(session) {
  els.authScreen.classList.add('hidden');
  els.appRoot.classList.remove('hidden');
  els.userEmail.textContent = session.user.email;
  subscribeRealtime(session.user.id);
  fetchTasks();
  fetchSnippets();
  els.input.focus();
}

function showAuth() {
  els.appRoot.classList.add('hidden');
  els.authScreen.classList.remove('hidden');
  if (realtimeChannel) {
    sbClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  state.tasks = [];
}

sbClient.auth.onAuthStateChange((_event, session) => {
  if (session) showApp(session);
  else showAuth();
});

// =========================================================
// ユーティリティ
// =========================================================

function pad2(n) { return String(n).padStart(2, '0'); }

function todayDateStr() {
  const now = new Date();
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
}

function nowTimeStr() {
  const now = new Date();
  return `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
}

function taskStart(task) {
  return new Date(
    Number(task.date_str.slice(0, 4)), Number(task.date_str.slice(4, 6)) - 1, Number(task.date_str.slice(6, 8)),
    Number(task.time_str.slice(0, 2)), Number(task.time_str.slice(2, 4)),
  );
}

function taskEnd(task) {
  return new Date(taskStart(task).getTime() + task.duration * 3600 * 1000);
}

function formatTime(task) {
  return `${task.time_str.slice(0, 2)}:${task.time_str.slice(2, 4)}`;
}

function endTimeStr(task) {
  const end = taskEnd(task);
  return `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
}

function formatDate(dateStr) {
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// コマンド文字列の書式: <タスク名...> [-t <タグ>] [-d <YYYYMMDD>] [-h <HHMM>] [所要時間(h)]
// 省略時デフォルト: タグ=なし, 日付=当日, 時刻=現在時刻, 所要時間=0
function parseCommand(command) {
  const tokens = command.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error('コマンドが空です');
  }

  const titleParts = [];
  let tag = null;
  let dateStr = null;
  let timeStr = null;
  let duration = null;

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === '-t') {
      tag = tokens[i + 1];
      if (tag === undefined) throw new Error('-t の後にタグを指定してください');
      i += 2;
    } else if (tok === '-d') {
      dateStr = tokens[i + 1];
      if (dateStr === undefined) throw new Error('-d の後に日付(YYYYMMDD)を指定してください');
      i += 2;
    } else if (tok === '-h') {
      timeStr = tokens[i + 1];
      if (timeStr === undefined) throw new Error('-h の後に時刻(HHMM)を指定してください');
      i += 2;
    } else if (/^-/.test(tok) && !/^-?\d+(\.\d+)?$/.test(tok)) {
      throw new Error(`不明なオプションです: ${tok}`);
    } else if (duration === null && /^\d+(\.\d+)?$/.test(tok) && i === tokens.length - 1) {
      duration = parseFloat(tok);
      i += 1;
    } else {
      titleParts.push(tok);
      i += 1;
    }
  }

  const title = titleParts.join(' ').trim();
  if (!title) throw new Error('タスク名を指定してください');

  if (!dateStr) {
    dateStr = todayDateStr();
  } else if (!/^\d{8}$/.test(dateStr)) {
    throw new Error('-d は YYYYMMDD 形式で指定してください');
  }

  if (!timeStr) {
    timeStr = nowTimeStr();
  } else if (!/^\d{4}$/.test(timeStr)) {
    throw new Error('-h は HHMM 形式で指定してください');
  }

  if (duration === null) duration = 0;
  if (!(duration >= 0)) throw new Error('所要時間は0以上の数値で指定してください');

  const month = parseInt(dateStr.slice(4, 6), 10);
  const day = parseInt(dateStr.slice(6, 8), 10);
  const hour = parseInt(timeStr.slice(0, 2), 10);
  const minute = parseInt(timeStr.slice(2, 4), 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error('日付が不正です');
  if (hour > 23 || minute > 59) throw new Error('時刻が不正です');

  return { title, tag: tag || null, date_str: dateStr, time_str: timeStr, duration };
}

function appendHighlighted(el, text, query) {
  if (!query) {
    el.appendChild(document.createTextNode(text));
    return;
  }
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let start = 0;
  let idx;
  while ((idx = lowerText.indexOf(lowerQuery, start)) !== -1) {
    if (idx > start) el.appendChild(document.createTextNode(text.slice(start, idx)));
    const mark = document.createElement('mark');
    mark.className = 'hit';
    mark.textContent = text.slice(idx, idx + query.length);
    el.appendChild(mark);
    start = idx + query.length;
  }
  el.appendChild(document.createTextNode(text.slice(start)));
}

function taskMatches(task, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (task.title && task.title.toLowerCase().includes(q))
    || (task.tag && task.tag.toLowerCase().includes(q))
    || (task.memo && task.memo.toLowerCase().includes(q));
}

function compareTasks(a, b) {
  return new Date(b.created_at) - new Date(a.created_at);
}

function splitTasks() {
  const pending = [];
  const archived = [];
  for (const t of state.tasks) {
    if (!taskMatches(t, state.searchQuery)) continue;
    if (t.archived) archived.push(t);
    else pending.push(t);
  }
  pending.sort(compareTasks);
  archived.sort(compareTasks);
  return { pending, archived };
}

function setMessage(text, type) {
  els.msg.textContent = text || '';
  els.msg.className = 'msg' + (type ? ' ' + type : '');
}

function buildCommandString(task) {
  const parts = [task.title];
  if (task.tag) parts.push('-t', task.tag);
  parts.push('-d', task.date_str, '-h', task.time_str, String(task.duration));
  return parts.join(' ');
}

// =========================================================
// レンダリング
// =========================================================

function renderList(container, tasks, paneName, isPending) {
  container.innerHTML = '';
  if (tasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-row';
    empty.textContent = '(タスクなし)';
    container.appendChild(empty);
    return;
  }
  const now = new Date();
  tasks.forEach((task, idx) => {
    const row = document.createElement('div');
    const overdue = isPending && taskStart(task) <= now;
    row.className = 'task-row' + (overdue ? ' overdue' : '');
    if (state.activePane === paneName && state.selectedIndex === idx) {
      row.classList.add('selected');
    }
    row.dataset.id = task.id;

    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    cursor.textContent = (state.activePane === paneName && state.selectedIndex === idx) ? '>' : '';

    const title = document.createElement('span');
    title.className = 'title';
    appendHighlighted(title, task.title, state.searchQuery);

    const tag = document.createElement('span');
    tag.className = 'tag';
    if (task.tag) {
      tag.appendChild(document.createTextNode('#'));
      appendHighlighted(tag, task.tag, state.searchQuery);
    }

    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = formatDate(task.date_str);

    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = `${formatTime(task)}-${endTimeStr(task)}`;

    const created = document.createElement('span');
    created.className = 'meta';
    created.textContent = `作成:${formatDateTime(task.created_at)}`;

    const updated = document.createElement('span');
    updated.className = 'meta';
    if (task.updated_at && task.updated_at !== task.created_at) {
      updated.textContent = `更新:${formatDateTime(task.updated_at)}`;
    }

    row.append(cursor, title, tag, date, time, created, updated);
    row.addEventListener('click', () => {
      state.activePane = paneName;
      state.selectedIndex = idx;
      if (!isMobile()) {
        els.input.blur();
      }
      render();
    });
    container.appendChild(row);
  });
}

function render() {
  const { pending, archived } = splitTasks();
  els.pendingCount.textContent = `(${pending.length})`;
  els.archivedCount.textContent = `(${archived.length})`;

  if (state.activePane === 'pending') {
    state.selectedIndex = clamp(state.selectedIndex, pending.length);
  } else {
    state.selectedIndex = clamp(state.selectedIndex, archived.length);
  }

  renderList(els.pendingList, pending, 'pending', true);
  renderList(els.archivedList, archived, 'archived', false);

  if (state.searchQuery) {
    els.searchStatus.textContent = `${pending.length + archived.length}件ヒット`;
  } else {
    els.searchStatus.textContent = '';
  }

  if (isMobile()) {
    els.panePending.classList.toggle('mobile-visible', state.activePane === 'pending');
    els.paneArchived.classList.toggle('mobile-visible', state.activePane === 'archived');
    els.mobTabPending.classList.toggle('active', state.activePane === 'pending');
    els.mobTabArchived.classList.toggle('active', state.activePane === 'archived');
    els.mobCountPending.textContent = `(${pending.length})`;
    els.mobCountArchived.textContent = `(${archived.length})`;
    els.mobEdit.textContent = state.editingId ? '保存' : 'edit';
    els.mobArchive.textContent = state.activePane === 'archived' ? 'pend' : 'arch';
    const inSearch = !els.searchline.classList.contains('hidden');
    els.mobSearch.textContent = (state.editingId || inSearch) ? 'Esc' : '/';
  }

  return { pending, archived };
}

function clamp(idx, len) {
  if (len === 0) return 0;
  if (idx < 0) return 0;
  if (idx >= len) return len - 1;
  return idx;
}

function currentSelectedTask() {
  const { pending, archived } = splitTasks();
  const list = state.activePane === 'pending' ? pending : archived;
  return list[state.selectedIndex] || null;
}

// =========================================================
// Supabase 経由のタスク操作
// =========================================================

async function fetchTasks() {
  const { data, error } = await sbClient.from('tasks').select('*');
  if (error) {
    setMessage(`error: ${error.message}`, 'error');
    return;
  }
  state.tasks = data;
  render();
}

async function submitCommand() {
  const command = els.input.value.trim();
  if (!command) return;
  const isEdit = !!state.editingId;
  try {
    const parsed = parseCommand(command);
    if (isEdit) {
      const { data, error } = await sbClient
        .from('tasks')
        .update({
          title: parsed.title,
          tag: parsed.tag,
          date_str: parsed.date_str,
          time_str: parsed.time_str,
          duration: parsed.duration,
          memo: els.memoInput.value,
        })
        .eq('id', state.editingId)
        .select()
        .single();
      if (error) throw error;
      setMessage(`updated: ${data.title}`, 'ok');
    } else {
      const { data, error } = await sbClient
        .from('tasks')
        .insert({
          title: parsed.title,
          tag: parsed.tag,
          date_str: parsed.date_str,
          time_str: parsed.time_str,
          duration: parsed.duration,
          memo: '',
          archived: false,
        })
        .select()
        .single();
      if (error) throw error;
      setMessage(`created: ${data.title}`, 'ok');
    }
    exitEditMode();
    await fetchTasks();
  } catch (err) {
    setMessage(`error: ${err.message}`, 'error');
  }
}

async function toggleArchive(task) {
  const { data, error } = await sbClient
    .from('tasks')
    .update({ archived: !task.archived })
    .eq('id', task.id)
    .select()
    .single();
  if (error) {
    setMessage(`error: ${error.message}`, 'error');
    return;
  }
  setMessage(data.archived ? `archived: ${data.title}` : `unarchived: ${data.title}`, 'ok');
  await fetchTasks();
}

async function deleteTask(task) {
  const { error } = await sbClient.from('tasks').delete().eq('id', task.id);
  if (error) {
    setMessage(`error: ${error.message}`, 'error');
    return;
  }
  setMessage(`deleted: ${task.title}`, 'ok');
  if (state.editingId === task.id) exitEditMode();
  await fetchTasks();
}

// =========================================================
// テキストスパンディング (Supabase DB、全端末で共有)
// =========================================================

let snippets = {};
let editingSnippetTrigger = null;

async function fetchSnippets() {
  const { data, error } = await sbClient.from('snippets').select('trigger, expansion');
  if (error) { setMessage(`error: ${error.message}`, 'error'); return; }
  snippets = {};
  for (const row of data) snippets[row.trigger] = row.expansion;
  renderSnippetsList();
}

async function saveSnippet(trig, expansion, oldTrig) {
  if (oldTrig && oldTrig !== trig) {
    await sbClient.from('snippets').delete().eq('trigger', oldTrig);
    const { error } = await sbClient.from('snippets').insert({ trigger: trig, expansion });
    if (error) { setMessage(`error: ${error.message}`, 'error'); return; }
  } else if (Object.prototype.hasOwnProperty.call(snippets, trig)) {
    const { error } = await sbClient.from('snippets').update({ expansion }).eq('trigger', trig);
    if (error) { setMessage(`error: ${error.message}`, 'error'); return; }
  } else {
    const { error } = await sbClient.from('snippets').insert({ trigger: trig, expansion });
    if (error) { setMessage(`error: ${error.message}`, 'error'); return; }
  }
  await fetchSnippets();
}

async function deleteSnippet(trig) {
  const { error } = await sbClient.from('snippets').delete().eq('trigger', trig);
  if (error) { setMessage(`error: ${error.message}`, 'error'); return; }
  await fetchSnippets();
}

function resetSnippetForm() {
  editingSnippetTrigger = null;
  els.snippetsFormTitle.textContent = '# 新規作成';
  els.snippetTriggerInput.value = '';
  els.snippetExpansionInput.value = '';
}

function loadSnippetIntoForm(trig) {
  editingSnippetTrigger = trig;
  els.snippetsFormTitle.textContent = `# 編集: ${trig}`;
  els.snippetTriggerInput.value = trig;
  els.snippetExpansionInput.value = snippets[trig];
  els.snippetTriggerInput.focus();
}

function renderSnippetsList() {
  els.snippetsList.innerHTML = '';
  const keys = Object.keys(snippets).sort();
  if (keys.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'snippets-empty';
    empty.textContent = '(スニペットはまだありません)';
    els.snippetsList.appendChild(empty);
    return;
  }
  keys.forEach((trig) => {
    const expansion = snippets[trig];
    const lines = expansion.split('\n');
    const row = document.createElement('div');
    row.className = 'snippet-row';

    const trigSpan = document.createElement('span');
    trigSpan.className = 'snippet-trigger';
    trigSpan.textContent = trig;

    const previewSpan = document.createElement('span');
    previewSpan.className = 'snippet-preview';
    previewSpan.textContent = lines[0] + (lines.length > 1 ? ` …(全${lines.length}行)` : '');

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'tool-btn small';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => loadSnippetIntoForm(trig));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'tool-btn small';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', async () => {
      if (editingSnippetTrigger === trig) resetSnippetForm();
      await deleteSnippet(trig);
      setMessage(`snippet deleted: ${trig}`, 'ok');
    });

    row.append(trigSpan, previewSpan, editBtn, delBtn);
    els.snippetsList.appendChild(row);
  });
}

// 組み込み動的スニペット（ユーザー定義で上書き可）
const BUILTIN_SNIPPETS = {
  ';today': () => todayDateStr(),
  ';now': () => { const n = new Date(); return `${pad2(n.getHours())}:${pad2(n.getMinutes())}`; },
};

function tryExpandSnippet(el) {
  if (el.selectionStart !== el.selectionEnd) return false;
  const value = el.value;
  const caret = el.selectionStart;
  const before = value.slice(0, caret);

  // ユーザー定義を優先し、組み込みをフォールバックとして結合
  const seen = new Set();
  const triggers = [
    ...Object.keys(snippets).sort((a, b) => b.length - a.length),
    ...Object.keys(BUILTIN_SNIPPETS),
  ].filter((t) => { if (seen.has(t)) return false; seen.add(t); return true; });

  for (const trig of triggers) {
    if (!trig || !before.endsWith(trig)) continue;
    const startIdx = caret - trig.length;
    const charBefore = startIdx > 0 ? before[startIdx - 1] : '';
    if (startIdx === 0 || /\s/.test(charBefore)) {
      const expansion = Object.prototype.hasOwnProperty.call(snippets, trig)
        ? snippets[trig]
        : BUILTIN_SNIPPETS[trig]();

      // | をカーソル位置マーカーとして処理
      const cursorIdx = expansion.indexOf('|');
      let newText, newCaret;
      if (cursorIdx !== -1) {
        const clean = expansion.slice(0, cursorIdx) + expansion.slice(cursorIdx + 1);
        newText = value.slice(0, startIdx) + clean + value.slice(caret);
        newCaret = startIdx + cursorIdx;
      } else {
        newText = value.slice(0, startIdx) + expansion + value.slice(caret);
        newCaret = startIdx + expansion.length;
      }

      el.value = newText;
      el.setSelectionRange(newCaret, newCaret);
      return true;
    }
  }
  return false;
}

// =========================================================
// 検索ハイライト用バックドロップ
// =========================================================

function renderInputBackdrop() {
  els.inputBackdrop.innerHTML = '';
  appendHighlighted(els.inputBackdrop, els.input.value, state.searchQuery);
}

function renderMemoBackdrop() {
  els.memoBackdrop.innerHTML = '';
  appendHighlighted(els.memoBackdrop, els.memoInput.value, state.searchQuery);
  els.memoBackdrop.scrollTop = els.memoInput.scrollTop;
  els.memoBackdrop.scrollLeft = els.memoInput.scrollLeft;
}

// =========================================================
// 編集モード
// =========================================================

function enterEditMode(task) {
  state.editingId = task.id;
  els.input.value = buildCommandString(task);
  els.prompt.textContent = '(edit)$';
  els.editFlag.classList.remove('hidden');
  els.memoSection.classList.remove('hidden');
  els.memoInput.value = task.memo || '';
  setMessage('');
  renderInputBackdrop();
  renderMemoBackdrop();
  render();

  const query = state.searchQuery;
  if (query) {
    const q = query.toLowerCase();
    const memoIdx = (task.memo || '').toLowerCase().indexOf(q);
    const cmdIdx = els.input.value.toLowerCase().indexOf(q);
    if (cmdIdx !== -1) {
      els.input.focus();
      els.input.setSelectionRange(cmdIdx, cmdIdx + query.length);
      return;
    }
    if (memoIdx !== -1) {
      els.memoInput.focus();
      els.memoInput.setSelectionRange(memoIdx, memoIdx + query.length);
      renderMemoBackdrop();
      return;
    }
  }
  els.input.focus();
  els.input.select();
}

function exitEditMode() {
  state.editingId = null;
  els.input.value = '';
  els.prompt.textContent = '$';
  els.editFlag.classList.add('hidden');
  els.memoSection.classList.add('hidden');
  els.memoInput.value = '';
  renderInputBackdrop();
  renderMemoBackdrop();
  render();
}

// =========================================================
// CSV エクスポート / インポート
// =========================================================

const CSV_HEADERS = ['title', 'tag', 'date', 'time', 'duration', 'memo', 'archived', 'createdAt', 'updatedAt'];

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function tasksToCsv(tasks) {
  const rows = tasks.map((t) => [
    t.title, t.tag || '', t.date_str, t.time_str, String(t.duration),
    t.memo || '', t.archived ? 'true' : 'false', t.created_at, t.updated_at,
  ]);
  return [CSV_HEADERS, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      // skip; \n handles line breaks
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function csvRowsToItems(rows) {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const colIdx = (name) => header.indexOf(name);
  const items = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (name) => { const i = colIdx(name); return i === -1 ? '' : (row[i] || ''); };
    const title = get('title').trim();
    if (!title) continue;

    let dateStr = get('date').trim();
    if (!dateStr) dateStr = todayDateStr();
    let timeStr = get('time').trim();
    if (!timeStr) timeStr = nowTimeStr();
    let duration = parseFloat(get('duration') || '0');
    if (!Number.isFinite(duration) || duration < 0) duration = 0;

    items.push({
      title,
      tag: get('tag').trim() || null,
      date_str: dateStr,
      time_str: timeStr,
      duration,
      memo: get('memo') || '',
      archived: /^(true|1|yes)$/i.test(get('archived')),
    });
  }
  return items;
}

function exportCsv() {
  const { pending, archived } = splitTasks();
  const all = [...pending, ...archived];
  if (all.length === 0) {
    setMessage('error: 書き出せるタスクがありません', 'error');
    return;
  }
  const csv = tasksToCsv(all);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks_${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setMessage(`exported: ${all.length}件${state.searchQuery ? `(検索中: "${state.searchQuery}")` : ''}`, 'ok');
}

async function importCsvFile(file) {
  const text = await file.text();
  const items = csvRowsToItems(parseCsv(text));
  if (items.length === 0) {
    setMessage('error: 有効なタスクが見つかりませんでした', 'error');
    return;
  }
  const { data, error } = await sbClient.from('tasks').insert(items).select();
  if (error) {
    setMessage(`error: ${error.message}`, 'error');
    return;
  }
  setMessage(`imported: ${data.length}件`, 'ok');
  await fetchTasks();
}

// =========================================================
// イベント配線
// =========================================================

els.input.addEventListener('input', () => {
  tryExpandSnippet(els.input);
  renderInputBackdrop();
});
els.input.addEventListener('scroll', () => {
  els.inputBackdrop.scrollLeft = els.input.scrollLeft;
});

els.memoInput.addEventListener('input', () => {
  tryExpandSnippet(els.memoInput);
  renderMemoBackdrop();
});
els.memoInput.addEventListener('scroll', () => {
  els.memoBackdrop.scrollTop = els.memoInput.scrollTop;
  els.memoBackdrop.scrollLeft = els.memoInput.scrollLeft;
});

els.csvExportBtn.addEventListener('click', exportCsv);
els.csvImportBtn.addEventListener('click', () => els.csvFileInput.click());
els.csvFileInput.addEventListener('change', async () => {
  const file = els.csvFileInput.files[0];
  if (file) await importCsvFile(file);
  els.csvFileInput.value = '';
});

els.snippetsBtn.addEventListener('click', () => {
  const opening = els.snippetsPanel.classList.contains('hidden');
  els.snippetsPanel.classList.toggle('hidden');
  if (opening) {
    renderSnippetsList();
    resetSnippetForm();
  }
});
els.snippetSaveBtn.addEventListener('click', async () => {
  const trig = els.snippetTriggerInput.value.trim();
  const expansion = els.snippetExpansionInput.value;
  if (!trig) {
    setMessage('error: トリガーを入力してください', 'error');
    return;
  }
  const oldTrig = editingSnippetTrigger;
  resetSnippetForm();
  await saveSnippet(trig, expansion, oldTrig);
  setMessage(`snippet saved: ${trig}`, 'ok');
});
els.snippetNewBtn.addEventListener('click', resetSnippetForm);
els.snippetsCloseBtn.addEventListener('click', () => {
  els.snippetsPanel.classList.add('hidden');
});

els.snippetTriggerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    els.snippetSaveBtn.click();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    els.snippetsPanel.classList.add('hidden');
    els.snippetTriggerInput.blur();
  }
});

els.snippetExpansionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    els.snippetSaveBtn.click();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    els.snippetsPanel.classList.add('hidden');
    els.snippetExpansionInput.blur();
  }
});

els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitCommand();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    exitEditMode();
    setMessage('');
    els.input.blur();
  }
});

els.memoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    submitCommand();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    exitEditMode();
    setMessage('');
    els.memoInput.blur();
  }
});

els.searchInput.addEventListener('input', () => {
  state.searchQuery = els.searchInput.value;
  state.selectedIndex = 0;
  render();
});

els.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    els.searchInput.blur();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    state.searchQuery = '';
    els.searchInput.value = '';
    els.searchline.classList.add('hidden');
    els.searchInput.blur();
    render();
  }
});

const KEY_NAV_EXEMPT_ELEMENTS = [
  () => els.input,
  () => els.memoInput,
  () => els.searchInput,
  () => els.snippetTriggerInput,
  () => els.snippetExpansionInput,
];

window.addEventListener('keydown', (e) => {
  if (els.appRoot.classList.contains('hidden')) return;
  if (KEY_NAV_EXEMPT_ELEMENTS.some((get) => document.activeElement === get())) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const { pending, archived } = splitTasks();
    const len = state.activePane === 'pending' ? pending.length : archived.length;
    state.selectedIndex = clamp(state.selectedIndex + 1, len);
    render();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const { pending, archived } = splitTasks();
    const len = state.activePane === 'pending' ? pending.length : archived.length;
    state.selectedIndex = clamp(state.selectedIndex - 1, len);
    render();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    state.activePane = 'pending';
    render();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    state.activePane = 'archived';
    render();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const task = currentSelectedTask();
    if (task) enterEditMode(task);
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    const task = currentSelectedTask();
    if (task) deleteTask(task);
  } else if (e.key === 'a' || e.key === 'A') {
    e.preventDefault();
    const task = currentSelectedTask();
    if (task) toggleArchive(task);
  } else if (e.key === '/') {
    e.preventDefault();
    els.searchline.classList.remove('hidden');
    els.searchInput.focus();
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    els.input.focus();
  }
});

// =========================================================
// モバイルツールバー
// =========================================================

els.mobTabPending.addEventListener('click', () => {
  state.activePane = 'pending';
  render();
});

els.mobTabArchived.addEventListener('click', () => {
  state.activePane = 'archived';
  render();
});

els.mobUp.addEventListener('click', () => {
  const { pending, archived } = splitTasks();
  const len = state.activePane === 'pending' ? pending.length : archived.length;
  state.selectedIndex = clamp(state.selectedIndex - 1, len);
  render();
  const list = state.activePane === 'pending' ? els.pendingList : els.archivedList;
  list.querySelector('.task-row.selected')?.scrollIntoView({ block: 'nearest' });
});

els.mobDown.addEventListener('click', () => {
  const { pending, archived } = splitTasks();
  const len = state.activePane === 'pending' ? pending.length : archived.length;
  state.selectedIndex = clamp(state.selectedIndex + 1, len);
  render();
  const list = state.activePane === 'pending' ? els.pendingList : els.archivedList;
  list.querySelector('.task-row.selected')?.scrollIntoView({ block: 'nearest' });
});

els.mobEdit.addEventListener('click', () => {
  if (state.editingId) {
    submitCommand();
  } else {
    const task = currentSelectedTask();
    if (task) enterEditMode(task);
  }
});

els.mobArchive.addEventListener('click', () => {
  const task = currentSelectedTask();
  if (task) toggleArchive(task);
});

els.mobDelete.addEventListener('click', () => {
  const task = currentSelectedTask();
  if (task && confirm(`削除しますか?\n"${task.title}"`)) deleteTask(task);
});

els.mobSearch.addEventListener('click', () => {
  if (state.editingId) {
    exitEditMode();
    setMessage('');
    els.input.blur();
  } else if (!els.searchline.classList.contains('hidden')) {
    state.searchQuery = '';
    els.searchInput.value = '';
    els.searchline.classList.add('hidden');
    els.searchInput.blur();
    render();
  } else {
    els.searchline.classList.remove('hidden');
    els.searchInput.focus();
  }
});

renderInputBackdrop();
renderMemoBackdrop();
