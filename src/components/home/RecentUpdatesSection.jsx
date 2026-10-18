// src/components/home/RecentUpdatesSection.jsx
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, BookOpen, ChevronRight } from "lucide-react";
import { supabase } from "@lib/supabase";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import styles from "./RecentUpdatesSection.module.css";

function useRecentUpdates() {
  return useQuery({
    queryKey: ["recent-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works_full")
        .select("*")
        .eq("visibility", "public")
        .neq("status", "draft")
        .order("last_chapter_at", { ascending: false })
        .not("last_chapter_at", "is", null)
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 3,
  });
}

export default function RecentUpdatesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const { data: works = [], isLoading } = useRecentUpdates();

  return (
    <section className={styles.section} ref={ref}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, x: -30 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.bgNumber} aria-hidden>
            03
          </span>
          <div className={styles.headerLeft}>
            <Clock size={20} color="var(--color-amber)" strokeWidth={1.5} />
            <h2 className={styles.title}>Недавно обновлённые</h2>
          </div>
          <Link to="/works?sort=updated" className={styles.viewAll}>
            Все обновления
            <ChevronRight size={16} strokeWidth={1.5} />
          </Link>
        </motion.div>

        <div className={styles.list}>
          {isLoading
            ? Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={styles.skeletonItem}>
                  <div className={`skeleton ${styles.skeletonCover}`} />
                  <div className={styles.skeletonMeta}>
                    <div
                      className="skeleton"
                      style={{ height: 11, width: "30%" }}
                    />
                    <div
                      className="skeleton"
                      style={{ height: 16, width: "85%" }}
                    />
                    <div
                      className="skeleton"
                      style={{ height: 11, width: "50%" }}
                    />
                  </div>
                  <div
                    className="skeleton"
                    style={{ height: 11, width: 60, borderRadius: 4 }}
                  />
                </div>
              ))
            : works.map((work, i) => (
                <motion.div
                  key={work.id}
                  initial={{ opacity: 0, x: -24 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{
                    delay: i * 0.06,
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <RecentWorkItem work={work} index={i} />
                </motion.div>
              ))}
        </div>
      </div>
    </section>
  );
}

function RecentWorkItem({ work, index }) {
  const coverUrl = getCloudinaryUrl(work.cover_url, transforms.avatarSm);

  return (
    <Link to={`/works/${work.id}`} className={styles.item}>
      {/* Большой номер позади */}
      <span className={styles.itemBgIndex} aria-hidden>
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Обложка */}
      <div className={styles.itemCover}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={work.title}
            className={styles.itemCoverImg}
          />
        ) : (
          <span className={styles.itemCoverPlaceholder}>{work.title?.[0]}</span>
        )}
      </div>

      {/* Мета */}
      <div className={styles.itemMeta}>
        {work.fandom_name && (
          <span className={styles.itemFandom}>{work.fandom_name}</span>
        )}
        <h3 className={styles.itemTitle}>{work.title}</h3>
        <div className={styles.itemStats}>
          <span className={styles.itemAuthor}>
            {work.author_display_name || work.author_username}
          </span>
          <span className={styles.itemDot}>·</span>
          <span className={styles.itemChapters}>
            <BookOpen size={11} strokeWidth={1.5} />
            {work.chapters_count} гл.
          </span>
        </div>
      </div>

      {/* Время */}
      <div className={styles.itemTime}>
        {work.last_chapter_at && (
          <span className={styles.itemTimeText}>
            {formatDistanceToNow(new Date(work.last_chapter_at), {
              addSuffix: true,
              locale: ru,
            })}
          </span>
        )}
        <span className={styles.itemNewBadge}>Новая глава</span>
      </div>
    </Link>
  );
}
