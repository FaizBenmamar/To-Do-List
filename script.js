(() => {
    "use strict";

    // Own storage key, so this app never clashes with other projects on the same github.io domain
    const STORAGE_KEY = "todo-pro:tasks";
    const HISTORY_KEY = "todo-pro:history";
    const HISTORY_LIMIT = 500;

    const form = document.getElementById("task-form");
    const input = document.getElementById("task-input");
    const errorMsg = document.getElementById("form-error");
    const list = document.getElementById("task-list");
    const empty = document.getElementById("empty");
    const emptyText = document.getElementById("empty-text");
    const countEl = document.getElementById("count");
    const clearBtn = document.getElementById("clear-done");
    const doneCountEl = document.getElementById("done-count");
    const totalCountEl = document.getElementById("total-count");
    const progress = document.getElementById("progress");
    const progressBar = document.getElementById("progress-bar");
    const filterButtons = document.querySelectorAll(".filter");
    const historyBtn = document.getElementById("open-history");
    const historyDialog = document.getElementById("history-dialog");
    const historyList = document.getElementById("history-list");
    const historyEmpty = document.getElementById("history-empty");
    const historyStats = document.getElementById("history-stats");
    const historyClose = document.getElementById("history-close");
    const historyClear = document.getElementById("history-clear");

    let tasks = loadTasks();
    let history = loadHistory();
    syncHistory();
    let filter = "all";
    let lastAddedId = null;

    // ---------- Storage ----------
    function loadTasks() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (!Array.isArray(data)) return [];
            return data
                .filter((t) => t && typeof t.text === "string")
                .map((t) => ({ id: String(t.id), text: t.text, done: Boolean(t.done) }));
        } catch (err) {
            return [];
        }
    }

    function loadHistory() {
        try {
            const data = JSON.parse(localStorage.getItem(HISTORY_KEY));
            if (!Array.isArray(data)) return [];
            return data
                .filter((h) => h && typeof h.text === "string")
                .map((h) => ({
                    id: String(h.id),
                    text: h.text,
                    createdAt: h.createdAt || null,
                    doneAt: h.doneAt || null,
                    deletedAt: h.deletedAt || null,
                }));
        } catch (err) {
            return [];
        }
    }

    // Tasks created before the history existed get an entry too
    function syncHistory() {
        tasks.forEach((t) => {
            if (!history.some((h) => h.id === t.id)) {
                history.push({ id: t.id, text: t.text, createdAt: null, doneAt: t.done ? Date.now() : null, deletedAt: null });
            }
        });
    }

    function saveTasks() {
        try {
            if (history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        } catch (err) {
            /* storage unavailable: the app still works for this session */
        }
    }

    // ---------- Actions ----------
    function addTask(text) {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        tasks.unshift({ id, text, done: false });
        history.unshift({ id, text, createdAt: Date.now(), doneAt: null, deletedAt: null });
        lastAddedId = id;
        saveTasks();
        render();
    }

    function toggleTask(id) {
        const task = tasks.find((t) => t.id === id);
        if (task) {
            task.done = !task.done;
            const entry = history.find((h) => h.id === id);
            if (entry) entry.doneAt = task.done ? Date.now() : null;
        }
        saveTasks();
        render();
    }

    function markDeleted(id) {
        const entry = history.find((h) => h.id === id);
        if (entry && !entry.deletedAt) entry.deletedAt = Date.now();
    }

    function deleteTask(id) {
        markDeleted(id);
        tasks = tasks.filter((t) => t.id !== id);
        saveTasks();
        render();
    }

    function clearCompleted() {
        tasks.filter((t) => t.done).forEach((t) => markDeleted(t.id));
        tasks = tasks.filter((t) => !t.done);
        saveTasks();
        render();
    }

    // ---------- Rendering ----------
    function createItem(task) {
        const li = document.createElement("li");
        li.className = "task" + (task.done ? " done" : "") + (task.id === lastAddedId ? " enter" : "");
        li.dataset.id = task.id;

        const label = document.createElement("label");
        label.className = "check";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.done;

        const box = document.createElement("span");
        box.className = "box";

        const text = document.createElement("span");
        text.className = "text";
        text.textContent = task.text; // textContent: user input is never interpreted as HTML

        label.append(checkbox, box, text);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "delete";
        del.setAttribute("aria-label", "Delete task: " + task.text);
        del.innerHTML =
            '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
            '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

        li.append(label, del);
        return li;
    }

    function render() {
        const visible = tasks.filter((t) =>
            filter === "active" ? !t.done : filter === "done" ? t.done : true
        );
        list.replaceChildren(...visible.map(createItem));
        lastAddedId = null;

        const total = tasks.length;
        const done = tasks.filter((t) => t.done).length;
        const left = total - done;
        const percent = total ? Math.round((done / total) * 100) : 0;

        doneCountEl.textContent = done;
        totalCountEl.textContent = total;
        progressBar.style.width = percent + "%";
        progress.setAttribute("aria-valuenow", percent);
        countEl.textContent = left + (left === 1 ? " task left" : " tasks left");
        clearBtn.disabled = done === 0;

        empty.hidden = visible.length > 0;
        emptyText.textContent =
            total === 0 ? "No tasks yet. Add your first one above."
            : filter === "active" ? "Nothing left to do. Nice work!"
            : "No completed tasks yet.";

        filterButtons.forEach((btn) => {
            const active = btn.dataset.filter === filter;
            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-pressed", String(active));
        });
    }

    // ---------- History ----------
    function formatDateTime(ts) {
        return new Date(ts).toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    }

    function renderHistory() {
        const deleted = history.filter((h) => h.deletedAt).length;
        const completed = history.filter((h) => h.doneAt).length;
        historyStats.textContent =
            history.length + " total · " + completed + " completed · " + deleted + " deleted";

        historyList.replaceChildren(...history
            .slice()
            .sort((a, b) => (b.deletedAt || b.doneAt || b.createdAt || 0) - (a.deletedAt || a.doneAt || a.createdAt || 0))
            .map((h) => {
                const status = h.deletedAt ? "deleted" : h.doneAt ? "done" : "active";
                const label = { deleted: "Deleted", done: "Completed", active: "Active" }[status];

                const li = document.createElement("li");
                li.className = "hist-item";

                const top = document.createElement("div");
                top.className = "hist-top";
                const text = document.createElement("span");
                text.className = "hist-text";
                text.textContent = h.text;
                const badge = document.createElement("span");
                badge.className = "badge badge-" + status;
                badge.textContent = label;
                top.append(text, badge);

                const meta = document.createElement("p");
                meta.className = "hist-meta";
                const parts = [h.createdAt ? "Added " + formatDateTime(h.createdAt) : "Added earlier"];
                if (h.doneAt) parts.push("Completed " + formatDateTime(h.doneAt));
                if (h.deletedAt) parts.push("Deleted " + formatDateTime(h.deletedAt));
                meta.textContent = parts.join(" · ");

                li.append(top, meta);
                return li;
            }));

        historyEmpty.hidden = history.length > 0;
    }

    historyBtn.addEventListener("click", () => {
        renderHistory();
        historyDialog.showModal();
    });
    historyClose.addEventListener("click", () => historyDialog.close());
    // Click on the dark backdrop closes the dialog
    historyDialog.addEventListener("click", (e) => {
        if (e.target === historyDialog) historyDialog.close();
    });
    historyClear.addEventListener("click", () => {
        if (!confirm("Clear the history? Your current tasks are kept.")) return;
        history = history.filter((h) => tasks.some((t) => t.id === h.id));
        saveTasks();
        renderHistory();
    });

    // ---------- Events ----------
    // A <form> handles both the Add button and the Enter key
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) {
            errorMsg.hidden = false;
            input.focus();
            return;
        }
        errorMsg.hidden = true;
        addTask(text);
        input.value = "";
        input.focus();
    });

    input.addEventListener("input", () => { errorMsg.hidden = true; });

    list.addEventListener("click", (e) => {
        const item = e.target.closest(".task");
        if (!item) return;
        if (e.target.closest(".delete")) deleteTask(item.dataset.id);
    });

    list.addEventListener("change", (e) => {
        const item = e.target.closest(".task");
        if (item && e.target.matches("input[type='checkbox']")) toggleTask(item.dataset.id);
    });

    filterButtons.forEach((btn) =>
        btn.addEventListener("click", () => {
            filter = btn.dataset.filter;
            render();
        })
    );

    clearBtn.addEventListener("click", clearCompleted);

    // ---------- Date (updates by itself at midnight) ----------
    function updateDate() {
        document.getElementById("today").textContent = new Date().toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
        });
    }

    function scheduleMidnightUpdate() {
        const now = new Date();
        const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
        setTimeout(() => {
            updateDate();
            scheduleMidnightUpdate();
        }, nextMidnight - now);
    }

    // Also refresh when the tab becomes visible again (e.g. the laptop was asleep overnight)
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) updateDate();
    });

    // ---------- Init ----------
    updateDate();
    scheduleMidnightUpdate();
    render();
})();
