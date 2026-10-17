// src/components/home/HeroSection.jsx
import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { Link } from "react-router-dom";
import { Search, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import styles from "./HeroSection.module.css";

// Хук: загрузка топ-обложек для коллажа
function useHeroCovers() {
  return useQuery({
    queryKey: ["hero-covers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("works")
        .select("id, title, cover_url, author:profiles(username, display_name)")
        .eq("visibility", "public")
        .neq("status", "draft")
        .not("cover_url", "is", null)
        .order("views_count", { ascending: false })
        .limit(12);
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

const HERO_TITLES = ["История", "ждёт", "тебя"];

export default function HeroSection() {
  const ref = useRef(null);
  const [searchVal, setSearchVal] = useState("");
  const { data: covers = [] } = useHeroCovers();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const titleY = useTransform(scrollYProgress, [0, 1], ["0%", "-20%"]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchVal)}`;
    }
  };

  return (
    <section ref={ref} className={styles.hero}>
      {/* ── Фоновый коллаж из обложек ── */}
      <motion.div className={styles.collage} style={{ y: bgY }}>
        {covers.slice(0, 9).map((work, i) => (
          <motion.div
            key={work.id}
            className={`${styles.collageItem} ${styles[`item${i}`]}`}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: i * 0.08,
              duration: 1.2,
              ease: [0.25, 0.1, 0, 1],
            }}
          >
            <img
              src={getCloudinaryUrl(work.cover_url, transforms.cover)}
              alt={work.title}
              className={styles.collageImg}
              loading="lazy"
            />
            <div className={styles.collageOverlay} />
          </motion.div>
        ))}

        {/* Текстурный оверлей */}
        <div className={styles.textureOverlay} />
        <div className={styles.gradientOverlay} />
      </motion.div>

      {/* ── Декоративные японские символы ── */}
      <div className={styles.jpDecoLeft} aria-hidden>
        愛
      </div>
      <div className={styles.jpDecoRight} aria-hidden>
        夢
      </div>

      {/* ── SVG ink-splatter ── */}
      <svg className={styles.inkSplash} viewBox="0 0 400 400" aria-hidden>
        <filter id="turbulence">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.02"
            numOctaves="3"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" />
        </filter>
        <ellipse
          cx="200"
          cy="200"
          rx="180"
          ry="140"
          fill="none"
          stroke="rgba(232,53,74,0.15)"
          strokeWidth="1"
          filter="url(#turbulence)"
        />
      </svg>

      {/* ── Контент ── */}
      <motion.div className={styles.content} style={{ y: titleY, opacity }}>
        {/* Надпись над заголовком */}
        <motion.div
          className={styles.eyebrow}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.eyebrowLine} />
          <span>Платформа аниме-фанфиков</span>
        </motion.div>

        {/* Главный заголовок */}
        <h1 className={styles.title}>
          {HERO_TITLES.map((word, i) => (
            <motion.span
              key={word}
              className={styles.titleWord}
              initial={{ opacity: 0, y: 60, rotateX: -20 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{
                delay: 0.4 + i * 0.12,
                duration: 0.9,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {i === 1 ? <em className={styles.titleAccent}>{word}</em> : word}
            </motion.span>
          ))}
        </h1>

        {/* Подзаголовок */}
        <motion.p
          className={styles.subtitle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Читай и создавай фанфики по любимым аниме.
          <br />
          Тысячи историй — от флаффа до тёмного AU.
        </motion.p>

        {/* Строка поиска */}
        <motion.form
          className={styles.searchForm}
          onSubmit={handleSearch}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={styles.searchInner}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Найти фанфик, автора, фандом..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className={styles.searchInput}
            />
            <button type="submit" className={styles.searchBtn}>
              Найти
            </button>
          </div>
          <div className={styles.searchHints}>
            {[
              "Naruto",
              "Jujutsu Kaisen",
              "Attack on Titan",
              "My Hero Academia",
            ].map((hint) => (
              <button
                key={hint}
                type="button"
                className={styles.searchHint}
                onClick={() => setSearchVal(hint)}
              >
                {hint}
              </button>
            ))}
          </div>
        </motion.form>
      </motion.div>

      {/* ── Индикатор скролла ── */}
      <motion.div
        className={styles.scrollIndicator}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <span className={styles.scrollLabel}>Листай</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown size={16} color="var(--color-text-muted)" />
        </motion.div>
      </motion.div>
    </section>
  );
}
