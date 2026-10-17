// src/components/home/RandomWorkBtn.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shuffle } from "lucide-react";
import { supabase } from "@lib/supabase";
import styles from "./RandomWorkBtn.module.css";

export default function RandomWorkBtn() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleRandom = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("works")
        .select("id")
        .eq("visibility", "public")
        .neq("status", "draft");

      if (!data || data.length === 0) return;

      const randomWork = data[Math.floor(Math.random() * data.length)];
      navigate(`/works/${randomWork.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <motion.div
          className={styles.wrap}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Фоновый текст */}
          <span className={styles.bgText} aria-hidden>
            運命
          </span>

          <div className={styles.content}>
            <h2 className={styles.title}>Не знаешь что почитать?</h2>
            <p className={styles.subtitle}>
              Пусть судьба решит за тебя — случайное произведение из каталога
            </p>

            <motion.button
              className={`${styles.btn} ${loading ? styles.btnLoading : ""}`}
              onClick={handleRandom}
              disabled={loading}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <motion.div
                animate={loading ? { rotate: 360 } : {}}
                transition={
                  loading
                    ? {
                        duration: 0.6,
                        repeat: Infinity,
                        ease: "linear",
                      }
                    : {}
                }
              >
                <Shuffle size={20} strokeWidth={1.5} />
              </motion.div>
              {loading ? "Ищем..." : "Брось кубик"}
            </motion.button>
          </div>

          {/* Декоративные кубики */}
          <div className={styles.diceDecor} aria-hidden>
            {["⚁", "⚄", "⚂", "⚅"].map((d, i) => (
              <motion.span
                key={i}
                className={styles.dice}
                animate={{
                  y: [0, -8, 0],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 2.5 + i * 0.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.3,
                }}
              >
                {d}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
