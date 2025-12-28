const App = {
    data: {
        todos: [],
        lists: [
            { id: 'list-personal', name: 'Personal' },
            { id: 'list-work', name: 'Work' }
        ]
    },
    state: {
        view: 'list',
        filter: 'all',
        currentDate: new Date(),
        search: ''
    },

    async init() {
        this.bindEvents();
        await this.loadData();
        this.render();
        this.startNotifications();
    },

    async loadData() {
        document.getElementById('loadingSkeleton').classList.remove('hidden');
        document.getElementById('todoList').classList.add('hidden');

        return new Promise(resolve => {
            setTimeout(() => {
                const stored = localStorage.getItem('week3_data');
                if (stored) this.data = JSON.parse(stored);
                
                document.getElementById('loadingSkeleton').classList.add('hidden');
                document.getElementById('todoList').classList.remove('hidden');
                resolve();
            }, 800);
        });
    },

    saveData() {
        localStorage.setItem('week3_data', JSON.stringify(this.data));
        this.render();
    },

    render() {
        this.renderLists();
        if (this.state.view === 'list') this.renderTodos();
        if (this.state.view === 'calendar') this.renderCalendar();
    },

    renderLists() {
        const container = document.getElementById('projectListContainer');
        const select = document.getElementById('taskListSelect');
        
        container.innerHTML = this.data.lists.map(l => 
            `<button class="nav-btn" onclick="App.setView('list', '${l.id}')">
                <i class="fa-solid fa-list"></i> ${l.name}
             </button>`
        ).join('');

        select.innerHTML = this.data.lists.map(l => 
            `<option value="${l.id}">${l.name}</option>`
        ).join('');
    },

    renderTodos() {
        const container = document.getElementById('todoList');
        const title = document.getElementById('pageTitle');
        let tasks = this.data.todos;

        if (this.state.filter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            tasks = tasks.filter(t => t.date === today);
            title.innerText = 'Today';
        } else if (this.state.filter.startsWith('list-')) {
            tasks = tasks.filter(t => t.listId === this.state.filter);
            const list = this.data.lists.find(l => l.id === this.state.filter);
            title.innerText = list ? list.name : 'List';
        } else {
            title.innerText = 'All Tasks';
        }

        if (this.state.search) {
            tasks = tasks.filter(t => t.title.toLowerCase().includes(this.state.search));
        }

        const sortMode = document.getElementById('sortSelect').value;
        tasks.sort((a, b) => {
            if(sortMode === 'priority') {
                const map = { high: 1, medium: 2, low: 3 };
                return map[a.priority] - map[b.priority];
            }
            return new Date(a.date) - new Date(b.date);
        });

        container.innerHTML = tasks.map(t => `
            <div class="todo-item ${t.completed ? 'completed' : ''}" onclick="App.openModal('${t.id}')">
                <input type="checkbox" ${t.completed ? 'checked' : ''} 
                    onclick="event.stopPropagation(); App.toggleComplete('${t.id}')">
                <div class="todo-content">
                    <div class="todo-title">${t.title}</div>
                    <div class="todo-meta">
                        <span class="priority-dot p-${t.priority}"></span>
                        <span>${t.date || 'No Date'}</span>
                        ${t.subtasks.length ? `<span>${t.subtasks.filter(s=>s.done).length}/${t.subtasks.length}</span>` : ''}
                    </div>
                </div>
                <button class="icon-btn" onclick="event.stopPropagation(); App.deleteTask('${t.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '';
        const year = this.state.currentDate.getFullYear();
        const month = this.state.currentDate.getMonth();
        
        document.getElementById('calendarMonthDisplay').innerText = 
            this.state.currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for(let i=0; i<firstDay; i++) grid.appendChild(document.createElement('div'));

        for(let i=1; i<=daysInMonth; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
            
            if(dateStr === new Date().toISOString().split('T')[0]) cell.classList.add('today');

            cell.innerHTML = `<div>${i}</div>`;
            
            const tasks = this.data.todos.filter(t => t.date === dateStr && !t.completed);
            tasks.forEach(t => {
                const div = document.createElement('div');
                div.className = 'calendar-task';
                div.innerText = t.title;
                cell.appendChild(div);
            });

            grid.appendChild(cell);
        }
    },

    setView(view, filter = 'all') {
        this.state.view = view;
        this.state.filter = filter;
        document.getElementById('view-list').classList.add('hidden');
        document.getElementById('view-calendar').classList.add('hidden');
        document.getElementById(`view-${view}`).classList.remove('hidden');
        this.render();
    },

    toggleComplete(id) {
        const t = this.data.todos.find(x => x.id === id);
        if(t) t.completed = !t.completed;
        this.saveData();
    },

    deleteTask(id) {
        if(confirm('Delete task?')) {
            this.data.todos = this.data.todos.filter(x => x.id !== id);
            this.saveData();
        }
    },

    openModal(id = null) {
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        form.reset();
        document.getElementById('subtaskList').innerHTML = '';
        document.getElementById('taskId').value = '';

        if(id) {
            const t = this.data.todos.find(x => x.id === id);
            document.getElementById('taskId').value = t.id;
            document.getElementById('taskTitle').value = t.title;
            document.getElementById('taskDesc').value = t.desc;
            document.getElementById('taskDate').value = t.date;
            document.getElementById('taskPriority').value = t.priority;
            document.getElementById('taskListSelect').value = t.listId;
            t.subtasks.forEach(s => this.addSubtaskDOM(s.text, s.done));
        }

        modal.classList.remove('hidden');
    },

    handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('taskId').value;
        const subtasks = [];
        document.querySelectorAll('.subtask-item').forEach(el => {
            subtasks.push({
                text: el.querySelector('span').innerText,
                done: el.querySelector('input').checked
            });
        });

        const taskData = {
            id: id || Date.now().toString(),
            title: document.getElementById('taskTitle').value,
            desc: document.getElementById('taskDesc').value,
            date: document.getElementById('taskDate').value,
            priority: document.getElementById('taskPriority').value,
            listId: document.getElementById('taskListSelect').value,
            completed: false,
            subtasks: subtasks
        };

        if(id) {
            const idx = this.data.todos.findIndex(x => x.id === id);
            this.data.todos[idx] = { ...this.data.todos[idx], ...taskData };
        } else {
            this.data.todos.push(taskData);
        }

        document.getElementById('taskModal').classList.add('hidden');
        this.saveData();
    },

    addSubtaskDOM(text, done = false) {
        const div = document.createElement('div');
        div.className = 'subtask-item';
        div.innerHTML = `
            <input type="checkbox" ${done?'checked':''}>
            <span style="flex:1">${text}</span>
            <button type="button" class="icon-btn" onclick="this.parentElement.remove()">&times;</button>
        `;
        document.getElementById('subtaskList').appendChild(div);
    },

    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    startNotifications() {
        if("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
        
        setInterval(() => {
            const now = new Date().toISOString().split('T')[0];
            const due = this.data.todos.filter(t => t.date === now && !t.completed);
            if(due.length > 0 && Notification.permission === "granted") {
                new Notification(`You have ${due.length} tasks due today!`);
            }
        }, 60000 * 60);
    },

    bindEvents() {
        document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
            btn.addEventListener('click', () => this.setView(btn.dataset.view, btn.dataset.filter));
        });

        document.getElementById('addTaskBtn').addEventListener('click', () => this.openModal());
        document.querySelector('.close-modal').addEventListener('click', () => document.getElementById('taskModal').classList.add('hidden'));
        document.querySelector('.secondary-btn.close-modal').addEventListener('click', () => document.getElementById('taskModal').classList.add('hidden'));
        
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleSubmit(e));
        
        document.getElementById('addSubtaskBtn').addEventListener('click', () => {
            const inp = document.getElementById('subtaskInput');
            if(inp.value) { this.addSubtaskDOM(inp.value); inp.value = ''; }
        });

        document.getElementById('addListBtn').addEventListener('click', () => {
            const name = prompt('List Name:');
            if(name) {
                this.data.lists.push({ id: `list-${Date.now()}`, name });
                this.saveData();
            }
        });

        document.getElementById('searchInput').addEventListener('input', this.debounce((e) => {
            this.state.search = e.target.value.toLowerCase();
            this.render();
        }, 300));

        document.getElementById('prevMonth').addEventListener('click', () => {
            this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
            this.render();
        });
        document.getElementById('nextMonth').addEventListener('click', () => {
            this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
            this.render();
        });
        
        document.getElementById('sortSelect').addEventListener('change', () => this.render());
        document.getElementById('notificationBtn').addEventListener('click', () => Notification.requestPermission());
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());