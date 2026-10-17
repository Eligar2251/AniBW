// src/components/ui/PageLoader.jsx
import { motion } from "framer-motion";
import styles from "./PageLoader.module.css";

export default function PageLoader() {
  return (
    <motion.div
      className={styles.wrap}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className={styles.inner}>
        <span className={styles.kanji}>読</span>
        <div className={styles.bar}>
          <motion.div
            className={styles.barFill}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{
              duration: 1.2,
              ease: [0.25, 0.1, 0, 1],
              repeat: Infinity,
            }}
          />
        </div>
        <span className={styles.label}>AniScript</span>
      </div>
    </motion.div>
  );
}
