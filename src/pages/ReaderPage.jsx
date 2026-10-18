// src/pages/ReaderPage.jsx
import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  BookOpen,
  List,
  X,
  AlignLeft,
} from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { useReaderStore } from "@store/readerStore";
import ReaderSettings from "@components/reader/ReaderSettings";
import ReaderProgress from "@components/reader/ReaderProgress";
import ChapterComments from "@components/reader/ChapterComments";
import styles from "./ReaderPage.module.css";

function useChapter(chapterId, workId) {
  return useQuery({
    queryKey: ["chapter", workId, chapterId],
    queryFn: async () => {
      let chapterQuery = supabase
        .from("chapters")
        .select(`
          *,
          work:works(
            id, title, author_id,
            author:profiles(username, display_name),
            chapters_count
          )
        `);

      if (chapterId === "first") {
        chapterQuery = chapterQuery
          .eq("work_id", workId)
          .eq("status", "published")
          .order("chapter_number", { ascending: true })
          .limit(1);
      } else {
        chapterQuery = chapterQuery.eq("id", chapterId);
      }

      const { data, error } = await chapterQuery.maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const { error: viewError } = await supabase.rpc("increment_views", {
        work_id_in: data.work_id,
        chapter_id_in: data.id,
      });
      if (viewError) console.error("Could not record chapter view:", viewError);

      return data;
    },
    enabled: !!chapterId && !!workId,
  });
}

function useSavedProgress(userId, chapterId) {
  return useQuery({
    queryKey: ["chapter-progress", userId, chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_progress")
        .select("scroll_position")
        .eq("user_id", userId)
        .eq("chapter_id", chapterId)
        .maybeSingle();
      if (error) throw error;
      return data ? Number(data.scroll_position) : 0;
    },
    enabled: !!userId && !!chapterId,
  });
}

function useAdjacentChapters(workId, chapterNumber) {
  return useQuery({
    queryKey: ["adjacent-chapters", workId, chapterNumber],
    queryFn: async () => {
      const { data: prev } = await supabase
        .from("chapters")
        .select("id, title, chapter_number")
        .eq("work_id", workId)
        .eq("status", "published")
        .eq("chapter_number", chapterNumber - 1)
        .maybeSingle();

      const { data: next } = await supabase
        .from("chapters")
        .select("id, title, chapter_number")
        .eq("work_id", workId)
        .eq("status", "published")
        .eq("chapter_number", chapterNumber + 1)
        .maybeSingle();

      return { prev, next };
    },
    enabled: !!workId && !!chapterNumber,
  });
}

const FONT_FAMILIES = {
  serif: '"Lora", Georgia, serif',
  sans: '"Cormorant Garamond", sans-serif',
  mono: '"JetBrains Mono", monospace',
};

const READER_THEMES = {
  dark: { bg: "#0A0B12", text: "#F0EDE8", surface: "#0F1020" },
  sepia: { bg: "#F5ECD7", text: "#3A2E1E", surface: "#EDE0C4" },
  light: { bg: "#FAFAF8", text: "#1A1A1A", surface: "#F0EDE8" },
  oled: { bg: "#000000", text: "#E8E8E8", surface: "#0A0A0A" },
};

export default function ReaderPage() {
  const { id: workId, chapterId } = useParams();
  const contentRef = useRef(null);
  const headerRef = useRef(null);

  const user = useAuthStore((s) => s.user);
  const {
    font,
    fontSize,
    lineHeight,
    columnWidth,
    theme,
    settingsOpen,
    setSettingsOpen,
    setHeaderVisible,
    headerVisible,
  } = useReaderStore();

  const { data: chapter, isLoading } = useChapter(chapterId, workId);
  const { data: adjacent } = useAdjacentChapters(
    chapter?.work_id,
    chapter?.chapter_number,
  );
  const { data: savedProgress } = useSavedProgress(user?.id, chapter?.id);

  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  const themeVars = READER_THEMES[theme] || READER_THEMES.dark;

  // ── Прогресс скролла ──
  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    const scrolled = window.scrollY;
    const total = document.body.scrollHeight - window.innerHeight;
    const pct = total > 0 ? Math.min(scrolled / total, 1) : 0;
    setProgress(pct);

    // Прячем хедер при скролле вниз
    setHeaderVisible(scrolled < 80);
  }, [setHeaderVisible]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (savedProgress === undefined || !chapter) return;

    const frame = requestAnimationFrame(() => {
      const maxScroll = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        0,
      );
      if (maxScroll > 0 && savedProgress > 0) {
        window.scrollTo({ top: maxScroll * savedProgress, behavior: "auto" });
      } else {
        handleScroll();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [chapter, savedProgress, handleScroll]);

  // ── Сохранение прогресса ──
  const saveProgress = useMutation({
    mutationFn: async (scrollPos) => {
      if (!user || !chapter) return;
      const { error } = await supabase.from("chapter_progress").upsert(
        {
          user_id: user.id,
          work_id: chapter.work_id,
          chapter_id: chapter.id,
          scroll_position: scrollPos,
          is_completed: scrollPos > 0.9,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "user_id,chapter_id" },
      );
      if (error) throw error;
    },
  });

  // Автосохранение каждые 10 секунд
  const canSaveProgress = Boolean(user?.id && chapter?.id);
  const mutateProgress = saveProgress.mutate;
  useEffect(() => {
    if (!canSaveProgress) return undefined;
    const interval = window.setInterval(() => {
      mutateProgress(progressRef.current);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [canSaveProgress, mutateProgress]);

  if (isLoading) return <ReaderSkeleton theme={themeVars} />;
  if (!chapter) return <Navigate to={`/works/${workId}`} replace />;

  const cssVars = {
    "--reader-bg": themeVars.bg,
    "--reader-text": themeVars.text,
    "--reader-surface": themeVars.surface,
    "--reader-font": FONT_FAMILIES[font] || FONT_FAMILIES.serif,
    "--reader-size": `${fontSize}px`,
    "--reader-lh": lineHeight,
    "--reader-width": `${columnWidth}px`,
  };

  return (
    <div className={styles.page} style={cssVars}>
      {/* ── Прогресс-бар ── */}
      <ReaderProgress value={progress} />

      {/* ── Хедер ── */}
      <AnimatePresence>
        {headerVisible && (
          <motion.header
            ref={headerRef}
            className={styles.header}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link to={`/works/${workId}`} className={styles.backBtn}>
              <ChevronLeft size={16} strokeWidth={1.5} />
              <span>{chapter.work?.title}</span>
            </Link>

            <div className={styles.headerCenter}>
              <span className={styles.headerChapter}>
                Глава {chapter.chapter_number}
              </span>
              <span className={styles.headerDot}>·</span>
              <span className={styles.headerTitle}>{chapter.title}</span>
            </div>

            <div className={styles.headerActions}>
              <Link
                to={`/works/${workId}#chapters`}
                className={styles.headerBtn}
                title="Список глав"
                aria-label="Перейти к списку глав"
              >
                <List size={16} strokeWidth={1.5} />
              </Link>
              <button
                className={styles.headerBtn}
                onClick={() => setSettingsOpen(!settingsOpen)}
                title="Настройки"
              >
                <Settings size={16} strokeWidth={1.5} />
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* ── Настройки читателя ── */}
      <AnimatePresence>
        {settingsOpen && (
          <ReaderSettings onClose={() => setSettingsOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── Основной контент ── */}
      <main className={styles.main} ref={contentRef}>
        {/* Авторская заметка — начало */}
        {chapter.author_note_before && (
          <motion.div
            className={styles.authorNote}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className={styles.authorNoteLabel}>
              <span className={styles.authorNoteKanji}>注</span>
              <span>Заметка автора</span>
            </div>
            <p className={styles.authorNoteText}>
              {chapter.author_note_before}
            </p>
          </motion.div>
        )}

        {/* Заголовок главы */}
        <motion.div
          className={styles.chapterHeader}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.chapterNum}>
            {String(chapter.chapter_number).padStart(2, "0")}
          </span>
          <h1 className={styles.chapterTitle}>{chapter.title}</h1>
          <div className={styles.chapterMeta}>
            <span>{chapter.words_count?.toLocaleString()} слов</span>
            <span>·</span>
            <span>~{Math.ceil(chapter.words_count / 200)} мин. чтения</span>
          </div>
        </motion.div>

        {/* Текст главы */}
        <motion.div
          className={styles.content}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(chapter.content || ""),
          }}
        />

        {/* Авторская заметка — конец */}
        {chapter.author_note_after && (
          <div className={`${styles.authorNote} ${styles.authorNoteEnd}`}>
            <div className={styles.authorNoteLabel}>
              <span className={styles.authorNoteKanji}>後</span>
              <span>Заметка после главы</span>
            </div>
            <p className={styles.authorNoteText}>{chapter.author_note_after}</p>
          </div>
        )}

        {/* ── Навигация по главам ── */}
        <div className={styles.chapterNav}>
          {adjacent?.prev ? (
            <Link
              to={`/works/${workId}/read/${adjacent.prev.id}`}
              className={styles.navBtn}
            >
              <ChevronLeft size={18} strokeWidth={1.5} />
              <div className={styles.navBtnText}>
                <span className={styles.navBtnLabel}>Предыдущая</span>
                <span className={styles.navBtnChapter}>
                  Гл. {adjacent.prev.chapter_number}: {adjacent.prev.title}
                </span>
              </div>
            </Link>
          ) : (
            <div />
          )}

          <Link to={`/works/${workId}`} className={styles.navBtnCenter}>
            <BookOpen size={16} strokeWidth={1.5} />
            <span>К произведению</span>
          </Link>

          {adjacent?.next ? (
            <Link
              to={`/works/${workId}/read/${adjacent.next.id}`}
              className={`${styles.navBtn} ${styles.navBtnRight}`}
            >
              <div className={styles.navBtnText}>
                <span className={styles.navBtnLabel}>Следующая</span>
                <span className={styles.navBtnChapter}>
                  Гл. {adjacent.next.chapter_number}: {adjacent.next.title}
                </span>
              </div>
              <ChevronRight size={18} strokeWidth={1.5} />
            </Link>
          ) : (
            <div className={styles.endMessage}>
              <span className={styles.endKanji}>終</span>
              <span>Конец</span>
            </div>
          )}
        </div>

        {/* Комментарии */}
        <ChapterComments chapterId={chapter.id} workId={workId} />
      </main>
    </div>
  );
}

function ReaderSkeleton({ theme }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "100px 20px",
        gap: 24,
      }}
    >
      {[80, 60, 100, 90, 70].map((w, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 18, width: `min(${w}%, 680px)`, borderRadius: 4 }}
        />
      ))}
    </div>
  );
}
