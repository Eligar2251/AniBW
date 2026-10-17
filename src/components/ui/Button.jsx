// src/components/ui/Button.jsx
import { motion } from "framer-motion";
import styles from "./Button.module.css";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconPos = "left",
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = "button",
  className = "",
  ...props
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      className={[
        styles.btn,
        styles[`variant-${variant}`],
        styles[`size-${size}`],
        fullWidth ? styles.fullWidth : "",
        loading ? styles.loading : "",
        className,
      ].join(" ")}
      {...props}
    >
      {loading && <span className={styles.spinner} />}
      {!loading && icon && iconPos === "left" && (
        <span className={styles.icon}>{icon}</span>
      )}
      <span>{children}</span>
      {!loading && icon && iconPos === "right" && (
        <span className={styles.icon}>{icon}</span>
      )}
    </motion.button>
  );
}
