// src/components/works/ChapterList.jsx
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Lock, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import styles from "./ChapterList.module.css";

function useChapters(workId) {
  return useQuery({
    queryKey: ["chapters", workId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select(
          "id, title, chapter_number, words_count, published_at, status, is_paid",
        )
        .eq("work_id", workId)
        .eq("status", "published")
        .order("chapter_number");
      return data || [];
    },
    enabled: !!workId,
  });
}

function useProgress(workId) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["progress", workId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapter_progress")
        .select("chapter_id, is_completed")
        .eq("work_id", workId)
        .eq("user_id", user.id);
      const map = {};
      data?.forEach((p) => {
        map[p.chapter_id] = p.is_completed;
      });
      return map;
    },
    enabled: !!user && !!workId,
  });
}

export default function ChapterList({ workId }) {
  const { data: chapters = [], isLoading } = useChapters(workId);
  const { data: progress = {} } = useProgress(workId);

  if (isLoading)
    return (
      <div className={styles.list}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`skeleton ${styles.skeletonItem}`} />
        ))}
      </div>
    );

  if (chapters.length === 0)
    return (
      <div className={styles.empty}>
        <span className={styles.emptyKanji}>空</span>
        <p>Глав пока нет</p>
      </div>
    );

  return (
    <div className={styles.list}>
      {/* Шапка */}
      <div className={styles.listHeader}>
        <span>Глава</span>
        <span>Название</span>
        <span>Слов</span>
        <span>Дата</span>
      </div>

      {chapters.map((ch, i) => {
        const isRead = progress[ch.id];
        return (
          <motion.div
            key={ch.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: i * 0.04,
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <Link
              to={`/works/${workId}/read/${ch.id}`}
              className={`${styles.item} ${isRead ? styles.itemRead : ""}`}
            >
              {/* Большой номер главы (фоновый декор) */}
              <span className={styles.itemBgNum} aria-hidden>
                {String(ch.chapter_number).padStart(2, "0")}
              </span>

              <span className={styles.itemNum}>
                {String(ch.chapter_number).padStart(2, "0")}
              </span>

              <span className={styles.itemTitle}>
                {ch.title}
                {ch.is_paid && <Lock size={12} className={styles.lockIcon} />}
              </span>

              <span className={styles.itemWords}>
                {ch.words_count?.toLocaleString()} сл.
              </span>

              <span className={styles.itemDate}>
                {ch.published_at
                  ? format(new Date(ch.published_at), "d MMM", { locale: ru })
                  : "—"}
              </span>

              {/* Индикатор прочитано */}
              <span className={styles.itemStatus}>
                {isRead && (
                  <CheckCircle size={14} color="var(--color-success)" />
                )}
              </span>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
