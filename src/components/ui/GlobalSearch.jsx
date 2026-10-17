// src/components/ui/GlobalSearch.jsx
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, X, TrendingUp } from "lucide-react";
import { useUIStore } from "@store/uiStore";
import { useSearch } from "@hooks/useSearch";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import styles from "./GlobalSearch.module.css";

export default function GlobalSearch() {
  const searchOpen = useUIStore((s) => s.searchOpen);
  const closeSearch = useUIStore((s) => s.closeSearch);
  const inputRef = useRef(null);

  const {
    query,
    setQuery,
    results: { data: results = [], isLoading },
    debouncedQuery,
  } = useSearch();

  // Фокус при открытии
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
    }
  }, [searchOpen]);

  // Esc для закрытия
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const POPULAR_TAGS = [
    "Naruto",
    "Attack on Titan",
    "Jujutsu Kaisen",
    "My Hero Academia",
    "One Piece",
    "Demon Slayer",
  ];

  return (
    <AnimatePresence>
      {searchOpen && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && closeSearch()}
        >
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Строка поиска */}
            <div className={styles.inputRow}>
              <Search
                size={20}
                className={styles.searchIcon}
                strokeWidth={1.5}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск фанфиков, авторов, фандомов..."
                className={styles.input}
              />
              {query && (
                <button
                  className={styles.clearBtn}
                  onClick={() => setQuery("")}
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>

            <div className={styles.divider} />

            {/* Результаты */}
            <div className={styles.body}>
              {!debouncedQuery && (
                <div className={styles.suggestions}>
                  <div className={styles.suggestLabel}>
                    <TrendingUp size={14} strokeWidth={1.5} />
                    Популярные фандомы
                  </div>
                  <div className={styles.tagCloud}>
                    {POPULAR_TAGS.map((tag) => (
                      <Link
                        key={tag}
                        to={`/search?q=${encodeURIComponent(tag)}`}
                        className={styles.tagChip}
                        onClick={closeSearch}
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {debouncedQuery && isLoading && (
                <div className={styles.loadingRow}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className={styles.skeletonResult}>
                      <div className={`skeleton ${styles.skeletonCover}`} />
                      <div className={styles.skeletonMeta}>
                        <div
                          className="skeleton"
                          style={{ height: 11, width: "40%" }}
                        />
                        <div
                          className="skeleton"
                          style={{ height: 14, width: "80%" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {debouncedQuery && !isLoading && results.length === 0 && (
                <div className={styles.noResults}>
                  <span className={styles.noResultsKanji}>無</span>
                  <p>Ничего не найдено по «{debouncedQuery}»</p>
                </div>
              )}

              {results.length > 0 && (
                <div className={styles.results}>
                  {results.map((work) => (
                    <Link
                      key={work.id}
                      to={`/works/${work.id}`}
                      className={styles.resultItem}
                      onClick={closeSearch}
                    >
                      <div className={styles.resultCover}>
                        {work.cover_url ? (
                          <img
                            src={getCloudinaryUrl(
                              work.cover_url,
                              transforms.avatarSm,
                            )}
                            alt={work.title}
                            className={styles.resultCoverImg}
                          />
                        ) : (
                          <span className={styles.resultCoverPlaceholder}>
                            {work.title?.[0]}
                          </span>
                        )}
                      </div>
                      <div className={styles.resultMeta}>
                        {work.fandom_name && (
                          <span className={styles.resultFandom}>
                            {work.fandom_name}
                          </span>
                        )}
                        <span className={styles.resultTitle}>{work.title}</span>
                        <span className={styles.resultAuthor}>
                          {work.author_display_name || work.author_username}
                        </span>
                      </div>
                      <span className={styles.resultRating}>{work.rating}</span>
                    </Link>
                  ))}

                  {/* Ссылка на полный поиск */}
                  <Link
                    to={`/search?q=${encodeURIComponent(debouncedQuery)}`}
                    className={styles.allResultsLink}
                    onClick={closeSearch}
                  >
                    Все результаты по «{debouncedQuery}» →
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
