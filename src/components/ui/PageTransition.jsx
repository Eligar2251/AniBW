// src/components/ui/PageTransition.jsx
import { motion } from "framer-motion";
import styles from "./PageTransition.module.css";

const variants = {
  initial: {
    clipPath: "inset(0 100% 0 0)",
    opacity: 0,
  },
  animate: {
    clipPath: "inset(0 0% 0 0)",
    opacity: 1,
    transition: {
      clipPath: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
      opacity: { duration: 0.3 },
    },
  },
  exit: {
    clipPath: "inset(0 0 0 100%)",
    opacity: 0,
    transition: {
      clipPath: { duration: 0.4, ease: [0.7, 0, 0.84, 0] },
      opacity: { duration: 0.2, delay: 0.2 },
    },
  },
};

export default function PageTransition({ children }) {
  return (
    <motion.div
      className={styles.wrap}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
