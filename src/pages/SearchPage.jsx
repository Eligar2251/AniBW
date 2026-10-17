// src/pages/SearchPage.jsx
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { supabase } from "@lib/supabase";
import WorkCard from "@components/works/WorkCard";
import styles from "./SearchPage.module.css";

function useSearch(query) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      if (!query?.trim()) {
        const { data } = await supabase
          .from("works_full")
          .select("*")
          .order("views_count", { ascending: false })
          .limit(24);
        return data || [];
      }

      const { data } = await supabase
        .from("works_full")
        .select("*")
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(24);
      return data || [];
    },
    enabled: true,
  });
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inputVal, setInputVal] = useState(searchParams.get("q") || "");
  const query = searchParams.get("q") || "";

  const { data: results = [], isLoading } = useSearch(query);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputVal.trim()) {
      setSearchParams({ q: inputVal.trim() });
    }
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

          {query && (
            <p className={styles.resultCount}>
              {isLoading
                ? "Ищем..."
                : `Найдено: ${results.length} результатов по запросу «${query}»`}
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

        {!isLoading && results.length === 0 && query && (
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>無</span>
            <p>Ничего не найдено по запросу «{query}»</p>
          </div>
        )}
      </div>
    </div>
  );
}
