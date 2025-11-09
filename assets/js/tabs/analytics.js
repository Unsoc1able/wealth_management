import { normalizeDate } from "../utils.js";

export function initAnalyticsTab({ root, categories = [] }) {
  const monthlyOverviewEl = root.querySelector("#monthly-overview");
  const categoryBreakdownEl = root.querySelector("#category-breakdown");
  const forecastEl = root.querySelector("#forecast");
  const recentTransactionsEl = root.querySelector("#recent-transactions");

  let categoryList = categories;
  let transactions = [];

  function updateMonthlyOverview() {
    if (!monthlyOverviewEl) return;
    if (!transactions.length) {
      monthlyOverviewEl.textContent = "Пока нет данных.";
      monthlyOverviewEl.classList.add("empty-state");
      return;
    }

    const monthlyMap = new Map();

    transactions.forEach((tx) => {
      const date = normalizeDate(tx.date);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { income: 0, expense: 0 });
      }
      const record = monthlyMap.get(key);
      if (tx.type === "income") {
        record.income += tx.amount;
      } else if (tx.type === "expense") {
        record.expense += tx.amount;
      }
    });

    const sortedEntries = Array.from(monthlyMap.entries()).sort((a, b) => (a[0] > b[0] ? -1 : 1));
    monthlyOverviewEl.classList.remove("empty-state");
    monthlyOverviewEl.innerHTML = "";

    const list = document.createElement("ul");
    sortedEntries.forEach(([month, values]) => {
      const net = values.income - values.expense;
      const item = document.createElement("li");
      item.innerHTML = `<strong>${month}</strong>: доход ${values.income.toFixed(2)}, расход ${values.expense.toFixed(2)}, нетто ${net.toFixed(2)}`;
      list.appendChild(item);
    });

    monthlyOverviewEl.appendChild(list);
  }

  function updateCategoryBreakdown() {
    if (!categoryBreakdownEl) return;

    const expenses = transactions.filter((tx) => tx.type === "expense");

    if (!expenses.length) {
      categoryBreakdownEl.textContent = "Расходов пока нет.";
      categoryBreakdownEl.classList.add("empty-state");
      return;
    }

    const categoryTotals = new Map();
    const monthsSet = new Set();

    expenses.forEach((tx) => {
      const date = normalizeDate(tx.date);
      if (!date) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthsSet.add(monthKey);
      const key = tx.majorCategory || "other";
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + tx.amount);
    });

    const monthsCount = monthsSet.size || 1;

    categoryBreakdownEl.classList.remove("empty-state");
    categoryBreakdownEl.innerHTML = "";

    const list = document.createElement("ul");
    categoryTotals.forEach((total, key) => {
      const categoryName = categoryList.find((c) => c.value === key)?.label || key;
      const avg = total / monthsCount;
      const item = document.createElement("li");
      item.textContent = `${categoryName} — всего ${total.toFixed(2)}, в среднем ${avg.toFixed(2)} в месяц`;
      list.appendChild(item);
    });

    categoryBreakdownEl.appendChild(list);
  }

  function updateForecast() {
    if (!forecastEl) return;

    const monthlyMap = new Map();

    transactions.forEach((tx) => {
      const date = normalizeDate(tx.date);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { income: 0, expense: 0 });
      }
      const record = monthlyMap.get(key);
      if (tx.type === "income") {
        record.income += tx.amount;
      } else if (tx.type === "expense") {
        record.expense += tx.amount;
      }
    });

    const sorted = Array.from(monthlyMap.entries())
      .sort((a, b) => (a[0] > b[0] ? -1 : 1))
      .slice(0, 3);

    if (sorted.length < 2) {
      forecastEl.textContent = "Недостаточно данных для прогноза.";
      forecastEl.classList.add("empty-state");
      return;
    }

    const netValues = sorted.map(([, values]) => values.income - values.expense);
    const averageNet = netValues.reduce((sum, value) => sum + value, 0) / netValues.length;
    const twoMonthForecast = averageNet * 2;

    forecastEl.classList.remove("empty-state");
    forecastEl.innerHTML = `
      <p>Ожидаемый средний месячный нетто-результат: <strong>${averageNet.toFixed(2)}</strong></p>
      <p>Прогноз на 2 месяца: <strong>${twoMonthForecast.toFixed(2)}</strong></p>
      <p class="muted">Учитываются последние ${sorted.length} месяца(ев) с данными.</p>
    `;
  }

  function updateRecentTransactions() {
    if (!recentTransactionsEl) return;

    if (!transactions.length) {
      recentTransactionsEl.textContent = "Пока нет данных.";
      recentTransactionsEl.classList.add("empty-state");
      return;
    }

    const sorted = [...transactions]
      .sort((a, b) => {
        const dateA = normalizeDate(a.date);
        const dateB = normalizeDate(b.date);
        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
      })
      .slice(0, 10);

    recentTransactionsEl.classList.remove("empty-state");
    recentTransactionsEl.innerHTML = "";

    sorted.forEach((tx) => {
      const date = normalizeDate(tx.date) || new Date();
      const categoryName = categoryList.find((c) => c.value === tx.majorCategory)?.label || tx.majorCategory || "Без категории";
      const sign = tx.type === "income" ? "+" : "-";
      const item = document.createElement("div");
      item.className = "transaction-item";
      item.innerHTML = `
        <div class="info-line">
          <span>${date.toLocaleDateString()}</span>
          <strong>${sign}${tx.amount.toFixed(2)}</strong>
        </div>
        <div class="muted">${categoryName}${tx.subCategory ? ` / ${tx.subCategory}` : ""}</div>
        ${tx.note ? `<div>${tx.note}</div>` : ""}
      `;
      recentTransactionsEl.appendChild(item);
    });
  }

  function render() {
    updateMonthlyOverview();
    updateCategoryBreakdown();
    updateForecast();
    updateRecentTransactions();
  }

  return {
    updateTransactions(nextTransactions) {
      transactions = Array.isArray(nextTransactions) ? nextTransactions : [];
      render();
    },
    updateCategories(nextCategories) {
      categoryList = Array.isArray(nextCategories) ? nextCategories : [];
      updateCategoryBreakdown();
      updateRecentTransactions();
    }
  };
}
