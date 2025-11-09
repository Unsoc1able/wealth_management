import { normalizeDate, getCurrentDateValue, getCurrentMonthValue, formatMonthYear } from "../utils.js";

export function initOperationsTab({
  root,
  categories = [],
  onAddTransaction,
  onRefresh,
  getErrorMessage
}) {
  const form = root.querySelector("#transaction-form");
  const formStatus = root.querySelector("#form-status");
  const dateInput = root.querySelector("#date");
  const amountInput = root.querySelector("#amount");
  const typeSelect = root.querySelector("#type");
  const majorCategorySelect = root.querySelector("#major-category");
  const subCategoryInput = root.querySelector("#sub-category");
  const subCategorySuggestions = root.querySelector("#sub-category-suggestions");
  const noteInput = root.querySelector("#note");
  const monthFilterInput = root.querySelector("#month-filter");
  const refreshButton = root.querySelector("#refresh-button");
  const refreshStatus = root.querySelector("#refresh-status");
  const monthlySummaryEl = root.querySelector("#monthly-summary");
  const monthlyTransactionsEl = root.querySelector("#monthly-transactions");

  let categoryList = categories;
  let transactions = [];

  setDefaultDate();
  setDefaultMonth();
  renderCategoryOptions();

  monthFilterInput?.addEventListener("change", () => updateMonthlyView());

  refreshButton?.addEventListener("click", async () => {
    if (!onRefresh) return;
    refreshButton.disabled = true;
    if (refreshStatus) {
      refreshStatus.textContent = "Обновление...";
    }

    try {
      await onRefresh();
      if (refreshStatus) {
        refreshStatus.textContent = "Данные обновлены.";
        setTimeout(() => {
          if (refreshStatus.textContent === "Данные обновлены.") {
            refreshStatus.textContent = "";
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Ошибка ручного обновления", error);
      if (refreshStatus) {
        refreshStatus.textContent = formatError(error);
      }
    } finally {
      refreshButton.disabled = false;
    }
  });

  majorCategorySelect?.addEventListener("change", () => {
    updateSubCategorySuggestions(majorCategorySelect.value);
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!onAddTransaction) return;

    const dateValue = dateInput?.value;
    const amountValue = parseFloat(amountInput?.value || "0");
    const typeValue = typeSelect?.value || "expense";
    const majorCategoryValue = majorCategorySelect?.value || "other";
    const subCategoryValue = subCategoryInput?.value.trim();
    const noteValue = noteInput?.value.trim();

    if (!dateValue || !amountValue || amountValue <= 0) {
      if (formStatus) {
        formStatus.textContent = "Пожалуйста, заполните дату и сумму больше 0.";
      }
      return;
    }

    if (formStatus) {
      formStatus.textContent = "Сохранение...";
    }

    try {
      await onAddTransaction({
        date: new Date(dateValue),
        amount: amountValue,
        type: typeValue,
        majorCategory: majorCategoryValue,
        subCategory: subCategoryValue,
        note: noteValue
      });

      form?.reset();
      setDefaultDate();
      updateSubCategorySuggestions(majorCategorySelect?.value);
      if (formStatus) {
        formStatus.textContent = "Готово! Транзакция добавлена.";
      }
    } catch (error) {
      console.error("Ошибка при добавлении транзакции", error);
      if (formStatus) {
        formStatus.textContent = formatError(error);
      }
    }
  });

  function formatError(error) {
    return typeof getErrorMessage === "function"
      ? getErrorMessage(error)
      : "Не удалось выполнить операцию.";
  }

  function setDefaultDate() {
    if (dateInput) {
      dateInput.value = getCurrentDateValue();
    }
  }

  function setDefaultMonth() {
    if (monthFilterInput) {
      monthFilterInput.value = getCurrentMonthValue();
    }
  }

  function renderCategoryOptions() {
    if (!majorCategorySelect) return;
    const currentValue = majorCategorySelect.value;
    majorCategorySelect.innerHTML = "";
    categoryList.forEach((category, index) => {
      const option = document.createElement("option");
      option.value = category.value;
      option.textContent = category.label;
      if (category.value === currentValue || (!currentValue && index === 0)) {
        option.selected = true;
      }
      majorCategorySelect.appendChild(option);
    });
    updateSubCategorySuggestions(majorCategorySelect.value);
  }

  function updateSubCategorySuggestions(categoryValue) {
    if (!subCategorySuggestions) return;
    subCategorySuggestions.innerHTML = "";
    const target = categoryList.find((category) => category.value === categoryValue);
    target?.subCategories?.forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      subCategorySuggestions.appendChild(option);
    });
  }

  function updateMonthlyView() {
    if (!monthlyTransactionsEl) return;

    const monthValue = monthFilterInput?.value;
    if (!monthValue) {
      monthlyTransactionsEl.textContent = "Выберите месяц для отображения операций.";
      monthlyTransactionsEl.classList.add("empty-state");
      if (monthlySummaryEl) {
        monthlySummaryEl.innerHTML = "";
      }
      return;
    }

    const [yearStr, monthStr] = monthValue.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (!year || !month) {
      monthlyTransactionsEl.textContent = "Не удалось определить месяц.";
      monthlyTransactionsEl.classList.add("empty-state");
      if (monthlySummaryEl) {
        monthlySummaryEl.innerHTML = "";
      }
      return;
    }

    const filtered = transactions.filter((tx) => {
      const date = normalizeDate(tx.date);
      return date && date.getFullYear() === year && date.getMonth() + 1 === month;
    });

    if (!filtered.length) {
      monthlyTransactionsEl.textContent = "За выбранный месяц пока нет данных.";
      monthlyTransactionsEl.classList.add("empty-state");
      if (monthlySummaryEl) {
        monthlySummaryEl.innerHTML = "";
      }
      return;
    }

    let incomeTotal = 0;
    let expenseTotal = 0;

    const list = document.createElement("div");
    list.className = "transaction-list";

    filtered
      .slice()
      .sort((a, b) => {
        const dateA = normalizeDate(a.date);
        const dateB = normalizeDate(b.date);
        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
      })
      .forEach((tx) => {
        if (tx.type === "income") {
          incomeTotal += tx.amount;
        } else if (tx.type === "expense") {
          expenseTotal += tx.amount;
        }

        const date = normalizeDate(tx.date) || new Date();
        const categoryName =
          categoryList.find((c) => c.value === tx.majorCategory)?.label || tx.majorCategory || "Без категории";
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
        list.appendChild(item);
      });

    monthlyTransactionsEl.classList.remove("empty-state");
    monthlyTransactionsEl.innerHTML = "";
    monthlyTransactionsEl.appendChild(list);

    if (monthlySummaryEl) {
      const net = incomeTotal - expenseTotal;
      const totalOperations = filtered.length;
      const monthLabel = formatMonthYear(year, month);
      monthlySummaryEl.innerHTML = `
        <div class="summary-card">
          <strong>Месяц</strong>
          <span>${monthLabel}</span>
        </div>
        <div class="summary-card">
          <strong>Доходы</strong>
          <span>${incomeTotal.toFixed(2)}</span>
        </div>
        <div class="summary-card">
          <strong>Расходы</strong>
          <span>${expenseTotal.toFixed(2)}</span>
        </div>
        <div class="summary-card">
          <strong>Баланс</strong>
          <span>${net.toFixed(2)}</span>
        </div>
        <div class="summary-card">
          <strong>Операций</strong>
          <span>${totalOperations}</span>
        </div>
      `;
    }
  }

  return {
    updateTransactions(nextTransactions) {
      transactions = Array.isArray(nextTransactions) ? nextTransactions : [];
      if (refreshStatus && refreshStatus.textContent === "Обновление...") {
        refreshStatus.textContent = "";
      }
      updateMonthlyView();
    },
    updateCategories(nextCategories) {
      categoryList = Array.isArray(nextCategories) ? nextCategories : [];
      renderCategoryOptions();
    }
  };
}
