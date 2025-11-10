import { normalizeDate, formatMonthYear } from "../utils.js";

const PLOTLY_ERROR_MESSAGE = "Не удалось загрузить модуль визуализации.";
const UNCATEGORIZED_SUBCATEGORY = "Без подкатегории";

export function initAnalyticsTab({ root, categories = [] }) {
  const monthlyCategoryBreakdownEl = root.querySelector("#monthly-category-breakdown");
  const monthlyCategoryCaptionEl = root.querySelector("#monthly-category-caption");
  const monthlyTrendsEl = root.querySelector("#monthly-trends");
  const categoryTrendsEl = root.querySelector("#category-trends");
  const subcategoryTrendsEl = root.querySelector("#subcategory-trends");
  const subcategoryTitleEl = root.querySelector("#subcategory-title");
  const categorySelectEl = root.querySelector("#category-select");
  const forecastEl = root.querySelector("#forecast");

  let categoryList = categories;
  let transactions = [];
  let selectedCategory = "";

  function hasPlotly() {
    return typeof window !== "undefined" && typeof window.Plotly !== "undefined";
  }

  function setEmptyState(element, message) {
    if (!element) return;
    if (hasPlotly() && typeof window.Plotly.purge === "function") {
      window.Plotly.purge(element);
    }
    element.classList.add("empty-state");
    element.textContent = message;
  }

  function getCategoryLabel(value) {
    return categoryList.find((category) => category.value === value)?.label || value || "Прочее";
  }

  function getCategoryDisplayName(value) {
    const category = categoryList.find((item) => item.value === value);
    if (!category) {
      return value || "Прочее";
    }
    const label = category.label || value || "Прочее";
    return category.emoji ? `${category.emoji} ${label}` : label;
  }

  function buildExpenseStructure() {
    const expenses = transactions.filter((tx) => tx.type === "expense");
    const monthMap = new Map();
    const categoriesMap = new Map();
    const subcategoriesMap = new Map();

    expenses.forEach((tx) => {
      const date = normalizeDate(tx.date);
      if (!date) return;

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          key: monthKey,
          year,
          month,
          label: formatMonthYear(year, month)
        });
      }

      const majorKey = tx.majorCategory || "other";
      if (!categoriesMap.has(majorKey)) {
        categoriesMap.set(majorKey, new Map());
      }
      const categoryMonthMap = categoriesMap.get(majorKey);
      categoryMonthMap.set(monthKey, (categoryMonthMap.get(monthKey) || 0) + tx.amount);

      const rawSubCategory = typeof tx.subCategory === "string" ? tx.subCategory.trim() : "";
      const subKey = rawSubCategory || UNCATEGORIZED_SUBCATEGORY;
      if (!subcategoriesMap.has(majorKey)) {
        subcategoriesMap.set(majorKey, new Map());
      }
      const categorySubMap = subcategoriesMap.get(majorKey);
      if (!categorySubMap.has(subKey)) {
        categorySubMap.set(subKey, new Map());
      }
      const subMonthMap = categorySubMap.get(subKey);
      subMonthMap.set(monthKey, (subMonthMap.get(monthKey) || 0) + tx.amount);
    });

    const months = Array.from(monthMap.values()).sort((a, b) => {
      if (a.year === b.year) {
        return a.month - b.month;
      }
      return a.year - b.year;
    });

    return {
      months,
      categoriesMap,
      subcategoriesMap,
      hasExpenses: expenses.length > 0
    };
  }

  function renderMonthlyCategoryBreakdown() {
    if (!monthlyCategoryBreakdownEl) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthLabel = formatMonthYear(year, month);

    if (monthlyCategoryCaptionEl) {
      monthlyCategoryCaptionEl.textContent = `Месяц: ${monthLabel}`;
    }

    const expenses = transactions.filter((tx) => {
      if (tx.type !== "expense") return false;
      const date = normalizeDate(tx.date);
      if (!date) return false;
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });

    if (!expenses.length) {
      setEmptyState(monthlyCategoryBreakdownEl, "В этом месяце расходов пока не было.");
      return;
    }

    if (!hasPlotly()) {
      setEmptyState(monthlyCategoryBreakdownEl, PLOTLY_ERROR_MESSAGE);
      return;
    }

    const categoryMap = new Map();

    expenses.forEach((tx) => {
      const categoryKey = tx.majorCategory || "other";
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          key: categoryKey,
          label: getCategoryDisplayName(categoryKey),
          total: 0,
          subMap: new Map()
        });
      }
      const entry = categoryMap.get(categoryKey);
      const amount = tx.amount || 0;
      entry.total += amount;

      const rawSubcategory = typeof tx.subCategory === "string" ? tx.subCategory.trim() : "";
      const subcategoryKey = rawSubcategory || UNCATEGORIZED_SUBCATEGORY;
      entry.subMap.set(subcategoryKey, (entry.subMap.get(subcategoryKey) || 0) + amount);
    });

    const categoriesData = Array.from(categoryMap.values()).filter((item) => item.total > 0);

    if (!categoriesData.length) {
      setEmptyState(monthlyCategoryBreakdownEl, "В этом месяце расходов пока не было.");
      return;
    }

    categoriesData.sort((a, b) => b.total - a.total);

    const subcategoryTotals = new Map();
    categoriesData.forEach((category) => {
      category.subMap.forEach((amount, name) => {
        subcategoryTotals.set(name, (subcategoryTotals.get(name) || 0) + amount);
      });
    });

    const subcategoryNames = Array.from(subcategoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const categoryLabels = categoriesData.map((category) => category.label);

    const traces = subcategoryNames.map((name) => ({
      x: categoryLabels,
      y: categoriesData.map((category) => category.subMap.get(name) || 0),
      name,
      type: "bar",
      hovertemplate: "%{y:.2f} ₽<extra>%{fullData.name}</extra>"
    }));

    if (!traces.length) {
      setEmptyState(monthlyCategoryBreakdownEl, "В этом месяце расходов пока не было.");
      return;
    }

    monthlyCategoryBreakdownEl.classList.remove("empty-state");
    monthlyCategoryBreakdownEl.textContent = "";

    window.Plotly.react(
      monthlyCategoryBreakdownEl,
      traces,
      {
        height: 360,
        margin: { t: 20, r: 20, b: 80, l: 60 },
        barmode: "stack",
        legend: { orientation: "h", x: 0, y: 1.15 },
        xaxis: { title: "Категория", tickangle: -30 },
        yaxis: { title: "Расходы, ₽" },
        template: "plotly_white"
      },
      { displayModeBar: false, responsive: true }
    );
  }

  function renderMonthlyTrends() {
    if (!monthlyTrendsEl) return;

    if (!transactions.length) {
      setEmptyState(monthlyTrendsEl, "Пока нет данных для анализа.");
      return;
    }

    const monthlyMap = new Map();

    transactions.forEach((tx) => {
      const date = normalizeDate(tx.date);
      if (!date) return;

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          key: monthKey,
          year,
          month,
          label: formatMonthYear(year, month),
          income: 0,
          expense: 0
        });
      }

      const record = monthlyMap.get(monthKey);
      if (tx.type === "income") {
        record.income += tx.amount;
      }
      if (tx.type === "expense") {
        record.expense += tx.amount;
      }
    });

    const sorted = Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.year === b.year) {
        return a.month - b.month;
      }
      return a.year - b.year;
    });

    if (!sorted.length) {
      setEmptyState(monthlyTrendsEl, "Недостаточно данных для графика.");
      return;
    }

    if (!hasPlotly()) {
      setEmptyState(monthlyTrendsEl, PLOTLY_ERROR_MESSAGE);
      return;
    }

    const monthKeys = sorted.map((item) => item.key);
    const monthLabels = sorted.map((item) => item.label);
    const incomes = sorted.map((item) => item.income);
    const expenses = sorted.map((item) => item.expense);
    const deltas = sorted.map((item) => item.income - item.expense);

    monthlyTrendsEl.classList.remove("empty-state");
    monthlyTrendsEl.textContent = "";

    window.Plotly.react(
      monthlyTrendsEl,
      [
        {
          x: monthKeys,
          y: incomes,
          name: "Доходы",
          mode: "lines+markers",
          line: { color: "#2f9e44", width: 3 },
          hovertemplate: "%{y:.2f} ₽<extra>%{fullData.name}</extra>"
        },
        {
          x: monthKeys,
          y: expenses,
          name: "Расходы",
          mode: "lines+markers",
          line: { color: "#c92a2a", width: 3 },
          hovertemplate: "%{y:.2f} ₽<extra>%{fullData.name}</extra>"
        },
        {
          x: monthKeys,
          y: deltas,
          name: "Дельта",
          mode: "lines+markers",
          line: { color: "#364fc7", width: 3, dash: "dot" },
          hovertemplate: "%{y:.2f} ₽<extra>%{fullData.name}</extra>"
        }
      ],
      {
        height: 360,
        margin: { t: 20, r: 20, b: 60, l: 60 },
        hovermode: "x unified",
        legend: { orientation: "h", x: 0, y: 1.15 },
        xaxis: {
          tickmode: "array",
          tickvals: monthKeys,
          ticktext: monthLabels,
          title: "Месяц"
        },
        yaxis: { title: "Сумма, ₽" },
        template: "plotly_white"
      },
      { displayModeBar: false, responsive: true }
    );
  }

  function updateCategorySelectOptions(categoryKeys) {
    if (!categorySelectEl) return;

    const previousValue = selectedCategory;
    categorySelectEl.innerHTML = "";

    if (!categoryKeys.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Нет данных";
      categorySelectEl.appendChild(option);
      categorySelectEl.disabled = true;
      selectedCategory = "";
      if (subcategoryTitleEl) {
        subcategoryTitleEl.textContent = "";
      }
      return;
    }

    const sortedKeys = categoryKeys
      .map((key) => ({ key, label: getCategoryLabel(key) }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));

    sortedKeys.forEach(({ key, label }) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      categorySelectEl.appendChild(option);
    });

    const keys = sortedKeys.map((item) => item.key);
    selectedCategory = previousValue && keys.includes(previousValue) ? previousValue : sortedKeys[0].key;
    categorySelectEl.disabled = false;
    categorySelectEl.value = selectedCategory;
  }

  function renderCategoryTrends() {
    if (!categoryTrendsEl) return;

    const structure = buildExpenseStructure();

    if (!structure.hasExpenses) {
      setEmptyState(categoryTrendsEl, "Расходов пока нет.");
      updateCategorySelectOptions([]);
      renderSubcategoryTrends(structure);
      return;
    }

    if (!structure.months.length) {
      setEmptyState(categoryTrendsEl, "Недостаточно данных для анализа.");
      updateCategorySelectOptions([]);
      renderSubcategoryTrends(structure);
      return;
    }

    if (!hasPlotly()) {
      setEmptyState(categoryTrendsEl, PLOTLY_ERROR_MESSAGE);
      updateCategorySelectOptions([]);
      renderSubcategoryTrends(structure);
      return;
    }

    const monthKeys = structure.months.map((item) => item.key);
    const monthLabels = structure.months.map((item) => item.label);

    const traces = [];
    const activeCategoryKeys = [];
    structure.categoriesMap.forEach((monthMap, categoryKey) => {
      const values = monthKeys.map((month) => monthMap.get(month) || 0);
      if (!values.some((value) => value > 0)) {
        return;
      }
      activeCategoryKeys.push(categoryKey);
      traces.push({
        x: monthLabels,
        y: values,
        name: getCategoryLabel(categoryKey),
        type: "bar",
        hovertemplate: "%{y:.2f} ₽<extra>%{fullData.name}</extra>"
      });
    });

    if (!traces.length) {
      setEmptyState(categoryTrendsEl, "Расходов пока нет.");
      updateCategorySelectOptions([]);
      renderSubcategoryTrends(structure);
      return;
    }

    categoryTrendsEl.classList.remove("empty-state");
    categoryTrendsEl.textContent = "";

    window.Plotly.react(
      categoryTrendsEl,
      traces,
      {
        height: 360,
        margin: { t: 20, r: 20, b: 60, l: 60 },
        barmode: "stack",
        hovermode: "x",
        legend: { orientation: "h", x: 0, y: 1.15 },
        xaxis: {
          title: "Месяц"
        },
        yaxis: { title: "Сумма расходов, ₽" },
        template: "plotly_white"
      },
      { displayModeBar: false, responsive: true }
    );

    updateCategorySelectOptions(activeCategoryKeys);
    renderSubcategoryTrends(structure);
  }

  function renderSubcategoryTrends(preparedStructure) {
    if (!subcategoryTrendsEl) return;

    const structure = preparedStructure || buildExpenseStructure();

    if (!structure.hasExpenses) {
      setEmptyState(subcategoryTrendsEl, "Расходов пока нет.");
      if (subcategoryTitleEl) {
        subcategoryTitleEl.textContent = "";
      }
      return;
    }

    if (!hasPlotly()) {
      setEmptyState(subcategoryTrendsEl, PLOTLY_ERROR_MESSAGE);
      if (subcategoryTitleEl) {
        subcategoryTitleEl.textContent = selectedCategory ? getCategoryLabel(selectedCategory) : "";
      }
      return;
    }

    const monthKeys = structure.months.map((item) => item.key);
    const monthLabels = structure.months.map((item) => item.label);

    if (!monthKeys.length) {
      setEmptyState(subcategoryTrendsEl, "Недостаточно данных для анализа.");
      if (subcategoryTitleEl) {
        subcategoryTitleEl.textContent = "";
      }
      return;
    }

    if (!selectedCategory) {
      setEmptyState(subcategoryTrendsEl, "Выберите категорию, чтобы увидеть динамику подкатегорий.");
      if (subcategoryTitleEl) {
        subcategoryTitleEl.textContent = "";
      }
      return;
    }

    const subcategoryMap = structure.subcategoriesMap.get(selectedCategory);

    if (!subcategoryMap || !subcategoryMap.size) {
      setEmptyState(subcategoryTrendsEl, "Для выбранной категории нет детализированных расходов.");
      if (subcategoryTitleEl) {
        subcategoryTitleEl.textContent = getCategoryLabel(selectedCategory);
      }
      return;
    }

    const traces = [];
    Array.from(subcategoryMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, "ru"))
      .forEach(([subcategoryName, monthMap]) => {
        const values = monthKeys.map((monthKey) => monthMap.get(monthKey) || 0);
        if (!values.some((value) => value > 0)) {
          return;
        }
        traces.push({
          x: monthLabels,
          y: values,
          name: subcategoryName,
          type: "bar",
          hovertemplate: "%{y:.2f} ₽<extra>%{fullData.name}</extra>"
        });
      });

    if (!traces.length) {
      setEmptyState(subcategoryTrendsEl, "Для выбранной категории нет детализированных расходов.");
      if (subcategoryTitleEl) {
        subcategoryTitleEl.textContent = getCategoryLabel(selectedCategory);
      }
      return;
    }

    if (subcategoryTitleEl) {
      subcategoryTitleEl.textContent = `Подкатегории: ${getCategoryLabel(selectedCategory)}`;
    }

    subcategoryTrendsEl.classList.remove("empty-state");
    subcategoryTrendsEl.textContent = "";

    window.Plotly.react(
      subcategoryTrendsEl,
      traces,
      {
        height: 360,
        margin: { t: 20, r: 20, b: 60, l: 60 },
        barmode: "stack",
        hovermode: "x",
        legend: { orientation: "h", x: 0, y: 1.15 },
        xaxis: {
          title: "Месяц"
        },
        yaxis: { title: "Сумма расходов, ₽" },
        template: "plotly_white"
      },
      { displayModeBar: false, responsive: true }
    );
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

  function render() {
    renderMonthlyCategoryBreakdown();
    renderMonthlyTrends();
    renderCategoryTrends();
    updateForecast();
  }

  categorySelectEl?.addEventListener("change", (event) => {
    selectedCategory = event.target.value;
    renderSubcategoryTrends();
  });

  return {
    updateTransactions(nextTransactions) {
      transactions = Array.isArray(nextTransactions) ? nextTransactions : [];
      render();
    },
    updateCategories(nextCategories) {
      categoryList = Array.isArray(nextCategories) ? nextCategories : [];
      renderCategoryTrends();
      renderMonthlyCategoryBreakdown();
    }
  };
}
