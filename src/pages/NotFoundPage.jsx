// src/pages/NotFoundPage.jsx
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import styles from "./NotFoundPage.module.css";

export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className={styles.code} aria-hidden>
          404
        </span>
        <span className={styles.kanji} aria-hidden>
          迷子
        </span>
        <h1 className={styles.title}>Страница не найдена</h1>
        <p className={styles.sub}>Кажется, эта история ещё не написана...</p>
        <Link to="/" className={styles.homeBtn}>
          Вернуться на главную
        </Link>
      </motion.div>
    </div>
  );
}
