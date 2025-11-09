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

const DEFAULT_NUMERIC_OPTIONS = {
  allowDecimal: true,
  maxDecimals: 2
};

function mergeNumericOptions(options = {}) {
  return { ...DEFAULT_NUMERIC_OPTIONS, ...options };
}

function sanitizeForInput(value = "", options = {}) {
  const { allowDecimal, maxDecimals } = mergeNumericOptions(options);
  if (!value) return "";
  let sanitized = value.toString().replace(/\s+/g, "").replace(/,/g, ".");
  sanitized = sanitized.replace(/[^0-9.]/g, "");

  if (!allowDecimal) {
    return sanitized.split(".")[0] || "";
  }

  const [integerPart = "", ...fractionParts] = sanitized.split(".");
  const fraction = fractionParts.join("");
  const limitedFraction = maxDecimals >= 0 ? fraction.slice(0, maxDecimals) : fraction;
  return limitedFraction ? `${integerPart}.${limitedFraction}` : integerPart;
}

export function sanitizeNumericString(value, options = {}) {
  const { allowDecimal } = mergeNumericOptions(options);
  const sanitized = sanitizeForInput(value, options);
  if (!sanitized) return "";

  if (!allowDecimal) {
    const normalized = parseInt(sanitized, 10);
    return Number.isNaN(normalized) ? "" : normalized.toString();
  }

  const [integerPart = "0", fractionPart = ""] = sanitized.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
  return fractionPart ? `${normalizedInteger}.${fractionPart}` : normalizedInteger;
}

export function formatNumberWithSpaces(value, options = {}) {
  const { allowDecimal } = mergeNumericOptions(options);
  const sanitized = sanitizeNumericString(value, options);
  if (!sanitized) return "";

  const [integerPartRaw, fractionPart = ""] = sanitized.split(".");
  const integerPart = integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ") || "0";

  if (!allowDecimal || !fractionPart) {
    return integerPart;
  }

  return `${integerPart}.${fractionPart}`;
}

export function setupFormattedNumberInput(input, options = {}) {
  if (!input) return () => {};
  const mergedOptions = mergeNumericOptions(options);

  const handleFocus = () => {
    input.value = sanitizeForInput(input.value, mergedOptions);
  };

  const handleBlur = () => {
    input.value = formatNumberWithSpaces(input.value, mergedOptions);
  };

  const handleInput = () => {
    const previousValue = input.value;
    const cursorPosition = input.selectionStart ?? previousValue.length;
    const sanitized = sanitizeForInput(previousValue, mergedOptions);
    if (sanitized !== previousValue) {
      const diff = previousValue.length - sanitized.length;
      input.value = sanitized;
      const nextPosition = Math.max(0, cursorPosition - diff);
      requestAnimationFrame(() => {
        input.setSelectionRange(nextPosition, nextPosition);
      });
    }
  };

  input.addEventListener("focus", handleFocus);
  input.addEventListener("blur", handleBlur);
  input.addEventListener("input", handleInput);

  handleBlur();

  return () => {
    input.removeEventListener("focus", handleFocus);
    input.removeEventListener("blur", handleBlur);
    input.removeEventListener("input", handleInput);
  };
}

export function getNumericInputValue(input, options = {}) {
  if (!input) return NaN;
  const sanitized = sanitizeNumericString(input.value, options);
  if (!sanitized) return NaN;
  const numericValue = Number(sanitized);
  return Number.isNaN(numericValue) ? NaN : numericValue;
}
