// src/pages/dashboard/MyWorksPage.jsx
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Plus, Edit, Eye, BookOpen } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import styles from "./MyWorksPage.module.css";

function useMyWorks() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["my-works", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("works")
        .select("*")
        .eq("author_id", user.id)
        .order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });
}

export default function MyWorksPage() {
  const { data: works = [], isLoading } = useMyWorks();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleKanji} aria-hidden>
            作
          </span>
          Мои произведения
        </h1>
        <Link to="/dashboard/works/new" className={styles.newBtn}>
          <Plus size={16} strokeWidth={1.5} />
          Новое
        </Link>
      </div>

      <div className={styles.list}>
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`skeleton ${styles.skeletonItem}`} />
            ))
          : works.map((work, i) => (
              <motion.div
                key={work.id}
                className={styles.workItem}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <div className={styles.workCover}>
                  {work.cover_url ? (
                    <img
                      src={getCloudinaryUrl(
                        work.cover_url,
                        transforms.avatarSm,
                      )}
                      alt={work.title}
                      className={styles.workCoverImg}
                    />
                  ) : (
                    <span className={styles.workCoverPlaceholder}>
                      {work.title?.[0]}
                    </span>
                  )}
                </div>

                <div className={styles.workInfo}>
                  <span className={styles.workTitle}>{work.title}</span>
                  <div className={styles.workMeta}>
                    <span
                      className={`${styles.workStatus} ${styles[`ws-${work.status}`]}`}
                    >
                      {work.status}
                    </span>
                    <span className={styles.workWords}>
                      {(work.words_count || 0).toLocaleString()} слов
                    </span>
                    <span className={styles.workChapters}>
                      {work.chapters_count || 0} глав
                    </span>
                  </div>
                </div>

                <div className={styles.workActions}>
                  <Link
                    to={`/works/${work.id}`}
                    className={styles.actionBtn}
                    title="Просмотреть"
                  >
                    <Eye size={15} strokeWidth={1.5} />
                  </Link>
                  <Link
                    to={`/dashboard/works/${work.id}`}
                    className={styles.actionBtn}
                    title="Редактировать"
                  >
                    <Edit size={15} strokeWidth={1.5} />
                  </Link>
                  <Link
                    to={`/dashboard/works/${work.id}/chapters/new`}
                    className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                    title="Добавить главу"
                  >
                    <BookOpen size={15} strokeWidth={1.5} />
                  </Link>
                </div>
              </motion.div>
            ))}

        {!isLoading && works.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>無</span>
            <p>Произведений пока нет</p>
            <Link to="/dashboard/works/new" className={styles.emptyBtn}>
              Создать первое произведение
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
