// --- STATE & CONFIG ---
let todos = [];
let currentView = 'all'; 
let currentDate = new Date(); 
let notificationPermission = Notification.permission;

// Mock User Identity
// We generate a random ID to simulate you being a specific user in this tab
const currentUserId = 'User-' + Math.floor(Math.random() * 10000);
console.log("Current User ID:", currentUserId);

// --- MOCK DATABASE (LocalStorage for Sync) ---
const DB_KEY = 'protask_db';

function getFromDB() {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : [];
}

function saveToDB(newTodos) {
    localStorage.setItem(DB_KEY, JSON.stringify(newTodos));
    // Dispatch event for current tab awareness
    window.dispatchEvent(new Event('localDataChanged'));
}

// --- MOCK API LAYER (With Latency Simulation) ---
const mockFetch = (action, payload) => {
    return new Promise((resolve) => {
        // Latency between 400ms and 800ms
        const delay = Math.floor(Math.random() * 400) + 400; 
        
        setTimeout(() => {
            const currentData = getFromDB();

            if (action === 'GET') {
                if (currentData.length === 0) {
                    // Seed data if empty
                    const seed = [
                        { id: 1, title: 'Project Kickoff', date: getTodayStr(), time: '09:00', completed: false, owner: 'User-System' },
                        { id: 2, title: 'Client Review', date: getTodayStr(), time: '14:00', completed: true, owner: 'User-System' }
                    ];
                    saveToDB(seed);
                    resolve({ json: async () => seed });
                } else {
                    resolve({ json: async () => currentData });
                }
            } 
            else if (action === 'POST') {
                const newTask = { ...payload, id: Date.now(), owner: currentUserId };
                const updatedList = [newTask, ...currentData]; // Add to top
                saveToDB(updatedList);
                resolve({ ok: true });
            }
            else if (action === 'UPDATE_STATUS') {
                const updatedList = currentData.map(t => 
                    t.id === payload.id ? { ...t, completed: payload.completed } : t
                );
                saveToDB(updatedList);
                resolve({ ok: true });
            }
        }, delay);
    });
};

// --- SYNC LISTENER (The "Collaboration" Engine) ---
window.addEventListener('storage', (event) => {
    if (event.key === DB_KEY) {
        // Another tab updated the DB!
        const newData = getFromDB();
        
        // Visual check: Did the count change?
        if (newData.length > todos.length) {
            showToast("New task added by teammate", "add_task");
        } else {
            showToast("List updated by teammate", "sync");
        }
        
        todos = newData;
        renderApp();
    }
});

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    fetchTodos();
    setupNotifications();
    startNotificationLoop();
    
    // Set default date in modal to today
    document.getElementById('task-date').value = getTodayStr();
});

// --- CORE FUNCTIONS ---

async function fetchTodos(showSpinner = true) {
    if(showSpinner) showLoading(true);
    
    try {
        const response = await mockFetch('GET');
        const data = await response.json();
        todos = data;
        renderApp();
    } catch (e) {
        console.error(e);
    } finally {
        if(showSpinner) showLoading(false);
    }
}

async function addTask() {
    const title = document.getElementById('task-title').value;
    const date = document.getElementById('task-date').value;
    const time = document.getElementById('task-time').value;

    if (!title) return alert("Please enter a task name");

    const btn = document.getElementById('save-btn');
    toggleBtnLoading(btn, true);

    const newTask = { title, date, time, completed: false };
    await mockFetch('POST', newTask);

    closeModal();
    // Reset form
    document.getElementById('task-title').value = '';
    
    // Refresh local state immediately (no spinner needed for adder)
    todos = getFromDB();
    renderApp();
    
    toggleBtnLoading(btn, false);
    showToast("Task created successfully", "check");
}

async function toggleTaskStatus(id, isChecked) {
    // Optimistic Update
    const task = todos.find(t => t.id === id);
    if(task) task.completed = isChecked;
    renderApp();

    await mockFetch('UPDATE_STATUS', { id, completed: isChecked });
}

// --- RENDERING ---

function renderApp() {
    if (currentView === 'calendar') {
        renderCalendar();
        document.getElementById('task-view').classList.add('hidden');
        document.getElementById('calendar-view').classList.remove('hidden');
    } else {
        renderTaskList();
        document.getElementById('task-view').classList.remove('hidden');
        document.getElementById('calendar-view').classList.add('hidden');
    }
}

function renderTaskList(filterText = '') {
    const list = document.getElementById('todo-list');
    const emptyState = document.getElementById('empty-state');
    list.innerHTML = '';

    let filtered = todos;

    // View Filtering
    if (currentView === 'today') {
        filtered = todos.filter(t => t.date === getTodayStr());
        document.getElementById('page-title').innerText = "Today's Focus";
    } else {
        document.getElementById('page-title').innerText = "All Tasks";
    }

    // Search Filtering
    if (filterText) {
        filtered = filtered.filter(t => t.title.toLowerCase().includes(filterText.toLowerCase()));
    }

    if(filtered.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
    }

    filtered.forEach(todo => {
        const div = document.createElement('div');
        div.className = 'todo-item';
        
        // Avatar Logic
        const isMe = todo.owner === currentUserId;
        const initials = isMe ? 'ME' : 'TM';
        const avatarClass = isMe ? 'avatar-me' : 'avatar-other';
        
        // Due Date formatting
        let dateDisplay = todo.date || '';
        if (dateDisplay === getTodayStr()) dateDisplay = 'Today';

        div.innerHTML = `
            <div class="todo-info">
                <div class="user-avatar ${avatarClass}">${initials}</div>
                <div class="todo-details">
                    <h4 style="${todo.completed ? 'text-decoration:line-through; color:#9CA3AF' : ''}">
                        ${todo.title}
                    </h4>
                    <div class="todo-meta">
                        <span>${dateDisplay} ${todo.time || ''}</span>
                        ${!isMe ? '<span class="owner-tag">Teammate</span>' : ''}
                    </div>
                </div>
            </div>
            <input type="checkbox" 
                   ${todo.completed ? 'checked' : ''} 
                   onchange="toggleTaskStatus(${todo.id}, this.checked)">
        `;
        list.appendChild(div);
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthDisplay = document.getElementById('current-month-display');
    grid.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthDisplay.innerText = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Empty slots
    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div'));
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        
        if (dateStr === getTodayStr()) cell.classList.add('today');
        
        cell.innerHTML = `<div style="margin-bottom:4px; font-weight:600; font-size:0.8rem">${i}</div>`;

        // Dots for tasks
        const dayTasks = todos.filter(t => t.date === dateStr);
        dayTasks.forEach(t => {
            const dot = document.createElement('div');
            dot.className = `cal-task-dot ${t.completed ? 'done' : ''}`;
            dot.innerText = t.title;
            cell.appendChild(dot);
        });

        grid.appendChild(cell);
    }
}

// --- UTILITIES ---

function switchView(view) {
    currentView = view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    renderApp();
}

function showLoading(isLoading) {
    const skeleton = document.getElementById('skeleton-loader');
    const view = document.getElementById('task-view');
    if (isLoading) {
        skeleton.classList.remove('hidden');
        view.classList.add('hidden');
    } else {
        skeleton.classList.add('hidden');
        view.classList.remove('hidden');
    }
}

function toggleBtnLoading(btn, isLoading) {
    if(isLoading) {
        btn.querySelector('.btn-text').classList.add('hidden');
        btn.querySelector('.loader').classList.remove('hidden');
        btn.disabled = true;
    } else {
        btn.querySelector('.btn-text').classList.remove('hidden');
        btn.querySelector('.loader').classList.add('hidden');
        btn.disabled = false;
    }
}

function showToast(message, icon = 'sync') {
    const existing = document.querySelector('.sync-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'sync-toast';
    toast.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// Debounce Search
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};
document.getElementById('search-input').addEventListener('input', debounce((e) => {
    renderTaskList(e.target.value);
}, 300));

// Helpers
function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function changeMonth(step) {
    currentDate.setMonth(currentDate.getMonth() + step);
    renderCalendar();
}

// Modal
function openModal() { document.getElementById('modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

// Notifications
function setupNotifications() {
    document.getElementById('notify-btn').addEventListener('click', () => {
        if (!('Notification' in window)) return;
        Notification.requestPermission().then(p => {
            if(p === 'granted') showToast("Notifications Enabled", "notifications_active");
        });
    });
}

function startNotificationLoop() {
    setInterval(() => {
        if (Notification.permission === 'granted') {
            const now = new Date();
            todos.forEach(t => {
                if(!t.time || t.completed || t.notified) return;
                const due = new Date(`${t.date}T${t.time}`);
                const diffMins = (due - now) / 60000;
                
                if (diffMins > 0 && diffMins <= 60) {
                    new Notification("Task Due Soon", { body: t.title });
                    t.notified = true; // prevent spam
                    saveToDB(todos);
                }
            });
        }
    }, 60000); // Check every minute
}