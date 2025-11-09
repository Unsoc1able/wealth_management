import {
  normalizeDate,
  formatMonthYear,
  getCurrentMonthValue,
  setupFormattedNumberInput,
  getNumericInputValue
} from "../utils.js";

const MONTHLY_GOAL = 150_000;
const NEST_TARGET = 25_000_000;
const STORAGE_KEY = "wealth_manager_savings_records";

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

export function initSavingsTab({ root }) {
  const monthSelect = root.querySelector("#savings-month-select");
  const monthlyGoalProgress = root.querySelector("#monthly-goal-progress");
  const monthlyIncomeSummary = root.querySelector("#monthly-income-summary");

  const savingsForm = root.querySelector("#savings-form");
  const savingsFormStatus = root.querySelector("#savings-form-status");
  const savingsNameInput = root.querySelector("#savings-name");
  const savingsMaturityInput = root.querySelector("#savings-maturity");
  const savingsBalanceInput = root.querySelector("#savings-balance");
  const savingsRateInput = root.querySelector("#savings-rate");
  const savingsCompoundingSelect = root.querySelector("#savings-compounding");

  const savingsList = root.querySelector("#savings-list");
  const savingsEmpty = root.querySelector("#savings-empty");
  const savingsSubmitButton = root.querySelector("#savings-submit-button");
  const savingsCancelEditButton = root.querySelector("#savings-cancel-edit");

  const nestProgress = root.querySelector("#nest-progress");
  const nestProgressLabel = root.querySelector("#nest-progress-label");
  const payoutChart = root.querySelector("#savings-payout-chart");

  const plannerForm = root.querySelector("#planner-form");
  const plannerContributionInput = root.querySelector("#planner-contribution");
  const plannerYearsInput = root.querySelector("#planner-years");
  const plannerRateInput = root.querySelector("#planner-rate");
  const plannerResult = root.querySelector("#planner-result");

  setupFormattedNumberInput(savingsBalanceInput, { allowDecimal: true, maxDecimals: 2 });
  setupFormattedNumberInput(savingsRateInput, { allowDecimal: true, maxDecimals: 2 });
  setupFormattedNumberInput(plannerContributionInput, { allowDecimal: true, maxDecimals: 2 });
  setupFormattedNumberInput(plannerYearsInput, { allowDecimal: false, maxDecimals: 0 });
  setupFormattedNumberInput(plannerRateInput, { allowDecimal: true, maxDecimals: 2 });

  let transactions = [];
  let savingsRecords = loadSavingsRecords();
  let editingRecordId = null;
  const defaultSubmitLabel = savingsSubmitButton?.textContent || "Добавить накопление";

  populateMonthOptions();
  renderMonthlyProgress();
  renderSavingsRecords();
  renderNestProgress();
  renderPayoutChart();

  monthSelect?.addEventListener("change", () => {
    renderMonthlyProgress();
  });

  savingsForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const maturityDateValue = savingsMaturityInput?.value;
    const balanceValue = getNumericInputValue(savingsBalanceInput, { allowDecimal: true, maxDecimals: 2 });
    const rateValue = getNumericInputValue(savingsRateInput, { allowDecimal: true, maxDecimals: 2 });
    const compoundingValue = savingsCompoundingSelect?.value || "monthly";
    const nameValue = (savingsNameInput?.value || "").trim();

    if (!maturityDateValue || !Number.isFinite(balanceValue) || balanceValue <= 0 || !Number.isFinite(rateValue)) {
      setFormStatus("Проверьте дату, сумму и ставку.");
      return;
    }

    const baseRecord = {
      name: nameValue || "Накопление",
      maturityDate: maturityDateValue,
      currentBalance: balanceValue,
      rate: rateValue,
      compounding: compoundingValue
    };

    if (editingRecordId) {
      const recordIndex = savingsRecords.findIndex((record) => record.id === editingRecordId);
      if (recordIndex !== -1) {
        savingsRecords[recordIndex] = { ...savingsRecords[recordIndex], ...baseRecord, id: editingRecordId };
        setFormStatus("Накопление обновлено.");
      } else {
        savingsRecords.push({ id: editingRecordId, ...baseRecord });
        setFormStatus("Накопление добавлено.");
      }
      editingRecordId = null;
    } else {
      savingsRecords.push({ id: cryptoRandomId(), ...baseRecord });
      setFormStatus("Накопление добавлено.");
    }

    persistSavingsRecords();
    renderSavingsRecords();
    renderNestProgress();
    renderPayoutChart();
    resetForm();
  });

  savingsCancelEditButton?.addEventListener("click", () => {
    resetForm();
    setFormStatus("Редактирование отменено.");
  });

  plannerForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!plannerResult) return;

    const contributionValue = getNumericInputValue(plannerContributionInput, { allowDecimal: true, maxDecimals: 2 });
    const yearsValue = getNumericInputValue(plannerYearsInput, { allowDecimal: false, maxDecimals: 0 });
    const rateValue = getNumericInputValue(plannerRateInput, { allowDecimal: true, maxDecimals: 2 });

    if (
      !Number.isFinite(contributionValue) ||
      contributionValue <= 0 ||
      !Number.isFinite(yearsValue) ||
      yearsValue <= 0
    ) {
      plannerResult.textContent = "Пожалуйста, укажите положительные значения для взноса и срока.";
      return;
    }

    const safeRate = Number.isFinite(rateValue) ? rateValue : 0;
    const effectiveRate = Math.max(0, safeRate) / 100;
    const calculation = calculatePlan(contributionValue, yearsValue, effectiveRate);

    plannerResult.innerHTML = `
      <p>Через ${yearsValue} ${pluralize(yearsValue, "год", "года", "лет")} при ежегодной капитализации сумма составит <strong>${formatCurrency(
        calculation.total
      )}</strong>.</p>
      <p class="muted">Всего взносов: ${formatCurrency(calculation.contributions)}. Начисленные проценты: ${formatCurrency(
        calculation.interest
      )}.</p>
    `;
  });

  function setFormStatus(message) {
    if (!savingsFormStatus) return;
    savingsFormStatus.textContent = message;
    if (message) {
      setTimeout(() => {
        if (savingsFormStatus.textContent === message) {
          savingsFormStatus.textContent = "";
        }
      }, 2500);
    }
  }

  function loadSavingsRecords() {
    if (typeof localStorage === "undefined") {
      return [];
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Не удалось загрузить накопления", error);
      return [];
    }
  }

  function persistSavingsRecords() {
    if (typeof localStorage === "undefined") {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savingsRecords));
    } catch (error) {
      console.warn("Не удалось сохранить накопления", error);
    }
  }

  function populateMonthOptions() {
    if (!monthSelect) return;

    const monthKeys = new Set();
    transactions.forEach((tx) => {
      const date = normalizeDate(tx.date);
      if (!date || tx.type !== "income") return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthKeys.add(key);
    });

    const currentMonth = getCurrentMonthValue();
    if (!monthKeys.size) {
      monthKeys.add(currentMonth);
    }

    const sortedKeys = Array.from(monthKeys).sort((a, b) => (a > b ? -1 : 1));
    const previousValue = monthSelect.value;

    monthSelect.innerHTML = "";
    sortedKeys.forEach((key, index) => {
      const [year, month] = key.split("-").map((part) => parseInt(part, 10));
      const option = document.createElement("option");
      option.value = key;
      option.textContent = formatMonthYear(year, month);
      if (key === previousValue || (!previousValue && index === 0)) {
        option.selected = true;
      }
      monthSelect.appendChild(option);
    });

    if (!monthSelect.value && sortedKeys.length) {
      monthSelect.value = sortedKeys[0];
    }
  }

  function renderMonthlyProgress() {
    if (!monthlyGoalProgress || !monthSelect) return;

    const key = monthSelect.value || getCurrentMonthValue();
    const [yearStr, monthStr] = key.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const monthlyIncome = transactions.reduce((total, tx) => {
      if (tx.type !== "income") return total;
      const date = normalizeDate(tx.date);
      if (!date) return total;
      const isSameMonth = date.getFullYear() === year && date.getMonth() + 1 === month;
      return isSameMonth ? total + Number(tx.amount || 0) : total;
    }, 0);

    const ratio = MONTHLY_GOAL > 0 ? monthlyIncome / MONTHLY_GOAL : 0;
    const percent = Math.round(ratio * 100);

    monthlyGoalProgress.innerHTML = createProgressMarkup(percent);

    if (monthlyIncomeSummary) {
      monthlyIncomeSummary.textContent = `${formatMonthYear(year, month)}: ${formatCurrency(monthlyIncome)} из цели ${formatCurrency(
        MONTHLY_GOAL
      )} (${percent}%).`;
    }
  }

  function createProgressMarkup(percent) {
    const boundedPercent = Math.max(0, Math.min(100, percent));
    const displayPercent = Math.max(0, Math.round(percent));
    return `
      <div class="progress">
        <div class="progress-fill" style="width: ${boundedPercent}%"></div>
      </div>
      <div class="progress-value">${displayPercent}% выполнено</div>
    `;
  }

  function renderSavingsRecords() {
    if (!savingsList || !savingsEmpty) return;

    if (!savingsRecords.length) {
      savingsEmpty.classList.remove("hidden");
      savingsList.innerHTML = "";
      return;
    }

    savingsEmpty.classList.add("hidden");
    savingsList.innerHTML = "";

    const sorted = [...savingsRecords].sort((a, b) => (a.maturityDate > b.maturityDate ? 1 : -1));

    sorted.forEach((record) => {
      const expected = calculateExpectedBalance(record);
      const balance = Number(record.currentBalance) || 0;
      const rate = Number(record.rate) || 0;
      const card = document.createElement("div");
      card.className = "savings-card";
      const targetDate = new Date(record.maturityDate);
      const dateLabel = Number.isNaN(targetDate.getTime())
        ? record.maturityDate
        : targetDate.toLocaleDateString("ru-RU");

      const compoundingLabel = record.compounding === "monthly" ? "Ежемесячная капитализация" : "Ежегодная капитализация";

      card.innerHTML = `
        <div class="savings-card-header">
          <strong>${escapeHtml(record.name || "Накопление")}</strong>
          <div class="savings-card-actions">
            <button class="icon-button" type="button" data-edit="${record.id}" title="Редактировать">✎</button>
            <button class="icon-button" type="button" data-remove="${record.id}" title="Удалить">✕</button>
          </div>
        </div>
        <div class="savings-card-body">
          <div><span class="muted">Завершение:</span> ${dateLabel}</div>
          <div><span class="muted">Текущий баланс:</span> ${formatCurrency(balance)}</div>
          <div><span class="muted">Ставка:</span> ${rate.toFixed(2)}%</div>
          <div><span class="muted">Начисление:</span> ${compoundingLabel}</div>
          <div class="savings-card-expected">Ожидаемый баланс: <strong>${formatCurrency(expected)}</strong></div>
        </div>
      `;

      savingsList.appendChild(card);
    });

    savingsList.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const { edit: id } = button.dataset;
        const record = savingsRecords.find((item) => item.id === id);
        if (!record) return;
        beginEdit(record);
      });
    });

    savingsList.querySelectorAll("[data-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const { remove: id } = button.dataset;
        savingsRecords = savingsRecords.filter((record) => record.id !== id);
        persistSavingsRecords();
        renderSavingsRecords();
        renderNestProgress();
        renderPayoutChart();
        if (editingRecordId === id) {
          resetForm();
        }
      });
    });
  }

  function renderNestProgress() {
    if (!nestProgress || !nestProgressLabel) return;

    const totalExpected = savingsRecords.reduce((sum, record) => sum + calculateExpectedBalance(record), 0);
    const ratio = NEST_TARGET > 0 ? totalExpected / NEST_TARGET : 0;
    const percent = Math.round(ratio * 100);

    nestProgress.innerHTML = createProgressMarkup(percent);
    nestProgressLabel.textContent = `Всего учтённых накоплений: ${formatCurrency(totalExpected)} из цели ${formatCurrency(
      NEST_TARGET
    )}`;
  }

  function renderPayoutChart() {
    if (!payoutChart) return;

    const hasPlotly = typeof window !== "undefined" && typeof window.Plotly !== "undefined";
    if (!hasPlotly) {
      payoutChart.classList.add("empty-state");
      payoutChart.textContent = "Не удалось загрузить модуль визуализации.";
      return;
    }

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMaturity = savingsRecords.reduce((latest, record) => {
      const maturity = normalizeDate(record.maturityDate);
      if (!maturity) return latest;
      return !latest || maturity > latest ? maturity : latest;
    }, null);

    const endMonth = lastMaturity
      ? new Date(lastMaturity.getFullYear(), lastMaturity.getMonth() + 12, 1)
      : new Date(startMonth.getFullYear(), startMonth.getMonth() + 12, 1);

    const payoutsByMonth = new Map();
    savingsRecords.forEach((record) => {
      const maturity = normalizeDate(record.maturityDate);
      if (!maturity) return;
      const key = createMonthKey(maturity);
      payoutsByMonth.set(key, (payoutsByMonth.get(key) || 0) + calculateExpectedBalance(record));
    });

    const monthKeys = [];
    const monthLabels = [];
    const expectedPayouts = [];
    const plannedContributions = [];

    let cursor = new Date(startMonth);
    while (cursor <= endMonth) {
      const key = createMonthKey(cursor);
      monthKeys.push(key);
      monthLabels.push(formatMonthYear(cursor.getFullYear(), cursor.getMonth() + 1));
      expectedPayouts.push(payoutsByMonth.get(key) || 0);
      plannedContributions.push(MONTHLY_GOAL);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    payoutChart.classList.remove("empty-state");
    payoutChart.textContent = "";

    window.Plotly.react(
      payoutChart,
      [
        {
          x: monthKeys,
          y: plannedContributions,
          name: "Плановые взносы",
          mode: "lines",
          line: { color: "#0b7285", width: 3, dash: "dot" },
          hovertemplate: "%{y:.0f} ₽<extra>%{fullData.name}</extra>"
        },
        {
          x: monthKeys,
          y: expectedPayouts,
          name: "Ожидаемые выплаты",
          type: "bar",
          marker: { color: "#51cf66" },
          hovertemplate: "%{y:.0f} ₽<extra>%{fullData.name}</extra>"
        }
      ],
      {
        height: 360,
        margin: { t: 20, r: 20, b: 60, l: 60 },
        barmode: "group",
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

  function calculateExpectedBalance(record) {
    const principal = Number(record.currentBalance) || 0;
    const rate = Math.max(0, Number(record.rate) || 0) / 100;
    if (!principal) return 0;

    const maturity = normalizeDate(record.maturityDate);
    if (!maturity) {
      return principal;
    }

    const now = new Date();
    const monthsDiff = Math.max(0, diffInMonths(now, maturity));
    if (monthsDiff === 0 || rate === 0) {
      return principal;
    }

    if (record.compounding === "monthly") {
      return principal * Math.pow(1 + rate / 12, monthsDiff);
    }

    const yearsDiff = monthsDiff / 12;
    return principal * Math.pow(1 + rate, yearsDiff);
  }

  function diffInMonths(start, end) {
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();
    return (endYear - startYear) * 12 + (endMonth - startMonth);
  }

  function createMonthKey(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function calculatePlan(monthlyContribution, years, rate) {
    const annualContribution = monthlyContribution * 12;
    let total = 0;
    let contributions = 0;

    for (let year = 1; year <= years; year += 1) {
      total = (total + annualContribution) * (1 + rate);
      contributions += annualContribution;
    }

    const interest = Math.max(0, total - contributions);
    return { total, contributions, interest };
  }

  function formatCurrency(value) {
    if (!Number.isFinite(value)) return "—";
    return currencyFormatter.format(Math.round(value));
  }

  function cryptoRandomId() {
    try {
      const array = new Uint32Array(2);
      crypto.getRandomValues(array);
      return Array.from(array)
        .map((value) => value.toString(36))
        .join("");
    } catch (error) {
      return Date.now().toString(36);
    }
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  function beginEdit(record) {
    editingRecordId = record.id;
    if (savingsNameInput) {
      savingsNameInput.value = record.name || "";
    }
    if (savingsMaturityInput) {
      savingsMaturityInput.value = record.maturityDate || "";
    }
    if (savingsBalanceInput) {
      savingsBalanceInput.value = record.currentBalance ?? "";
    }
    if (savingsRateInput) {
      savingsRateInput.value = record.rate ?? "";
    }
    if (savingsCompoundingSelect) {
      savingsCompoundingSelect.value = record.compounding || "monthly";
    }
    if (savingsSubmitButton) {
      savingsSubmitButton.textContent = "Сохранить изменения";
    }
    savingsCancelEditButton?.classList.remove("hidden");
    setFormStatus("Редактирование накопления.");
    savingsNameInput?.focus();
  }

  function resetForm() {
    savingsForm?.reset();
    editingRecordId = null;
    if (savingsSubmitButton) {
      savingsSubmitButton.textContent = defaultSubmitLabel;
    }
    savingsCancelEditButton?.classList.add("hidden");
  }

  function pluralize(value, one, two, many) {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return two;
    return many;
  }

  return {
    updateTransactions(nextTransactions) {
      transactions = Array.isArray(nextTransactions) ? nextTransactions : [];
      populateMonthOptions();
      renderMonthlyProgress();
    }
  };
}
