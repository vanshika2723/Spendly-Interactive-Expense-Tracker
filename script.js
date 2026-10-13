
"use strict";

/* =====================================================
   SPENDLY — PREMIUM FINANCE DASHBOARD
   Theme: Midnight Navy + Electric Violet
===================================================== */

const KEYS = {
  expenses: "spendly_expenses_v1",
  budget: "spendly_monthly_budget_v1",
  goals: "spendly_savings_goals_v1",
  theme: "spendly_theme_v1"
};

const $ = (id) => document.getElementById(id);

const form = $("expense-form");
const expenseIdInput = $("expense-id");
const titleInput = $("title");
const amountInput = $("amount");
const categoryInput = $("category");
const dateInput = $("date");
const paymentInput = $("payment");
const notesInput = $("notes");
const submitBtn = $("submit-btn");
const cancelEditBtn = $("cancel-edit");
const formTitle = $("form-title");
const formMessage = $("form-message");
const expenseList = $("expense-list");
const searchInput = $("search");
const filterCategory = $("filter-category");
const filterDate = $("filter-date");
const dateFrom = $("date-from");
const dateTo = $("date-to");
const sortBy = $("sort-by");

const categoryIcons = {
  Food: "🍽️",
  Travel: "🚗",
  Shopping: "🛍️",
  Bills: "🧾",
  Health: "💊",
  Education: "📚",
  Entertainment: "🎬",
  Other: "✦"
};

const validCategories = Object.keys(categoryIcons);
const validPayments = ["UPI", "Cash", "Card", "Bank Transfer"];

const CHART_COLORS = [
  "#7657F6",
  "#A18AFF",
  "#C0B2FF",
  "#6040DF",
  "#9277E8",
  "#D5CBFF",
  "#8171BC",
  "#B9A7EC"
];

let expenses = loadArray(KEYS.expenses, validateExpense);
let goals = loadArray(KEYS.goals, validateGoal);
let budget = loadBudget();

let categoryChart = null;
let monthlyChart = null;
let formTimer;
let lastNotificationTarget = null;

/* ================= DATE & MONEY ================= */

function localDate() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function money(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

function validDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return false;
  }

  const d = new Date(`${s}T12:00:00`);

  return !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === s;
}

function displayDate(s) {
  if (!validDate(s)) return s || "";

  const [y, m, d] = s.split("-").map(Number);

  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/* ================= DATA VALIDATION ================= */

function validateExpense(x) {
  return Boolean(
    x &&
    typeof x.id === "string" &&
    typeof x.title === "string" &&
    x.title.trim() &&
    x.title.length <= 70 &&
    Number.isFinite(Number(x.amount)) &&
    Number(x.amount) > 0 &&
    Number(x.amount) <= 100000000 &&
    validCategories.includes(x.category) &&
    validDate(x.date) &&
    (!x.payment || validPayments.includes(x.payment)) &&
    (x.notes == null || typeof x.notes === "string")
  );
}

function validateGoal(x) {
  return Boolean(
    x &&
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    x.name.trim() &&
    x.name.length <= 50 &&
    Number.isFinite(Number(x.target)) &&
    Number(x.target) > 0 &&
    Number(x.target) <= 1000000000 &&
    Number.isFinite(Number(x.saved)) &&
    Number(x.saved) >= 0 &&
    Number(x.saved) <= 1000000000
  );
}

function loadArray(key, validator) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");

    return Array.isArray(value)
      ? value.filter(validator)
      : [];
  } catch (error) {
    console.warn("Unable to read", key, error);
    return [];
  }
}

function loadBudget() {
  try {
    const n = Number(localStorage.getItem(KEYS.budget) || 0);

    return Number.isFinite(n) && n > 0 && n <= 100000000
      ? n
      : 0;
  } catch {
    return 0;
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(error);
    notify("Could not save. Browser storage may be full or disabled.", true);
    return false;
  }
}

function persistBudget(value) {
  try {
    localStorage.setItem(KEYS.budget, String(value));
    return true;
  } catch (error) {
    console.error(error);
    notify("Could not save the budget.", true);
    return false;
  }
}

function makeId() {
  if (typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ================= NOTIFICATIONS ================= */

function notify(message, error = false, target = formMessage) {
  clearTimeout(formTimer);

  if (!target) return;

  lastNotificationTarget = target;
  target.textContent = message;
  target.classList.toggle("error", error);

  if (message) {
    formTimer = setTimeout(() => {
      target.textContent = "";
      target.classList.remove("error");
    }, 4500);
  }
}

function addText(tag, className, text) {
  const el = document.createElement(tag);

  el.className = className;
  el.textContent = text;

  return el;
}

/* ================= SUMMARY ================= */

function updateSummary() {
  const total = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  const month = localDate().slice(0, 7);

  const monthly = expenses
    .filter(expense => expense.date.slice(0, 7) === month)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  $("total-expenses").textContent = money(total);
  $("monthly-expenses").textContent = money(monthly);
  $("transaction-count").textContent = String(expenses.length);
}

/* ================= FILTERS & SORTING ================= */

function filteredExpenses() {
  const q = searchInput.value.trim().toLowerCase();
  const cat = filterCategory.value;
  const exact = filterDate.value;
  const from = dateFrom.value;
  const to = dateTo.value;

  if (from && to && from > to) {
    notify("Start date must be on or before end date.", true);
    return [];
  }

  const list = expenses.filter(expense => {
    const matchesText = [
      expense.title,
      expense.category,
      expense.notes || "",
      expense.payment || ""
    ].some(value => String(value).toLowerCase().includes(q));

    return matchesText &&
      (cat === "All" || expense.category === cat) &&
      (!exact || expense.date === exact) &&
      (!from || expense.date >= from) &&
      (!to || expense.date <= to);
  });

  switch (sortBy.value) {
    case "oldest":
      list.sort((a, b) => a.date.localeCompare(b.date));
      break;

    case "high":
      list.sort((a, b) => b.amount - a.amount);
      break;

    case "low":
      list.sort((a, b) => a.amount - b.amount);
      break;

    default:
      list.sort((a, b) => b.date.localeCompare(a.date));
  }

  return list;
}

/* ================= TRANSACTION LIST ================= */

function createAction(label, cls, action, id, aria) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = cls;
  button.textContent = label;
  button.setAttribute("aria-label", aria);

  button.addEventListener("click", () => action(id));

  return button;
}

function createExpense(expense) {
  const row = document.createElement("article");
  row.className = "expense-item";

  const icon = addText(
    "div",
    "category-icon",
    categoryIcons[expense.category] || "✦"
  );

  icon.setAttribute("aria-hidden", "true");

  const info = document.createElement("div");
  info.className = "expense-info";

  info.appendChild(addText("h3", "", expense.title));

  const details = [
    expense.category,
    displayDate(expense.date),
    expense.payment || "UPI",
    expense.notes || ""
  ].filter(Boolean).join(" · ");

  info.appendChild(addText("p", "expense-meta", details));

  const right = document.createElement("div");
  right.className = "expense-amount";

  right.appendChild(
    addText("strong", "", money(Number(expense.amount)))
  );

  const actions = document.createElement("div");
  actions.className = "expense-actions";

  actions.append(
    createAction("✎", "icon-btn", editExpense, expense.id, "Edit expense"),
    createAction("×", "icon-btn delete", deleteExpense, expense.id, "Delete expense")
  );

  right.appendChild(actions);
  row.append(icon, info, right);

  return row;
}

function renderExpenses() {
  const list = filteredExpenses();

  expenseList.replaceChildren();

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    empty.append(
      addText("div", "empty-icon", "₹"),
      addText(
        "h3",
        "",
        expenses.length ? "No matching expenses" : "No expenses yet"
      ),
      addText(
        "p",
        "",
        expenses.length
          ? "Try changing your search or filters."
          : "Add your first expense using the form."
      )
    );

    expenseList.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();

    list.forEach(expense => {
      fragment.appendChild(createExpense(expense));
    });

    expenseList.appendChild(fragment);
  }

  $("list-count").textContent =
    `${list.length} ${list.length === 1 ? "item" : "items"}`;

  $("results-label").textContent =
    `Showing ${list.length} of ${expenses.length} transactions`;

  updateSummary();
  renderCharts();
  renderBudget();
}

/* ================= EXPENSE FORM ================= */

function resetExpenseForm() {
  form.reset();

  expenseIdInput.value = "";
  dateInput.value = localDate();
  paymentInput.value = "UPI";

  formTitle.textContent = "Add an expense";
  submitBtn.textContent = "＋ Save Expense";
  cancelEditBtn.hidden = true;
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categoryInput.value;
  const date = dateInput.value;
  const payment = paymentInput.value;
  const notes = notesInput.value.trim();
  const id = expenseIdInput.value;

  if (!title || title.length > 70) {
    return notify("Enter an expense name (max 70 characters).", true);
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    return notify("Enter a valid amount greater than ₹0.", true);
  }

  if (!validCategories.includes(category) ||
      !validPayments.includes(payment)) {
    return notify("Select a valid category and payment method.", true);
  }

  if (!validDate(date) || date > localDate()) {
    return notify("Choose a valid date that is not in the future.", true);
  }

  if (notes.length > 200) {
    return notify("Notes must be 200 characters or fewer.", true);
  }

  const record = {
    title,
    amount: Math.round(amount * 100) / 100,
    category,
    date,
    payment,
    notes
  };

  if (id) {
    const index = expenses.findIndex(expense => expense.id === id);

    if (index < 0) {
      return notify("Expense not found.", true);
    }

    const old = expenses[index];

    expenses[index] = { ...old, ...record };

    if (!persist(KEYS.expenses, expenses)) {
      expenses[index] = old;
      return;
    }

    notify("Expense updated successfully!");
  } else {
    const item = { id: makeId(), ...record };

    expenses.push(item);

    if (!persist(KEYS.expenses, expenses)) {
      expenses = expenses.filter(expense => expense.id !== item.id);
      return;
    }

    notify("Expense added successfully!");
  }

  resetExpenseForm();
  renderExpenses();
});

function editExpense(id) {
  const expense = expenses.find(item => item.id === id);

  if (!expense) return;

  expenseIdInput.value = expense.id;
  titleInput.value = expense.title;
  amountInput.value = expense.amount;
  categoryInput.value = expense.category;
  dateInput.value = expense.date;
  paymentInput.value = expense.payment || "UPI";
  notesInput.value = expense.notes || "";

  formTitle.textContent = "Edit expense";
  submitBtn.textContent = "✓ Update Expense";
  cancelEditBtn.hidden = false;

  $("add-expense").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  titleInput.focus({ preventScroll: true });
}

function deleteExpense(id) {
  const item = expenses.find(expense => expense.id === id);

  if (!item) return;

  if (!confirm(`Delete "${item.title}" (${money(item.amount)})?`)) {
    return;
  }

  const previous = expenses;
  expenses = expenses.filter(expense => expense.id !== id);

  if (!persist(KEYS.expenses, expenses)) {
    expenses = previous;
    return;
  }

  if (expenseIdInput.value === id) {
    resetExpenseForm();
  }

  renderExpenses();
  notify("Expense deleted successfully!");
}

cancelEditBtn.addEventListener("click", () => {
  resetExpenseForm();
  notify("");
});

[
  "search",
  "filter-category",
  "filter-date",
  "date-from",
  "date-to",
  "sort-by"
].forEach(id => {
  $(id).addEventListener(
    id === "search" ? "input" : "change",
    renderExpenses
  );
});

$("clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  filterCategory.value = "All";
  filterDate.value = "";
  dateFrom.value = "";
  dateTo.value = "";
  sortBy.value = "newest";

  renderExpenses();
});

/* ================= CSV EXPORT ================= */

$("export-btn").addEventListener("click", () => {
  if (!expenses.length) {
    return notify("Add an expense before exporting.", true);
  }

  const rows = [
    ["Title", "Amount INR", "Category", "Date", "Payment method", "Notes"],
    ...expenses.map(expense => [
      expense.title,
      expense.amount,
      expense.category,
      expense.date,
      expense.payment || "UPI",
      expense.notes || ""
    ])
  ];

  const csv = rows.map(row =>
    row.map(value => {
      let text = String(value);

      if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) {
        text = "'" + text;
      }

      return `"${text.replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\r\n");

  downloadBlob(
    "\uFEFF" + csv,
    "text/csv;charset=utf-8;",
    `spendly-expenses-${localDate()}.csv`
  );

  notify("CSV export started.");
});

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

/* ================= CHART HELPERS ================= */

function isDarkMode() {
  return document.body.classList.contains("dark");
}

function chartTheme() {
  const dark = isDarkMode();

  return {
    text: dark ? "#C6C4DF" : "#77778F",
    grid: dark ? "#38374F" : "#ECEAF4",
    border: dark ? "#232339" : "#FFFFFF",
    tooltipBg: dark ? "#292840" : "#FFFFFF",
    tooltipText: dark ? "#F0EFFB" : "#24243A"
  };
}

function getCategoryData() {
  const totals = {};

  expenses.forEach(expense => {
    totals[expense.category] =
      (totals[expense.category] || 0) + Number(expense.amount);
  });

  return {
    labels: Object.keys(totals),
    values: Object.values(totals)
  };
}

function getMonthlyData() {
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);

    const key =
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    months.push({
      key,
      label: date.toLocaleDateString("en-IN", { month: "short" })
    });
  }

  const values = months.map(month =>
    expenses
      .filter(expense => expense.date.slice(0, 7) === month.key)
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
  );

  return {
    labels: months.map(month => month.label),
    values
  };
}

/* ================= ANALYTICS CHARTS ================= */

function renderCharts() {
  if (!window.Chart) return;

  const theme = chartTheme();
  const categoryData = getCategoryData();
  const monthlyData = getMonthlyData();
  const hasCategories = categoryData.labels.length > 0;

  /* Category doughnut chart */

  const categoryLabels = hasCategories
    ? categoryData.labels
    : ["No expenses"];

  const categoryValues = hasCategories
    ? categoryData.values
    : [1];

  const categoryColors = hasCategories
    ? categoryData.labels.map((_, index) =>
        CHART_COLORS[index % CHART_COLORS.length]
      )
    : [theme.grid];

  if (!categoryChart) {
    categoryChart = new Chart($("category-chart"), {
      type: "doughnut",

      data: {
        labels: categoryLabels,
        datasets: [{
          data: categoryValues,
          backgroundColor: categoryColors,
          borderWidth: 3,
          borderColor: theme.border,
          hoverOffset: 7
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",

        plugins: {
          legend: {
            position: "bottom",

            labels: {
              color: theme.text,
              padding: 15,
              usePointStyle: true,
              pointStyle: "circle"
            }
          },

          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            padding: 12,

            callbacks: {
              label: context => hasCategories
                ? `${context.label}: ${money(context.raw)}`
                : "No expenses yet"
            }
          }
        }
      }
    });
  } else {
    categoryChart.data.labels = categoryLabels;
    categoryChart.data.datasets[0].data = categoryValues;
    categoryChart.data.datasets[0].backgroundColor = categoryColors;
    categoryChart.data.datasets[0].borderColor = theme.border;

    categoryChart.options.plugins.legend.labels.color = theme.text;
    categoryChart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
    categoryChart.options.plugins.tooltip.titleColor = theme.tooltipText;
    categoryChart.options.plugins.tooltip.bodyColor = theme.tooltipText;

    categoryChart.options.plugins.tooltip.callbacks.label = context =>
      hasCategories
        ? `${context.label}: ${money(context.raw)}`
        : "No expenses yet";

    categoryChart.update("none");
  }

  /* Monthly bar chart */

  if (!monthlyChart) {
    monthlyChart = new Chart($("monthly-chart"), {
      type: "bar",

      data: {
        labels: monthlyData.labels,

        datasets: [{
          label: "Expenses",
          data: monthlyData.values,
          backgroundColor: "#7657F6",
          hoverBackgroundColor: "#A18AFF",
          borderRadius: 8,
          maxBarThickness: 38
        }]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: { display: false },

          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            padding: 12,

            callbacks: {
              label: context => money(context.raw)
            }
          }
        },

        scales: {
          x: {
            ticks: { color: theme.text },
            grid: { display: false },
            border: { display: false }
          },

          y: {
            beginAtZero: true,

            ticks: {
              color: theme.text,

              callback: value =>
                `₹${Number(value).toLocaleString("en-IN")}`
            },

            grid: { color: theme.grid },
            border: { display: false }
          }
        }
      }
    });
  } else {
    monthlyChart.data.labels = monthlyData.labels;
    monthlyChart.data.datasets[0].data = monthlyData.values;

    monthlyChart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
    monthlyChart.options.plugins.tooltip.titleColor = theme.tooltipText;
    monthlyChart.options.plugins.tooltip.bodyColor = theme.tooltipText;

    monthlyChart.options.scales.x.ticks.color = theme.text;
    monthlyChart.options.scales.y.ticks.color = theme.text;
    monthlyChart.options.scales.y.grid.color = theme.grid;

    monthlyChart.update("none");
  }
}

/* ================= MONTHLY BUDGET ================= */

function renderBudget() {
  const month = localDate().slice(0, 7);

  const spent = expenses
    .filter(expense => expense.date.slice(0, 7) === month)
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  $("budget-amount").value = budget || "";
  $("budget-spent").textContent = money(spent);
  $("budget-remaining").textContent = money(budget - spent);

  const percent = budget
    ? Math.min(100, spent / budget * 100)
    : 0;

  $("budget-progress").style.width = `${percent}%`;

  $("budget-progress").classList.toggle(
    "over",
    budget > 0 && spent > budget
  );

  const status = $("budget-status");

  status.classList.toggle(
    "warning",
    budget > 0 && spent > budget
  );

  status.textContent = !budget
    ? "Set a budget to start tracking."
    : spent > budget
      ? `Budget exceeded by ${money(spent - budget)} (${(spent / budget * 100).toFixed(0)}% used).`
      : `${percent.toFixed(0)}% used · ${money(Math.max(0, budget - spent))} remaining.`;
}

$("budget-form").addEventListener("submit", event => {
  event.preventDefault();

  const amount = Number($("budget-amount").value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 100000000
  ) {
    return notify("Enter a valid monthly budget.", true);
  }

  const previous = budget;
  budget = Math.round(amount * 100) / 100;

  if (!persistBudget(budget)) {
    budget = previous;
    return;
  }

  renderBudget();
  notify("Monthly budget saved!");
});

/* ================= SAVINGS GOALS ================= */

function renderGoals() {
  const list = $("goals-list");

  list.replaceChildren();

  if (!goals.length) {
    list.appendChild(
      addText("p", "small-note", "No savings goals yet. Add one above.")
    );

    return;
  }

  goals.forEach(goal => {
    const item = document.createElement("div");
    item.className = "goal-item";

    const percent = Math.min(
      100,
      goal.saved / goal.target * 100
    );

    const top = document.createElement("div");
    top.className = "goal-top";

    top.append(
      addText("strong", "", goal.name),
      addText("span", "", `${percent.toFixed(0)}%`)
    );

    const track = document.createElement("div");
    track.className = "goal-progress";

    const fill = document.createElement("span");
    fill.style.width = `${percent}%`;

    track.appendChild(fill);

    const bottom = document.createElement("div");
    bottom.className = "goal-bottom";

    bottom.appendChild(
      addText(
        "small",
        "",
        `${money(goal.saved)} saved of ${money(goal.target)}`
      )
    );

    const actions = document.createElement("div");
    actions.className = "goal-actions";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = "+ Add savings";

    addButton.addEventListener("click", () => {
      contributeGoal(goal.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      deleteGoal(goal.id);
    });

    actions.append(addButton, deleteButton);
    bottom.appendChild(actions);

    item.append(top, track, bottom);
    list.appendChild(item);
  });
}

$("goal-form").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("goal-name").value.trim();
  const target = Number($("goal-target").value);
  const saved = Number($("goal-saved").value);

  if (
    !name ||
    name.length > 50 ||
    !Number.isFinite(target) ||
    target <= 0 ||
    target > 1000000000 ||
    !Number.isFinite(saved) ||
    saved < 0 ||
    saved > 1000000000
  ) {
    return notify("Enter a valid goal name and amounts.", true);
  }

  const item = {
    id: makeId(),
    name,
    target: Math.round(target * 100) / 100,
    saved: Math.round(saved * 100) / 100
  };

  goals.push(item);

  if (!persist(KEYS.goals, goals)) {
    goals = goals.filter(goal => goal.id !== item.id);
    return;
  }

  $("goal-form").reset();
  $("goal-saved").value = "0";

  renderGoals();
  notify("Savings goal added!");
});

function contributeGoal(id) {
  const goal = goals.find(item => item.id === id);

  if (!goal) return;

  const raw = prompt(
    `How much would you like to add to "${goal.name}"? (₹)`
  );

  if (raw === null) return;

  const amount = Number(raw);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000000
  ) {
    return notify("Enter a valid positive contribution.", true);
  }

  const previous = goal.saved;
  const next = Math.round((goal.saved + amount) * 100) / 100;

  if (!Number.isFinite(next) || next > 1000000000) {
    return notify("This contribution exceeds the supported limit.", true);
  }

  goal.saved = next;

  if (!persist(KEYS.goals, goals)) {
    goal.saved = previous;
    return;
  }

  renderGoals();

  notify(
    goal.saved >= goal.target
      ? "Congratulations! Savings target reached!"
      : "Savings contribution added!"
  );
}

function deleteGoal(id) {
  const goal = goals.find(item => item.id === id);

  if (!goal || !confirm(`Delete savings goal "${goal.name}"?`)) {
    return;
  }

  const previous = goals;
  goals = goals.filter(item => item.id !== id);

  if (!persist(KEYS.goals, goals)) {
    goals = previous;
    return;
  }

  renderGoals();
  notify("Savings goal deleted.");
}

/* ================= DARK MODE ================= */

function applyTheme(theme) {
  const dark = theme === "dark";

  document.body.classList.toggle("dark", dark);

  $("theme-toggle").innerHTML = dark
    ? "☀ <span>Light mode</span>"
    : "☾ <span>Dark mode</span>";

  $("theme-toggle").setAttribute(
    "aria-pressed",
    String(dark)
  );

  try {
    localStorage.setItem(KEYS.theme, dark ? "dark" : "light");
  } catch (error) {
    console.warn("Theme preference could not be saved.", error);
  }

  renderCharts();
}

let savedTheme = "light";

try {
  savedTheme = localStorage.getItem(KEYS.theme) || "light";
} catch (error) {
  console.warn("Theme preference could not be read.", error);
}

applyTheme(savedTheme);

$("theme-toggle").addEventListener("click", () => {
  applyTheme(
    document.body.classList.contains("dark")
      ? "light"
      : "dark"
  );
});

/* ================= PDF MONTHLY REPORT ================= */

$("report-month").value = localDate().slice(0, 7);

$("pdf-btn").addEventListener("click", () => {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    return notify(
      "PDF library did not load. Check internet and reload.",
      true,
      $("backup-message")
    );
  }

  const month = $("report-month").value;

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return notify(
      "Select a month for the report.",
      true,
      $("backup-message")
    );
  }

  const records = expenses
    .filter(expense => expense.date.slice(0, 7) === month)
    .sort((a, b) => a.date.localeCompare(b.date));

  const total = records.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  const doc = new window.jspdf.jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const rightEdge = pageWidth - margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(118, 87, 246);

  doc.text("Spendly - Monthly Expense Report", margin, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 110);

  doc.text(`Month: ${month}`, margin, 30);
  doc.text(`Transactions: ${records.length}`, margin, 37);
  doc.text(`Total spent: ${money(total)}`, margin, 44);

  let y = 56;

  function drawTableHeader() {
    doc.setFillColor(241, 237, 255);
    doc.rect(margin, y - 6, pageWidth - margin * 2, 10, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(65, 55, 110);

    doc.text("Date", margin + 2, y);
    doc.text("Expense", 42, y);
    doc.text("Category", 112, y);
    doc.text("Amount", rightEdge - 2, y, { align: "right" });

    y += 11;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(65, 65, 80);
  }

  function nextPage() {
    doc.addPage();
    y = 20;
    drawTableHeader();
  }

  drawTableHeader();

  if (!records.length) {
    doc.setFontSize(10);
    doc.text("No expenses recorded for this month.", margin, y + 3);
    y += 15;
  }

  records.forEach(expense => {
    const titleLines = doc.splitTextToSize(expense.title, 61);
    const categoryLines = doc.splitTextToSize(expense.category, 35);

    const rowHeight = Math.max(
      9,
      titleLines.length * 4.5,
      categoryLines.length * 4.5
    );

    if (y + rowHeight > pageHeight - 22) {
      nextPage();
    }

    doc.setFontSize(8.5);

    doc.text(displayDate(expense.date), margin + 2, y);
    doc.text(titleLines, 42, y);
    doc.text(categoryLines, 112, y);

    doc.text(
      money(expense.amount),
      rightEdge - 2,
      y,
      { align: "right" }
    );

    y += rowHeight + 3;

    doc.setDrawColor(232, 230, 240);
    doc.line(margin, y - 1, rightEdge, y - 1);
  });

  if (y + 15 > pageHeight - 15) {
    doc.addPage();
    y = 22;
  } else {
    y += 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(118, 87, 246);

  doc.text(`Total: ${money(total)}`, margin, y);

  doc.save(`spendly-report-${month}.pdf`);

  notify(
    "PDF report generated.",
    false,
    $("backup-message")
  );
});

/* ================= JSON BACKUP EXPORT ================= */

$("backup-export").addEventListener("click", () => {
  const backup = {
    app: "Spendly",
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses,
    budget,
    goals
  };

  downloadBlob(
    JSON.stringify(backup, null, 2),
    "application/json",
    `spendly-backup-${localDate()}.json`
  );

  notify("Backup downloaded.", false, $("backup-message"));
});

/* ================= JSON BACKUP IMPORT ================= */

$("backup-import-trigger").addEventListener("click", () => {
  $("backup-file").click();
});

$("backup-file").addEventListener("change", async event => {
  const file = event.target.files[0];

  if (!file) return;

  try {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Backup file is too large (maximum 5 MB).");
    }

    const data = JSON.parse(await file.text());

    if (
      !data ||
      data.app !== "Spendly" ||
      data.version !== 1 ||
      !Array.isArray(data.expenses) ||
      !Array.isArray(data.goals)
    ) {
      throw new Error("This is not a valid Spendly backup.");
    }

    if (data.expenses.length > 10000 || data.goals.length > 500) {
      throw new Error("Backup contains too many records.");
    }

    if (!data.expenses.every(validateExpense)) {
      throw new Error("Some expenses contain invalid data.");
    }

    if (!data.goals.every(validateGoal)) {
      throw new Error("Some savings goals contain invalid data.");
    }

    const newBudget = Number(data.budget ?? 0);

    if (
      !Number.isFinite(newBudget) ||
      newBudget < 0 ||
      newBudget > 100000000
    ) {
      throw new Error("Budget value is invalid.");
    }

    const cleanExpenses = data.expenses.map(expense => ({
      id: expense.id,
      title: expense.title.trim(),
      amount: Math.round(Number(expense.amount) * 100) / 100,
      category: expense.category,
      date: expense.date,
      payment: validPayments.includes(expense.payment)
        ? expense.payment
        : "UPI",
      notes: typeof expense.notes === "string"
        ? expense.notes.slice(0, 200)
        : ""
    }));

    const cleanGoals = data.goals.map(goal => ({
      id: goal.id,
      name: goal.name.trim(),
      target: Number(goal.target),
      saved: Number(goal.saved)
    }));

    if (!confirm(
      `Import ${cleanExpenses.length} expenses and ${cleanGoals.length} savings goals? This replaces current Spendly data.`
    )) {
      return;
    }

    const previous = {
      expenses: localStorage.getItem(KEYS.expenses),
      goals: localStorage.getItem(KEYS.goals),
      budget: localStorage.getItem(KEYS.budget)
    };

    try {
      localStorage.setItem(
        KEYS.expenses,
        JSON.stringify(cleanExpenses)
      );

      localStorage.setItem(
        KEYS.goals,
        JSON.stringify(cleanGoals)
      );

      localStorage.setItem(
        KEYS.budget,
        String(newBudget)
      );
    } catch (error) {
      try {
        if (previous.expenses === null) {
          localStorage.removeItem(KEYS.expenses);
        } else {
          localStorage.setItem(KEYS.expenses, previous.expenses);
        }

        if (previous.goals === null) {
          localStorage.removeItem(KEYS.goals);
        } else {
          localStorage.setItem(KEYS.goals, previous.goals);
        }

        if (previous.budget === null) {
          localStorage.removeItem(KEYS.budget);
        } else {
          localStorage.setItem(KEYS.budget, previous.budget);
        }
      } catch (rollbackError) {
        console.error("Backup rollback failed.", rollbackError);
      }

      throw new Error(
        "Could not store imported data. Browser storage may be full."
      );
    }

    expenses = cleanExpenses;
    goals = cleanGoals;
    budget = newBudget;

    resetExpenseForm();
    renderExpenses();
    renderGoals();
    renderBudget();

    notify(
      "Backup imported successfully.",
      false,
      $("backup-message")
    );
  } catch (error) {
    notify(
      error.message || "Could not import backup.",
      true,
      $("backup-message")
    );
  } finally {
    event.target.value = "";
  }
});

/* ================= INITIAL PAGE SETUP ================= */

dateInput.max = localDate();
dateInput.value = localDate();

$("report-month").value = localDate().slice(0, 7);

renderExpenses();
renderGoals();
renderBudget();