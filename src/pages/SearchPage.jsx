// src/pages/SearchPage.jsx
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { supabase } from "@lib/supabase";
import WorkCard from "@components/works/WorkCard";
import styles from "./SearchPage.module.css";

function useSearch(query, tag, genre) {
  return useQuery({
    queryKey: ["search", query, tag, genre],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_works", {
        search_query_in: query.trim() || null,
        tag_in: tag || null,
        genre_in: genre || null,
        result_limit: 24,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: true,
  });
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inputVal, setInputVal] = useState(searchParams.get("q") || "");
  const query = searchParams.get("q") || "";
  const tag = searchParams.get("tag") || "";
  const genre = searchParams.get("genre") || "";

  const { data: results = [], isLoading, isError } = useSearch(query, tag, genre);

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextParams = {};
    if (inputVal.trim()) nextParams.q = inputVal.trim();
    if (tag) nextParams.tag = tag;
    if (genre) nextParams.genre = genre;
    setSearchParams(nextParams);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <motion.div
          className={styles.hero}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className={styles.heroKanji} aria-hidden>
            探
          </span>
          <h1 className={styles.title}>Поиск</h1>

          <form className={styles.searchForm} onSubmit={handleSubmit}>
            <div className={styles.searchInner}>
              <Search
                size={18}
                className={styles.searchIcon}
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Название, автор, фандом..."
                className={styles.searchInput}
                autoFocus
              />
              <button type="submit" className={styles.searchBtn}>
                Найти
              </button>
            </div>
          </form>

          {(query || tag || genre) && (
            <p className={styles.resultCount}>
              {isLoading
                ? "Ищем..."
                : isError
                  ? "Не удалось выполнить поиск. Попробуйте ещё раз."
                  : `Найдено: ${results.length} результатов${query ? ` по запросу «${query}»` : ""}${tag ? ` · тег «${tag}»` : ""}${genre ? ` · жанр «${genre}»` : ""}`}
            </p>
          )}
        </motion.div>

        <div className={styles.grid}>
          {isLoading
            ? Array.from({ length: 8 }, (_, i) => (
                <div key={i} className={styles.skeleton}>
                  <div className={`skeleton ${styles.skeletonCover}`} />
                </div>
              ))
            : results.map((work, i) => (
                <WorkCard key={work.id} work={work} index={i} />
              ))}
        </div>

        {!isLoading && !isError && results.length === 0 && (query || tag || genre) && (
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>無</span>
            <p>
              {query
                ? `Ничего не найдено по запросу «${query}»`
                : `По заданным фильтрам ничего не найдено${tag ? ` (тег: ${tag})` : ""}${genre ? ` (жанр: ${genre})` : ""}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
