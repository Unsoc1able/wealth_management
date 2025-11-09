export function normalizeDate(value) {
  if (!value) return null;
  const base = typeof value.toDate === "function" ? value.toDate() : value;
  const date = base instanceof Date ? base : new Date(base);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getCurrentDateValue() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

export function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthYear(year, month) {
  const date = new Date(year, month - 1);
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric"
  });
  const label = formatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
