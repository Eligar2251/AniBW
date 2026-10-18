// src/pages/WorkPage.jsx
import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Heart,
  Bookmark,
  Share2,
  AlertTriangle,
  ChevronDown,
  Eye,
  MessageCircle,
  Calendar,
  Hash,
  Users,
  Star,
  Map,
} from "lucide-react";
import { supabase } from "@lib/supabase";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import { useAuthStore } from "@store/authStore";
import { useUIStore } from "@store/uiStore";
import { useWorkBookmark, useWorkLike } from "@hooks/useWorkEngagement";
import ChapterList from "@components/works/ChapterList";
import WorkComments from "@components/works/WorkComments";
import WorkCard from "@components/works/WorkCard";
import styles from "./WorkPage.module.css";
import { formatDistanceToNow, format } from "date-fns";
import { ru } from "date-fns/locale";

function useWork(id) {
  return useQuery({
    queryKey: ["work", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works_full")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;

      // Инкрементируем просмотры
      await supabase.rpc("increment_views", { work_id_in: id });

      return data;
    },
    enabled: !!id,
  });
}

function useSimilarWorks(workId, fandomId) {
  return useQuery({
    queryKey: ["similar-works", workId],
    queryFn: async () => {
      const { data } = await supabase
        .from("works_full")
        .select("*")
        .eq("fandom_id", fandomId)
        .eq("visibility", "public")
        .neq("status", "draft")
        .neq("id", workId)
        .limit(4);
      return data || [];
    },
    enabled: !!fandomId,
  });
}

function usePublicWorldAvailability(workId) {
  return useQuery({
    queryKey: ["public-world-availability", workId],
    queryFn: async () => {
      const [entriesResult, markersResult, mapResult] = await Promise.all([
        supabase
          .from("world_entries")
          .select("id", { count: "exact", head: true })
          .eq("work_id", workId)
          .eq("is_published", true),
        supabase
          .from("map_markers")
          .select("id", { count: "exact", head: true })
          .eq("work_id", workId)
          .eq("is_published", true),
        supabase
          .from("world_map_settings")
          .select("background_url, map_state")
          .eq("work_id", workId)
          .eq("is_published", true)
          .maybeSingle(),
      ]);
      if (entriesResult.error) throw entriesResult.error;
      if (markersResult.error) throw markersResult.error;
      if (mapResult.error) throw mapResult.error;
      return (
        (entriesResult.count || 0) > 0 ||
        (markersResult.count || 0) > 0 ||
        Boolean(mapResult.data?.background_url) ||
        (mapResult.data?.map_state?.tiles?.length || 0) > 0 ||
        (mapResult.data?.map_state?.strokes?.length || 0) > 0 ||
        (mapResult.data?.map_state?.stamps?.length || 0) > 0 ||
        (mapResult.data?.map_state?.countries?.length || 0) > 0
      );
    },
    enabled: !!workId,
    retry: 1,
  });
}

const RATING_INFO = {
  G: { color: "#2ECC71", desc: "Подходит для всех возрастов" },
  PG: { color: "#5B9BD5", desc: "Рекомендуется родительский контроль" },
  "PG-13": { color: "#F0A830", desc: "Для читателей от 13 лет" },
  R: { color: "#E8354A", desc: "Для читателей от 18 лет" },
  "NC-17": { color: "#7F1D1D", desc: "Только для взрослых (18+)" },
};

export default function WorkPage() {
  const { id } = useParams();
  const location = useLocation();
  const { data: work, isLoading } = useWork(id);
  const { data: similar = [] } = useSimilarWorks(id, work?.fandom_id);
  const { data: hasPublishedWorld = false } = usePublicWorldAvailability(id);
  const { isLiked, toggleLike } = useWorkLike(id);
  const { isBookmarked, toggleBookmark } = useWorkBookmark(id);
  const [descExpanded, setDescExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("chapters");
  const [shareCopied, setShareCopied] = useState(false);

  const user = useAuthStore((s) => s.user);
  const openAuthModal = useUIStore((s) => s.openAuthModal);

  useEffect(() => {
    if (location.hash !== "#chapters") return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("chapters")?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash, id]);

  const handleLike = () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    toggleLike.mutate(undefined, {
      onError: (error) => window.alert(error.message || "Не удалось поставить лайк"),
    });
  };

  const handleBookmark = () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    toggleBookmark.mutate(undefined, {
      onError: (error) => window.alert(error.message || "Не удалось изменить закладку"),
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: work?.title, url });
        return;
      }
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch (error) {
      if (error?.name !== "AbortError") {
        window.prompt("Скопируйте ссылку на произведение", url);
      }
    }
  };

  if (isLoading) return <WorkPageSkeleton />;
  if (!work) return <div>Произведение не найдено</div>;

  const coverUrl = getCloudinaryUrl(work.cover_url, transforms.coverLg);
  const bannerUrl = getCloudinaryUrl(work.cover_url, transforms.blur);
  const ratingInfo = RATING_INFO[work.rating] || RATING_INFO["G"];
  const hasWarnings =
    work.warn_violence ||
    work.warn_death ||
    work.warn_noncon ||
    work.warn_underage ||
    work.warn_other;

  return (
    <div className={styles.page}>
      {/* ── Баннер-шапка ── */}
      <div className={styles.banner}>
        {bannerUrl && (
          <motion.img
            src={bannerUrl}
            alt=""
            className={styles.bannerBg}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.5, ease: [0.25, 0.1, 0, 1] }}
          />
        )}
        <div className={styles.bannerOverlay} />

        {/* Декор */}
        <span className={styles.bannerKanji} aria-hidden>
          物
        </span>

        <div className={styles.bannerContent}>
          {/* Обложка */}
          <motion.div
            className={styles.coverWrap}
            initial={{ opacity: 0, y: 40, rotateY: -10 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            {coverUrl ? (
              <img src={coverUrl} alt={work.title} className={styles.cover} />
            ) : (
              <div className={styles.coverPlaceholder}>
                <span>{work.title?.[0]}</span>
              </div>
            )}
            <div className={styles.coverShadow} />
          </motion.div>

          {/* Основная информация */}
          <motion.div
            className={styles.workInfo}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Фандом */}
            {work.fandom_name && (
              <Link
                to={`/fandoms/${work.fandom_slug}`}
                className={styles.fandomLink}
              >
                {work.fandom_name}
              </Link>
            )}

            {/* Заголовок */}
            <h1 className={styles.workTitle}>{work.title}</h1>

            {/* Автор */}
            <div className={styles.authorRow}>
              <span className={styles.authorLabel}>автор:</span>
              <Link
                to={`/profile/${work.author_username}`}
                className={styles.authorLink}
              >
                {work.author_display_name || work.author_username}
              </Link>
            </div>

            {/* Метаданные */}
            <div className={styles.metaBadges}>
              {/* Рейтинг */}
              <span
                className={styles.ratingBadge}
                style={{ "--rc": ratingInfo.color }}
                title={ratingInfo.desc}
              >
                {work.rating}
              </span>

              {/* Категория */}
              <span className={styles.metaBadge}>{work.category}</span>

              {/* Статус */}
              <span
                className={`${styles.metaBadge} ${styles[`status-${work.status}`]}`}
              >
                {work.status === "completed"
                  ? "✓ Завершено"
                  : work.status === "ongoing"
                    ? "● В процессе"
                    : work.status === "frozen"
                      ? "❄ Заморожено"
                      : work.status}
              </span>

              {/* Язык */}
              <span className={styles.metaBadge}>
                {work.language?.toUpperCase()}
              </span>
            </div>

            {/* Статистика */}
            <div className={styles.statsRow}>
              <div className={styles.statItem}>
                <Eye size={14} strokeWidth={1.5} />
                <span>{formatNum(work.views_count)}</span>
                <span className={styles.statLabel}>просмотров</span>
              </div>
              <div className={styles.statItem}>
                <Heart size={14} strokeWidth={1.5} />
                <span>{formatNum(work.likes_count)}</span>
                <span className={styles.statLabel}>лайков</span>
              </div>
              <div className={styles.statItem}>
                <MessageCircle size={14} strokeWidth={1.5} />
                <span>{work.comments_count}</span>
                <span className={styles.statLabel}>комментариев</span>
              </div>
              <div className={styles.statItem}>
                <BookOpen size={14} strokeWidth={1.5} />
                <span>{work.chapters_count}</span>
                <span className={styles.statLabel}>глав</span>
              </div>
              <div className={styles.statItem}>
                <Hash size={14} strokeWidth={1.5} />
                <span>{formatNum(work.words_count)}</span>
                <span className={styles.statLabel}>слов</span>
              </div>
            </div>

            {/* CTA кнопки */}
            <div className={styles.ctaRow}>
              <Link
                to={`/works/${work.id}/read/first`}
                className={styles.readBtn}
              >
                <BookOpen size={16} strokeWidth={1.5} />
                Читать с начала
              </Link>
              {hasPublishedWorld && (
                <Link
                  to={`/works/${work.id}/world`}
                  className={styles.worldBtn}
                  title="Открыть энциклопедию и атлас мира"
                >
                  <Map size={16} strokeWidth={1.5} />
                  Мир
                </Link>
              )}
              <button
                className={styles.bookmarkBtn}
                onClick={handleBookmark}
                disabled={toggleBookmark.isPending}
                aria-pressed={isBookmarked}
                title={isBookmarked ? "Убрать из закладок" : "Добавить в закладки"}
              >
                <Bookmark size={16} strokeWidth={1.5} />В закладки
              </button>
              <button
                className={styles.likeBtn}
                onClick={handleLike}
                disabled={toggleLike.isPending}
                aria-label={isLiked ? "Убрать лайк" : "Поставить лайк"}
                aria-pressed={isLiked}
                title={isLiked ? "Убрать лайк" : "Поставить лайк"}
              >
                <Heart size={16} strokeWidth={1.5} />
              </button>
              <button
                className={styles.shareBtn}
                onClick={handleShare}
                aria-label="Поделиться произведением"
                title={shareCopied ? "Ссылка скопирована" : "Поделиться"}
              >
                <Share2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Основной контент ── */}
      <div className={styles.body}>
        <div className={styles.mainCol}>
          {/* Предупреждения */}
          {hasWarnings && (
            <motion.div
              className={styles.warningBlock}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <AlertTriangle
                size={16}
                color="var(--color-warning)"
                strokeWidth={1.5}
              />
              <div>
                <strong>Предупреждения:</strong>
                <div className={styles.warningList}>
                  {work.warn_violence && <span>Жестокость</span>}
                  {work.warn_death && <span>Смерть персонажа</span>}
                  {work.warn_noncon && <span>Нон-кон</span>}
                  {work.warn_underage && <span>Несовершеннолетние</span>}
                  {work.warn_other && <span>{work.warn_other}</span>}
                </div>
              </div>
            </motion.div>
          )}

          {/* Аннотация */}
          <motion.div
            className={styles.descSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <div className={styles.sectionLabel}>
              <span className={styles.sectionLabelLine} />
              <span>Аннотация</span>
            </div>
            <div
              className={`${styles.descText} ${descExpanded ? styles.descExpanded : ""}`}
            >
              <p>{work.description || work.summary}</p>
            </div>
            {work.description?.length > 400 && (
              <button
                className={styles.expandBtn}
                onClick={() => setDescExpanded((v) => !v)}
              >
                {descExpanded ? "Скрыть" : "Читать полностью"}
                <ChevronDown
                  size={14}
                  style={{
                    transform: descExpanded ? "rotate(180deg)" : "none",
                    transition: "transform 0.3s",
                  }}
                />
              </button>
            )}

            {/* Теги */}
            {work.tags?.length > 0 && (
              <div className={styles.tagsWrap}>
                {work.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/search?tag=${encodeURIComponent(tag)}`}
                    className={styles.tag}
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </motion.div>

          {/* Табы */}
          <div className={styles.tabs} id="chapters">
            {["chapters", "comments", "similar"].map((tab) => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "chapters"
                  ? `Главы (${work.chapters_count})`
                  : tab === "comments"
                    ? `Комментарии (${work.comments_count})`
                    : "Похожие"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === "chapters" && <ChapterList workId={work.id} />}
              {activeTab === "comments" && <WorkComments workId={work.id} />}
              {activeTab === "similar" && (
                <div className={styles.similarGrid}>
                  {similar.map((w, i) => (
                    <WorkCard key={w.id} work={w} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Боковая панель */}
        <aside className={styles.sidebar}>
          <WorkSidebar work={work} />
        </aside>
      </div>
    </div>
  );
}

function WorkSidebar({ work }) {
  return (
    <div className={styles.sidebarInner}>
      {/* Даты */}
      <div className={styles.sidebarBlock}>
        <div className={styles.sidebarLabel}>Информация</div>
        <div className={styles.sidebarRows}>
          {work.first_published_at && (
            <div className={styles.sidebarRow}>
              <span className={styles.sidebarRowLabel}>Опубликовано</span>
              <span>
                {format(new Date(work.first_published_at), "d MMM yyyy", {
                  locale: ru,
                })}
              </span>
            </div>
          )}
          {work.last_chapter_at && (
            <div className={styles.sidebarRow}>
              <span className={styles.sidebarRowLabel}>Обновлено</span>
              <span>
                {formatDistanceToNow(new Date(work.last_chapter_at), {
                  addSuffix: true,
                  locale: ru,
                })}
              </span>
            </div>
          )}
          <div className={styles.sidebarRow}>
            <span className={styles.sidebarRowLabel}>Слов</span>
            <span>{formatNum(work.words_count)}</span>
          </div>
          <div className={styles.sidebarRow}>
            <span className={styles.sidebarRowLabel}>Глав</span>
            <span>{work.chapters_count}</span>
          </div>
          <div className={styles.sidebarRow}>
            <span className={styles.sidebarRowLabel}>Рейтинг</span>
            <span style={{ color: RATING_INFO[work.rating]?.color }}>
              {work.rating}
            </span>
          </div>
        </div>
      </div>

      {/* Тонкий делитель */}
      <hr className="divider" />

      {/* Теги в сайдбаре */}
      {work.tags?.length > 0 && (
        <div className={styles.sidebarBlock}>
          <div className={styles.sidebarLabel}>Теги</div>
          <div className={styles.sidebarTags}>
            {work.tags.map((tag) => (
              <Link
                key={tag}
                to={`/search?tag=${encodeURIComponent(tag)}`}
                className={styles.sidebarTag}
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkPageSkeleton() {
  return (
    <div className={styles.page}>
      <div
        className={styles.banner}
        style={{ minHeight: 400, background: "var(--color-bg-raised)" }}
      >
        <div className={styles.bannerContent}>
          <div
            className={`skeleton ${styles.cover}`}
            style={{ borderRadius: 4 }}
          />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div className="skeleton" style={{ height: 14, width: "30%" }} />
            <div className="skeleton" style={{ height: 40, width: "80%" }} />
            <div className="skeleton" style={{ height: 14, width: "40%" }} />
            <div className="skeleton" style={{ height: 48, width: "60%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNum(n = 0) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}
