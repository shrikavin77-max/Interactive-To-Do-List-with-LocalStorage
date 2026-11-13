/**
 * Daylist — Interactive To-Do List with LocalStorage
 * InternCircle Project 02 | Fullstack Web Development
 *
 * Architecture:
 * - Single source of truth: `tasks` array of { id, text, done }
 * - Data persistence: browser localStorage with JSON serialization & validation
 * - UI Rendering: declarative-style DOM rebuilding with XSS prevention via textContent
 * - Event handling: centralized event listeners with event delegation
 */

(function () {
  "use strict";

  // Storage key as recommended by InternCircle Learner Guide
  const STORAGE_KEY = "tasks";

  // Application State
  let tasks = [];
  let currentFilter = "all"; // 'all' | 'active' | 'done'
  let isStorageAvailable = true;

  // DOM Elements
  const form = document.getElementById("form");
  const input = document.getElementById("text");
  const list = document.getElementById("list");
  const countEl = document.getElementById("count");
  const emptyStateEl = document.getElementById("empty-state");
  const emptyTitleEl = document.getElementById("empty-title");
  const emptyDescEl = document.getElementById("empty-description");
  const clearCompletedBtn = document.getElementById("clear-completed");
  const filterButtons = document.querySelectorAll(".filter-btn");
  const countAllEl = document.getElementById("count-all");
  const countActiveEl = document.getElementById("count-active");
  const countDoneEl = document.getElementById("count-done");
  const formErrorEl = document.getElementById("form-error");
  const storageStatusText = document.getElementById("storage-status-text");
  const headerStatusPill = document.getElementById("header-status");
  const todayDateEl = document.getElementById("today-date");

  /* --------------------------------------------------------------------------
     1. LocalStorage Management with Validation & Error Handling
     -------------------------------------------------------------------------- */

  /**
   * Safely loads and validates tasks from LocalStorage.
   * Handles null values, corrupted JSON, invalid types, and disabled storage.
   * @returns {Array<{id: number, text: string, done: boolean}>}
   */
  function loadTasks() {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        setStorageStatus(false, "Storage Unavailable");
        return [];
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setStorageStatus(true, "Storage Active");
        return [];
      }

      const parsed = JSON.parse(raw);

      // Validate that parsed data is an array
      if (!Array.isArray(parsed)) {
        console.warn("[Daylist] Storage data was not an array; resetting tasks.");
        setStorageStatus(true, "Data Reset");
        return [];
      }

      // Filter and sanitize each task object to guarantee schema integrity
      const validatedTasks = parsed
        .filter(function (item) {
          return (
            item &&
            typeof item === "object" &&
            (typeof item.id === "number" || typeof item.id === "string") &&
            !isNaN(Number(item.id)) &&
            typeof item.text === "string" &&
            item.text.trim().length > 0
          );
        })
        .map(function (item) {
          return {
            id: Number(item.id),
            text: item.text.trim(),
            done: Boolean(item.done)
          };
        });

      setStorageStatus(true, "Storage Active");
      return validatedTasks;
    } catch (error) {
      console.error("[Daylist] Error reading from LocalStorage:", error);
      setStorageStatus(false, "Storage Error (Using Memory)");
      return [];
    }
  }

  /**
   * Saves current tasks array to LocalStorage using JSON.stringify().
   * Handles QuotaExceededError or security exceptions gracefully.
   */
  function saveTasks() {
    try {
      if (typeof window !== "undefined" && window.localStorage && isStorageAvailable) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      }
    } catch (error) {
      console.error("[Daylist] Error saving tasks to LocalStorage:", error);
      setStorageStatus(false, "Save Failed");
    }
  }

  /**
   * Updates visual storage status pill in the header.
   */
  function setStorageStatus(available, message) {
    isStorageAvailable = available;
    if (storageStatusText) {
      storageStatusText.textContent = message;
    }
    if (headerStatusPill) {
      if (available) {
        headerStatusPill.classList.remove("warning");
      } else {
        headerStatusPill.classList.add("warning");
      }
    }
  }

  /* --------------------------------------------------------------------------
     2. UI Rendering (Declarative state -> DOM)
     -------------------------------------------------------------------------- */

  /**
   * Renders the task list, counters, filter badges, and empty states.
   */
  function render() {
    // 1. Calculate counts
    const totalCount = tasks.length;
    const doneCount = tasks.filter(function (t) { return t.done; }).length;
    const activeCount = totalCount - doneCount;

    // 2. Update remaining counter with proper pluralization
    if (countEl) {
      countEl.textContent = activeCount + (activeCount === 1 ? " task left" : " tasks left");
    }

    // 3. Update filter pill badge numbers
    if (countAllEl) countAllEl.textContent = totalCount;
    if (countActiveEl) countActiveEl.textContent = activeCount;
    if (countDoneEl) countDoneEl.textContent = doneCount;

    // 4. Update Clear Completed button state
    if (clearCompletedBtn) {
      clearCompletedBtn.disabled = doneCount === 0;
      clearCompletedBtn.style.visibility = doneCount === 0 ? "hidden" : "visible";
    }

    // 5. Update active filter tab highlight
    filterButtons.forEach(function (btn) {
      const isSelected = btn.dataset.filter === currentFilter;
      btn.classList.toggle("active", isSelected);
      btn.setAttribute("aria-selected", isSelected ? "true" : "false");
    });

    // 6. Filter tasks based on current filter state
    const visibleTasks = tasks.filter(function (t) {
      if (currentFilter === "active") return !t.done;
      if (currentFilter === "done") return t.done;
      return true; // 'all'
    });

    // 7. Clear the existing list DOM
    list.innerHTML = "";

    // 8. Render empty state or task items
    if (visibleTasks.length === 0) {
      showEmptyState(totalCount, currentFilter);
    } else {
      hideEmptyState();

      // Build task items safely via createElement + textContent (no innerHTML for user data)
      visibleTasks.forEach(function (task) {
        const li = document.createElement("li");
        li.dataset.id = task.id;
        if (task.done) {
          li.classList.add("done");
        }

        // Custom accessible toggle checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-checkbox";
        checkbox.checked = task.done;
        checkbox.dataset.action = "toggle";
        checkbox.setAttribute(
          "aria-label",
          task.done ? "Mark \"" + task.text + "\" as incomplete" : "Mark \"" + task.text + "\" as complete"
        );

        // Safe task label (textContent prevents HTML/script injection)
        const label = document.createElement("span");
        label.className = "task-label";
        label.dataset.action = "toggle";
        label.textContent = task.text;

        // Delete button
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn-delete";
        delBtn.dataset.action = "delete";
        delBtn.setAttribute("aria-label", "Delete task: " + task.text);
        delBtn.title = "Delete task";
        delBtn.innerHTML =
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<polyline points="3 6 5 6 21 6"></polyline>' +
          '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
          '<line x1="10" y1="11" x2="10" y2="17"></line>' +
          '<line x1="14" y1="11" x2="14" y2="17"></line>' +
          '</svg>';

        li.append(checkbox, label, delBtn);
        list.append(li);
      });
    }
  }

  /**
   * Displays context-aware empty state message.
   */
  function showEmptyState(totalCount, filter) {
    if (!emptyStateEl) return;
    emptyStateEl.hidden = false;

    if (totalCount === 0) {
      if (emptyTitleEl) emptyTitleEl.textContent = "All caught up!";
      if (emptyDescEl) emptyDescEl.textContent = "Your list is empty. Add a task above to start your day.";
    } else if (filter === "active") {
      if (emptyTitleEl) emptyTitleEl.textContent = "No active tasks!";
      if (emptyDescEl) emptyDescEl.textContent = "Awesome job! You have completed all your pending tasks.";
    } else if (filter === "done") {
      if (emptyTitleEl) emptyTitleEl.textContent = "No completed tasks yet";
      if (emptyDescEl) emptyDescEl.textContent = "Check off tasks as you finish them to see them here.";
    }
  }

  /**
   * Hides the empty state message.
   */
  function hideEmptyState() {
    if (emptyStateEl) emptyStateEl.hidden = true;
  }

  /**
   * Shows an inline validation error below the form.
   */
  function showFormError(msg) {
    if (!formErrorEl) return;
    formErrorEl.textContent = msg;
    formErrorEl.hidden = false;
    input.classList.add("input-error");
  }

  /**
   * Clears the inline validation error.
   */
  function clearFormError() {
    if (!formErrorEl) return;
    formErrorEl.textContent = "";
    formErrorEl.hidden = true;
    input.classList.remove("input-error");
  }

  /* --------------------------------------------------------------------------
     3. Event Handlers & Event Delegation
     -------------------------------------------------------------------------- */

  /**
   * Task Submission Handler (supports both Add button click & Enter key press).
   */
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const rawText = input.value;
    const text = rawText.trim();

    // Prevent empty or whitespace-only tasks
    if (!text) {
      showFormError("Please enter a task description before adding.");
      input.focus();
      return;
    }

    clearFormError();

    // Push new task object: { id, text, done }
    tasks.push({
      id: Date.now(),
      text: text,
      done: false
    });

    // Reset input field
    input.value = "";
    input.focus();

    // Persist and re-render
    saveTasks();
    render();
  });

  // Clear validation error when user begins typing
  input.addEventListener("input", function () {
    if (input.value.trim().length > 0) {
      clearFormError();
    }
  });

  /**
   * Event Delegation on Task List:
   * Handles toggle and delete actions efficiently through a single listener.
   */
  list.addEventListener("click", function (e) {
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const li = actionEl.closest("li");
    if (!li || !li.dataset.id) return;

    const id = Number(li.dataset.id);

    if (action === "delete") {
      tasks = tasks.filter(function (t) {
        return t.id !== id;
      });
      saveTasks();
      render();
    } else if (action === "toggle") {
      tasks.forEach(function (t) {
        if (t.id === id) {
          t.done = !t.done;
        }
      });
      saveTasks();
      render();
    }
  });

  /**
   * Filter Switch Buttons (All, Active, Done).
   */
  filterButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const filter = btn.dataset.filter;
      if (filter && filter !== currentFilter) {
        currentFilter = filter;
        render();
      }
    });
  });

  /**
   * Clear Completed Tasks Handler.
   */
  if (clearCompletedBtn) {
    clearCompletedBtn.addEventListener("click", function () {
      tasks = tasks.filter(function (t) {
        return !t.done;
      });
      saveTasks();
      render();
    });
  }

  /**
   * Sync across open browser tabs via storage event.
   */
  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) {
      tasks = loadTasks();
      render();
    }
  });

  /**
   * Format friendly header date.
   */
  function displayHeaderDate() {
    if (!todayDateEl) return;
    try {
      const now = new Date();
      const options = { weekday: "long", month: "short", day: "numeric" };
      todayDateEl.textContent = now.toLocaleDateString(undefined, options) + " • Plan your day";
    } catch {
      todayDateEl.textContent = "Focus on what matters today";
    }
  }

  /* --------------------------------------------------------------------------
     4. Application Initialization
     -------------------------------------------------------------------------- */
  function init() {
    displayHeaderDate();
    tasks = loadTasks();
    render();
  }

  // Initialize immediately since script has `defer` attribute
  init();
})();

