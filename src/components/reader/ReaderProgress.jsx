// src/components/reader/ReaderProgress.jsx
import styles from "./ReaderProgress.module.css";

export default function ReaderProgress({ value }) {
  return (
    <div className={styles.track}>
      <div className={styles.fill} style={{ width: `${value * 100}%` }} />
      <div className={styles.glow} style={{ left: `${value * 100}%` }} />
    </div>
  );
}
