import { createTransaction, fetchTransactionsOnce, subscribeToTransactions, getFriendlyErrorMessage } from "./firebase.js";
import { initOperationsTab } from "./tabs/operations.js";
import { initAnalyticsTab } from "./tabs/analytics.js";

const state = {
  categories: [],
  transactions: []
};

const tabInstances = {};

const tabsConfig = {
  operations: {
    templateUrl: "tabs/operations.html",
    init: initOperationsTab
  },
  analytics: {
    templateUrl: "tabs/analytics.html",
    init: initAnalyticsTab
  }
};

const navButtons = Array.from(document.querySelectorAll("nav.tabs button"));
const viewContainer = document.getElementById("view-container");
const statusBanner = document.getElementById("global-status");

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.nav;
    showTab(target);
  });
});

async function showTab(tabId) {
  if (!tabsConfig[tabId]) return;
  try {
    await ensureTabLoaded(tabId);
    setActiveTab(tabId);
  } catch (error) {
    console.error(`Не удалось открыть вкладку ${tabId}`, error);
    setStatus("Не удалось открыть вкладку. Проверьте консоль.");
  }
}

async function ensureTabLoaded(tabId) {
  if (tabInstances[tabId]) {
    return tabInstances[tabId];
  }

  const config = tabsConfig[tabId];
  const response = await fetch(config.templateUrl);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить шаблон вкладки ${tabId}`);
  }

  const markup = await response.text();
  const viewEl = document.createElement("div");
  viewEl.classList.add("view");
  viewEl.dataset.view = tabId;
  viewEl.innerHTML = markup;
  viewContainer.appendChild(viewEl);

  const controller = config.init({
    root: viewEl,
    categories: state.categories,
    onAddTransaction: handleCreateTransaction,
    onRefresh: refreshTransactions,
    getErrorMessage: getFriendlyErrorMessage
  });

  const instance = { element: viewEl, controller };
  tabInstances[tabId] = instance;

  controller?.updateCategories?.(state.categories);
  controller?.updateTransactions?.(state.transactions);

  return instance;
}

function setActiveTab(tabId) {
  Object.entries(tabInstances).forEach(([id, { element }]) => {
    element.classList.toggle("active", id === tabId);
  });

  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === tabId);
  });
}

async function handleCreateTransaction(data) {
  await createTransaction(data);
}

async function refreshTransactions() {
  const latest = await fetchTransactionsOnce();
  setTransactions(latest);
}

function setTransactions(transactions) {
  state.transactions = Array.isArray(transactions) ? transactions : [];
  Object.values(tabInstances).forEach(({ controller }) => {
    controller?.updateTransactions?.(state.transactions);
  });
}

function setCategories(categories) {
  state.categories = Array.isArray(categories) ? categories : [];
  Object.values(tabInstances).forEach(({ controller }) => {
    controller?.updateCategories?.(state.categories);
  });
}

async function loadCategories() {
  try {
    const response = await fetch("data/categories.json");
    if (!response.ok) {
      throw new Error("Не удалось загрузить список категорий");
    }
    const data = await response.json();
    setCategories(data.majorCategories || []);
  } catch (error) {
    console.error("Ошибка загрузки категорий", error);
    setStatus("Не удалось загрузить категории. Проверьте файл data/categories.json");
  }
}

function setStatus(message) {
  if (!statusBanner) return;
  statusBanner.textContent = message || "";
  statusBanner.hidden = !message;
}

function subscribeToData() {
  return subscribeToTransactions(
    (data) => {
      setTransactions(data);
      setStatus("");
    },
    (error) => {
      console.error("Ошибка подписки на транзакции", error);
      setStatus(getFriendlyErrorMessage(error));
    }
  );
}

async function bootstrap() {
  await loadCategories();
  await showTab("operations");
  const unsubscribe = subscribeToData();

  window.addEventListener("beforeunload", () => {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
