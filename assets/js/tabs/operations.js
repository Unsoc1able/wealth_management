import {
  normalizeDate,
  getCurrentDateValue,
  getCurrentMonthValue,
  formatMonthYear,
  setupFormattedNumberInput,
  getNumericInputValue
} from "../utils.js";

export function initOperationsTab({
  root,
  categories = [],
  onAddTransaction,
  onRefresh,
  getErrorMessage
}) {
  const sheet = root.querySelector("#transaction-sheet");
  const openSheetButton = root.querySelector("#open-transaction-sheet");
  const closeSheetButton = root.querySelector("#close-transaction-sheet");
  const form = root.querySelector("#transaction-form");
  const formStatus = root.querySelector("#form-status");
  const dateInput = root.querySelector("#date");
  const amountInput = root.querySelector("#amount");
  const typeSelect = root.querySelector("#type");
  const majorCategorySelect = root.querySelector("#major-category");
  const subCategorySelect = root.querySelector("#sub-category");
  const customSubcategoryWrapper = root.querySelector("#custom-subcategory-wrapper");
  const customSubCategoryInput = root.querySelector("#custom-sub-category");
  const noteInput = root.querySelector("#note");
  const recurringCheckbox = root.querySelector("#is-recurring");
  const monthFilterInput = root.querySelector("#month-filter");
  const refreshButton = root.querySelector("#refresh-button");
  const refreshStatus = root.querySelector("#refresh-status");
  const monthlySummaryEl = root.querySelector("#monthly-summary");
  const monthlyTransactionsEl = root.querySelector("#monthly-transactions");
  const recurringTransactionsEl = root.querySelector("#recurring-transactions");

  let categoryList = categories;
  let transactions = [];

  setupFormattedNumberInput(amountInput, { allowDecimal: true, maxDecimals: 2 });

  setDefaultMonth();
  renderCategoryOptions();
  handleSubCategoryChange();
  setDefaultDate();
  updateMonthlyView();

  monthFilterInput?.addEventListener("change", () => updateMonthlyView());

  openSheetButton?.addEventListener("click", () => {
    openSheet();
  });

  closeSheetButton?.addEventListener("click", () => closeSheet());
  sheet?.addEventListener("click", (event) => {
    if (event.target?.dataset?.close === "true") {
      closeSheet();
    }
  });

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
    updateSubCategoryOptions(majorCategorySelect.value);
    handleSubCategoryChange();
  });

  subCategorySelect?.addEventListener("change", () => handleSubCategoryChange());

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!onAddTransaction) return;

    const dateValue = dateInput?.value;
    const amountValue = getNumericInputValue(amountInput, { allowDecimal: true, maxDecimals: 2 });
    const typeValue = typeSelect?.value || "expense";
    const majorCategoryValue = majorCategorySelect?.value || "other";
    const subCategorySelection = subCategorySelect?.value || "";
    const noteValue = noteInput?.value.trim();
    const isRecurring = Boolean(recurringCheckbox?.checked);

    let subCategoryValue = "";
    if (subCategorySelection === "__custom") {
      subCategoryValue = customSubCategoryInput?.value.trim() || "";
    } else if (subCategorySelection && subCategorySelection !== "__none") {
      const selectedOption = subCategorySelect?.selectedOptions?.[0];
      const emoji = selectedOption?.dataset?.emoji || "";
      const label = selectedOption?.dataset?.label || selectedOption?.textContent?.trim() || "";
      subCategoryValue = emoji ? `${emoji} ${label}` : label;
    }

    if (!dateValue || !Number.isFinite(amountValue) || amountValue <= 0) {
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
        subCategory: subCategoryValue || null,
        note: noteValue || null,
        isRecurring,
        recurrenceInterval: isRecurring ? "monthly" : null
      });

      form?.reset();
      recurringCheckbox && (recurringCheckbox.checked = false);
      customSubCategoryInput && (customSubCategoryInput.value = "");
      setDefaultDate();
      updateSubCategoryOptions(majorCategorySelect?.value);
      handleSubCategoryChange();
      if (formStatus) {
        formStatus.textContent = "Готово! Транзакция добавлена.";
      }
      setTimeout(() => {
        formStatus && (formStatus.textContent = "");
      }, 2500);
      closeSheet();
    } catch (error) {
      console.error("Ошибка при добавлении транзакции", error);
      if (formStatus) {
        formStatus.textContent = formatError(error);
      }
    }
  });

  function openSheet() {
    sheet?.classList.add("open");
    sheet?.setAttribute("aria-hidden", "false");
    openSheetButton?.classList.add("hidden");
    setDefaultDate();
    handleSubCategoryChange();
  }

  function closeSheet() {
    sheet?.classList.remove("open");
    sheet?.setAttribute("aria-hidden", "true");
    openSheetButton?.classList.remove("hidden");
  }

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
      const label = category.emoji ? `${category.emoji} ${category.label}` : category.label;
      option.textContent = label;
      if (category.value === currentValue || (!currentValue && index === 0)) {
        option.selected = true;
      }
      majorCategorySelect.appendChild(option);
    });
    updateSubCategoryOptions(majorCategorySelect.value);
  }

  function updateSubCategoryOptions(categoryValue) {
    if (!subCategorySelect) return;
    const previousValue = subCategorySelect.value;
    subCategorySelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Выберите подкатегорию";
    placeholder.disabled = true;
    placeholder.selected = false;
    subCategorySelect.appendChild(placeholder);

    const target = categoryList.find((category) => category.value === categoryValue);
    const noneOption = document.createElement("option");
    noneOption.value = "__none";
    noneOption.textContent = "Без подкатегории";
    if (!previousValue) {
      noneOption.selected = true;
    }
    subCategorySelect.appendChild(noneOption);
    target?.subCategories?.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value || item.label;
      option.textContent = item.emoji ? `${item.emoji} ${item.label}` : item.label;
      option.dataset.label = item.label;
      if (item.emoji) {
        option.dataset.emoji = item.emoji;
      }
      subCategorySelect.appendChild(option);
    });

    const customOption = document.createElement("option");
    customOption.value = "__custom";
    customOption.textContent = "Другая подкатегория";
    subCategorySelect.appendChild(customOption);

    if (previousValue) {
      const existing = Array.from(subCategorySelect.options).find((option) => option.value === previousValue);
      if (existing) {
        existing.selected = true;
      }
    }
  }

  function handleSubCategoryChange() {
    const value = subCategorySelect?.value;
    const shouldShowCustom = value === "__custom";
    if (customSubcategoryWrapper) {
      customSubcategoryWrapper.classList.toggle("hidden", !shouldShowCustom);
    }
    if (!shouldShowCustom && customSubCategoryInput) {
      customSubCategoryInput.value = "";
    }
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
      if (recurringTransactionsEl) {
        recurringTransactionsEl.textContent = "Выберите месяц для отображения регулярных платежей.";
        recurringTransactionsEl.classList.add("empty-state");
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
      if (recurringTransactionsEl) {
        recurringTransactionsEl.textContent = "Не удалось определить месяц.";
        recurringTransactionsEl.classList.add("empty-state");
      }
      return;
    }

    const filtered = transactions.filter((tx) => {
      const date = normalizeDate(tx.date);
      return date && date.getFullYear() === year && date.getMonth() + 1 === month;
    });

    const monthLabel = formatMonthYear(year, month);

    if (!filtered.length) {
      monthlyTransactionsEl.textContent = "За выбранный месяц пока нет данных.";
      monthlyTransactionsEl.classList.add("empty-state");
      if (monthlySummaryEl) {
        monthlySummaryEl.innerHTML = "";
      }
      updateRecurringSection(filtered, monthLabel);
      return;
    }

    let incomeTotal = 0;
    let expenseTotal = 0;
    let recurringCount = 0;

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
        if (tx.isRecurring) {
          recurringCount += 1;
        }

        const date = normalizeDate(tx.date) || new Date();
        const category = categoryList.find((c) => c.value === tx.majorCategory);
        const categoryLabel = category
          ? category.emoji
            ? `${category.emoji} ${category.label}`
            : category.label
          : tx.majorCategory || "Без категории";
        const subCategoryLabel = tx.subCategory || "";
        const sign = tx.type === "income" ? "+" : "-";
        const item = document.createElement("div");
        item.className = "transaction-item";
        const categoryLine = `${categoryLabel}${subCategoryLabel ? ` / ${subCategoryLabel}` : ""}`;
        const badge = tx.isRecurring ? '<span class="badge">Регулярно</span>' : "";
        item.innerHTML = `
          <div class="info-line">
            <span>${date.toLocaleDateString()}</span>
            <strong>${sign}${tx.amount.toFixed(2)}</strong>
          </div>
          <div class="muted">${categoryLine}${badge ? ` ${badge}` : ""}</div>
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
        <div class="summary-card">
          <strong>Регулярных</strong>
          <span>${recurringCount}</span>
        </div>
      `;
    }

    updateRecurringSection(filtered, monthLabel);
  }

  function updateRecurringSection(filtered, monthLabel) {
    if (!recurringTransactionsEl) return;
    const recurring = filtered.filter((tx) => tx.isRecurring);
    if (!filtered.length) {
      recurringTransactionsEl.textContent = `За ${monthLabel} регулярные платежи не найдены.`;
      recurringTransactionsEl.classList.add("empty-state");
      return;
    }

    if (!recurring.length) {
      recurringTransactionsEl.textContent = "В этом месяце регулярные платежи не проводились.";
      recurringTransactionsEl.classList.add("empty-state");
      return;
    }

    const list = document.createElement("div");
    list.className = "transaction-list";

    recurring
      .slice()
      .sort((a, b) => {
        const dateA = normalizeDate(a.date);
        const dateB = normalizeDate(b.date);
        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
      })
      .forEach((tx) => {
        const date = normalizeDate(tx.date) || new Date();
        const category = categoryList.find((c) => c.value === tx.majorCategory);
        const categoryLabel = category
          ? category.emoji
            ? `${category.emoji} ${category.label}`
            : category.label
          : tx.majorCategory || "Без категории";
        const subCategoryLabel = tx.subCategory || "";
        const sign = tx.type === "income" ? "+" : "-";
        const item = document.createElement("div");
        item.className = "transaction-item";
        item.innerHTML = `
          <div class="info-line">
            <span>${date.toLocaleDateString()}</span>
            <strong>${sign}${tx.amount.toFixed(2)}</strong>
          </div>
          <div class="muted">${categoryLabel}${subCategoryLabel ? ` / ${subCategoryLabel}` : ""}</div>
          ${tx.note ? `<div>${tx.note}</div>` : ""}
        `;
        list.appendChild(item);
      });

    recurringTransactionsEl.classList.remove("empty-state");
    recurringTransactionsEl.innerHTML = "";
    recurringTransactionsEl.appendChild(list);
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
      updateMonthlyView();
    }
  };
}
