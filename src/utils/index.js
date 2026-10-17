// src/utils/index.js — общие утилиты
export const formatNum = (n = 0) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
};

export const readingTime = (wordCount = 0, wpm = 200) =>
  Math.max(1, Math.ceil(wordCount / wpm));

export const clsx = (...classes) => classes.filter(Boolean).join(" ");

export const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const generateUsername = (email) =>
  email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_") +
  "_" +
  Math.floor(Math.random() * 9999);

export const truncate = (str, len = 150) =>
  str?.length > len ? str.slice(0, len) + "..." : str;
