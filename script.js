const STORAGE_KEY = "ADV_TODO_FINAL_V1";

/* ---------- STATE ---------- */
let state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  lists: [],
  todos: [],
  selected: [],
  currentView: { type: "list", id: null }
};

/* ---------- HELPERS ---------- */
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const today = () => new Date().toISOString().split("T")[0];
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

/* ---------- INIT ---------- */
(async function init() {
  $("loader").hidden = false;
  await new Promise(r => setTimeout(r, 1000)); // fake fetch
  $("loader").hidden = true;
  $("todoArea").hidden = false;

  if (state.lists.length === 0) {
    const id = uid();
    state.lists.push({ id, name: "Personal", color: "#2563eb", icon: "📁", archived: false });
    state.currentView = { type: "list", id };
  }
  save();
  renderAll();
  requestNotifications();
})();

/* ---------- LISTS ---------- */
function renderLists() {
  const c = $("listContainer");
  c.innerHTML = "";
  state.lists.filter(l => !l.archived).forEach(l => {
    const li = document.createElement("li");
    li.textContent = `${l.icon} ${l.name}`;
    if (state.currentView.id === l.id) li.classList.add("active");
    li.onclick = () => {
      state.currentView = { type: "list", id: l.id };
      state.selected = [];
      renderAll();
    };
    c.appendChild(li);
  });

  // bulk move
  $("bulkMoveSelect").innerHTML = `<option value="">Move to list</option>`;
  state.lists.forEach(l => {
    const o = document.createElement("option");
    o.value = l.id;
    o.textContent = l.name;
    $("bulkMoveSelect").appendChild(o);
  });
}

$("addListBtn").onclick = () => {
  const name = prompt("List name");
  if (!name) return;
  state.lists.push({ id: uid(), name, color: "#22c55e", icon: "📁", archived: false });
  save();
  renderLists();
};

/* ---------- SMART LISTS ---------- */
const SMART = {
  today: t => t.dueDate === today(),
  upcoming: t => t.dueDate && new Date(t.dueDate) > new Date(),
  overdue: t => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed,
  high: t => t.priority === "high",
  nodue: t => !t.dueDate
};

function renderSmartLists() {
  const c = $("smartListContainer");
  c.innerHTML = "";
  Object.keys(SMART).forEach(k => {
    const li = document.createElement("li");
    li.textContent = k.toUpperCase();
    li.onclick = () => {
      state.currentView = { type: "smart", id: k };
      state.selected = [];
      renderAll();
    };
    c.appendChild(li);
  });
}

/* ---------- TODOS ---------- */
$("todoForm").onsubmit = e => {
  e.preventDefault();
  state.todos.push({
    id: uid(),
    listId: state.currentView.id,
    title: $("todoTitle").value,
    dueDate: $("todoDueDate").value || null,
    priority: $("todoPriority").value,
    assignedTo: $("assignedTo").value,
    description: "",
    reminder: $("todoDueDate").value,
    completed: false,
    subtasks: []
  });
  e.target.reset();
  save();
  scheduleNotifications();
  renderTodos();
};

function getVisibleTodos() {
  if (state.currentView.type === "list") {
    return state.todos.filter(t => t.listId === state.currentView.id);
  }
  return state.todos.filter(SMART[state.currentView.id]);
}

function renderTodos() {
  const ul = $("todoList");
  ul.innerHTML = "";
  const todos = getVisibleTodos();
  $("emptyState").style.display = todos.length ? "none" : "block";

  todos.forEach(t => {
    const li = document.createElement("li");
    li.innerHTML = `
      <input type="checkbox" ${t.completed ? "checked" : ""}>
      ${t.title} (${t.priority})
      <input type="checkbox" class="select">
    `;
    li.querySelector("input[type=checkbox]").onchange = e => {
      t.completed = e.target.checked;
      save();
      renderTodos();
    };
    li.querySelector(".select").onchange = e => {
      e.target.checked ? state.selected.push(t.id) :
        state.selected = state.selected.filter(i => i !== t.id);
      renderBulk();
    };
    ul.appendChild(li);
  });
}

/* ---------- BULK ---------- */
function renderBulk() {
  $("bulkBar").hidden = state.selected.length === 0;
  $("bulkCount").textContent = `${state.selected.length} selected`;
}

$("bulkDeleteBtn").onclick = () => {
  state.todos = state.todos.filter(t => !state.selected.includes(t.id));
  state.selected = [];
  save();
  renderAll();
};

$("bulkCompleteBtn").onclick = () => bulk(t => t.completed = true);
$("bulkUncompleteBtn").onclick = () => bulk(t => t.completed = false);

$("bulkMoveSelect").onchange = e => {
  bulk(t => t.listId = e.target.value);
};

$("bulkPrioritySelect").onchange = e => {
  bulk(t => t.priority = e.target.value);
};

function bulk(fn) {
  state.todos.forEach(t => state.selected.includes(t.id) && fn(t));
  state.selected = [];
  save();
  renderAll();
}

/* ---------- SEARCH (DEBOUNCE) ---------- */
let d;
$("searchInput").oninput = e => {
  clearTimeout(d);
  d = setTimeout(() => {
    const q = e.target.value.toLowerCase();
    const filtered = getVisibleTodos().filter(t => t.title.toLowerCase().includes(q));
    $("todoList").innerHTML = "";
    filtered.forEach(t => $("todoList").appendChild(document.createTextNode(t.title)));
  }, 300);
};

/* ---------- NOTIFICATIONS ---------- */
function requestNotifications() {
  if ("Notification" in window) Notification.requestPermission();
}

function scheduleNotifications() {
  state.todos.forEach(t => {
    if (!t.dueDate) return;
    const time = new Date(t.dueDate).getTime() - Date.now();
    setTimeout(() => new Notification("Todo Due Soon", { body: t.title }), time - 3600000);
    setTimeout(() => new Notification("Todo Overdue", { body: t.title }), time);
  });
}

/* ---------- CALENDAR ---------- */
$("monthViewBtn").onclick = () => showCalendar();
$("todayViewBtn").onclick = () => {
  state.currentView = { type: "smart", id: "today" };
  renderAll();
};

function showCalendar() {
  $("todoArea").hidden = true;
  $("calendarArea").hidden = false;
  $("calendarGrid").innerHTML = "";
  for (let i = 1; i <= 30; i++) {
    const c = document.createElement("div");
    c.textContent = i;
    state.todos.filter(t => t.dueDate && new Date(t.dueDate).getDate() === i)
      .forEach(t => c.innerHTML += `<div>${t.title}</div>`);
    $("calendarGrid").appendChild(c);
  }
}

/* ---------- EXPORT / IMPORT ---------- */
$("exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "todos.json";
  a.click();
};

$("importInput").onchange = e => {
  const r = new FileReader();
  r.onload = () => {
    state = JSON.parse(r.result);
    save();
    renderAll();
  };
  r.readAsText(e.target.files[0]);
};

/* ---------- RENDER ---------- */
function renderAll() {
  save();
  renderLists();
  renderSmartLists();
  renderTodos();
  renderBulk();
}
