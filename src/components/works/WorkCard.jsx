// src/components/works/WorkCard.jsx
import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Eye, Heart, BookOpen, Clock } from "lucide-react";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import styles from "./WorkCard.module.css";

const RATING_COLORS = {
  G: "#2ECC71",
  PG: "#5B9BD5",
  "PG-13": "#F0A830",
  R: "#E8354A",
  "NC-17": "#7F1D1D",
};

const STATUS_LABELS = {
  ongoing: "В процессе",
  completed: "Завершено",
  frozen: "Заморожено",
  hiatus: "Пауза",
  draft: "Черновик",
};

export default function WorkCard({ work, index = 0 }) {
  const cardRef = useRef(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Параллакс на hover
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), {
    stiffness: 300,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), {
    stiffness: 300,
    damping: 30,
  });
  const imgX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), {
    stiffness: 200,
    damping: 25,
  });
  const imgY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-6, 6]), {
    stiffness: 200,
    damping: 25,
  });
  const glareX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const coverUrl = getCloudinaryUrl(work.cover_url, transforms.cover);

  return (
    <motion.div
      className={styles.wrapper}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.07,
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <motion.article
        ref={cardRef}
        className={styles.card}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={{ z: 20 }}
      >
        {/* Обложка */}
        <Link to={`/works/${work.id}`} className={styles.coverWrap}>
          <motion.div
            className={styles.coverInner}
            style={{ x: imgX, y: imgY }}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={work.title}
                className={styles.coverImg}
                loading="lazy"
              />
            ) : (
              <div className={styles.coverPlaceholder}>
                <span className={styles.placeholderKanji}>
                  {work.title?.[0] || "?"}
                </span>
              </div>
            )}
          </motion.div>

          {/* Hover оверлей с аннотацией */}
          <div className={styles.hoverOverlay}>
            <p className={styles.hoverSummary}>
              {work.summary || work.description?.slice(0, 120) + "..."}
            </p>
            <span className={styles.hoverReadBtn}>Читать →</span>
          </div>

          {/* Бейдж рейтинга */}
          <span
            className={styles.ratingBadge}
            style={{
              "--rating-color": RATING_COLORS[work.rating] || "#6B7280",
            }}
          >
            {work.rating}
          </span>

          {/* Бейдж статуса */}
          <span
            className={`${styles.statusBadge} ${styles[`status-${work.status}`]}`}
          >
            {STATUS_LABELS[work.status]}
          </span>

          {/* Глянцевый блик */}
          <motion.div
            className={styles.glare}
            style={{
              background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.08) 0%, transparent 60%)`,
            }}
          />
        </Link>

        {/* Мета */}
        <div className={styles.meta}>
          {/* Фандом */}
          {work.fandom_name && (
            <Link to={`/fandoms/${work.fandom_slug}`} className={styles.fandom}>
              {work.fandom_name}
            </Link>
          )}

          {/* Название */}
          <Link to={`/works/${work.id}`} className={styles.titleLink}>
            <h3 className={styles.title}>{work.title}</h3>
          </Link>

          {/* Автор */}
          <Link
            to={`/profile/${work.author_username}`}
            className={styles.author}
          >
            {work.author_display_name || work.author_username}
          </Link>

          {/* Теги */}
          {work.tags?.length > 0 && (
            <div className={styles.tags}>
              {work.tags.slice(0, 3).map((tag) => (
                <Link
                  key={tag}
                  to={`/search?tag=${encodeURIComponent(tag)}`}
                  className={styles.tag}
                >
                  {tag}
                </Link>
              ))}
              {work.tags.length > 3 && (
                <span className={styles.tagMore}>+{work.tags.length - 3}</span>
              )}
            </div>
          )}

          {/* Статистика */}
          <div className={styles.stats}>
            <span className={styles.stat}>
              <Eye size={12} strokeWidth={1.5} />
              {formatNum(work.views_count)}
            </span>
            <span className={styles.stat}>
              <Heart size={12} strokeWidth={1.5} />
              {formatNum(work.likes_count)}
            </span>
            <span className={styles.stat}>
              <BookOpen size={12} strokeWidth={1.5} />
              {work.chapters_count} гл.
            </span>
            {work.last_chapter_at && (
              <span className={`${styles.stat} ${styles.statDate}`}>
                <Clock size={12} strokeWidth={1.5} />
                {formatDistanceToNow(new Date(work.last_chapter_at), {
                  addSuffix: true,
                  locale: ru,
                })}
              </span>
            )}
          </div>
        </div>
      </motion.article>
    </motion.div>
  );
}

function formatNum(n = 0) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}
