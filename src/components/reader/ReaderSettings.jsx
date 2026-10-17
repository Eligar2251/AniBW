// src/components/reader/ReaderSettings.jsx
import { motion } from "framer-motion";
import { X, Sun, Moon } from "lucide-react";
import { useReaderStore } from "@store/readerStore";
import styles from "./ReaderSettings.module.css";

const FONTS = [
  { id: "serif", label: "Serif", preview: "Аб" },
  { id: "sans", label: "Sans", preview: "Аб" },
  { id: "mono", label: "Mono", preview: "Аб" },
];

const THEMES = [
  { id: "dark", label: "Тёмная", bg: "#0A0B12", text: "#F0EDE8" },
  { id: "sepia", label: "Сепия", bg: "#F5ECD7", text: "#3A2E1E" },
  { id: "light", label: "Светлая", bg: "#FAFAF8", text: "#1A1A1A" },
  { id: "oled", label: "OLED", bg: "#000000", text: "#E8E8E8" },
];

export default function ReaderSettings({ onClose }) {
  const {
    font,
    fontSize,
    lineHeight,
    columnWidth,
    theme,
    setFont,
    setFontSize,
    setLineHeight,
    setColumnWidth,
    setTheme,
  } = useReaderStore();

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.header}>
        <span className={styles.title}>Настройки чтения</span>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Тема */}
      <div className={styles.group}>
        <div className={styles.label}>Тема</div>
        <div className={styles.themeRow}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`${styles.themeBtn} ${theme === t.id ? styles.themeBtnActive : ""}`}
              style={{ background: t.bg, color: t.text }}
              onClick={() => setTheme(t.id)}
            >
              <span className={styles.themeBtnLabel}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Шрифт */}
      <div className={styles.group}>
        <div className={styles.label}>Шрифт</div>
        <div className={styles.fontRow}>
          {FONTS.map((f) => (
            <button
              key={f.id}
              className={`${styles.fontBtn} ${font === f.id ? styles.fontBtnActive : ""}`}
              onClick={() => setFont(f.id)}
            >
              <span
                className={styles.fontPreview}
                style={{
                  fontFamily:
                    f.id === "serif"
                      ? '"Lora",serif'
                      : f.id === "sans"
                        ? '"Cormorant Garamond",sans-serif'
                        : '"JetBrains Mono",monospace',
                }}
              >
                {f.preview}
              </span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Размер шрифта */}
      <div className={styles.group}>
        <div className={styles.labelRow}>
          <span className={styles.label}>Размер шрифта</span>
          <span className={styles.value}>{fontSize}px</span>
        </div>
        <div className={styles.sliderRow}>
          <button
            className={styles.stepBtn}
            onClick={() => setFontSize(Math.max(14, fontSize - 1))}
          >
            A−
          </button>
          <input
            type="range"
            min={14}
            max={28}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className={styles.slider}
          />
          <button
            className={styles.stepBtn}
            onClick={() => setFontSize(Math.min(28, fontSize + 1))}
          >
            A+
          </button>
        </div>
      </div>

      {/* Межстрочный интервал */}
      <div className={styles.group}>
        <div className={styles.labelRow}>
          <span className={styles.label}>Межстрочный интервал</span>
          <span className={styles.value}>{lineHeight}</span>
        </div>
        <input
          type="range"
          min={1.3}
          max={2.2}
          step={0.1}
          value={lineHeight}
          onChange={(e) => setLineHeight(Number(e.target.value))}
          className={styles.slider}
        />
      </div>

      {/* Ширина колонки */}
      <div className={styles.group}>
        <div className={styles.labelRow}>
          <span className={styles.label}>Ширина</span>
          <span className={styles.value}>{columnWidth}px</span>
        </div>
        <input
          type="range"
          min={480}
          max={900}
          step={20}
          value={columnWidth}
          onChange={(e) => setColumnWidth(Number(e.target.value))}
          className={styles.slider}
        />
      </div>
    </motion.div>
  );
}
