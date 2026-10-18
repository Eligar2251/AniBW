// src/store/readerStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useReaderStore = create(
  persist(
    (set) => ({
      // Настройки читателя
      font: "serif", // serif | sans | mono
      fontSize: 18,
      lineHeight: 1.7,
      columnWidth: 680,
      theme: "dark", // light | sepia | dark | oled

      setFont: (font) => set({ font }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setColumnWidth: (columnWidth) => set({ columnWidth }),
      setTheme: (theme) => set({ theme }),

      // UI состояние
      headerVisible: true,
      settingsOpen: false,
      setHeaderVisible: (headerVisible) => set({ headerVisible }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    }),
    {
      name: "aniscript-reader",
      partialize: (state) => ({
        font: state.font,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        columnWidth: state.columnWidth,
        theme: state.theme,
      }),
    },
  ),
);
