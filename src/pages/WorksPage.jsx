// src/pages/WorksPage.jsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@lib/supabase";
import WorkCard from "@components/works/WorkCard";
import styles from "./WorksPage.module.css";

function useWorks(sort = "popular") {
  return useQuery({
    queryKey: ["works", sort],
    queryFn: async () => {
      const orderMap = {
        popular: { column: "views_count", ascending: false },
        new: { column: "created_at", ascending: false },
        updated: { column: "last_chapter_at", ascending: false },
      };
      const order = orderMap[sort] || orderMap.popular;

      const { data } = await supabase
        .from("works_full")
        .select("*")
        .order(order.column, { ascending: order.ascending })
        .limit(30);
      return data || [];
    },
  });
}

const SORT_OPTIONS = [
  { value: "popular", label: "Популярное" },
  { value: "new", label: "Новое" },
  { value: "updated", label: "Обновлённое" },
];

export default function WorksPage() {
  const [sort, setSort] = useState("popular");
  const { data: works = [], isLoading } = useWorks(sort);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className={styles.headerKanji} aria-hidden>
            読
          </span>
          <h1 className={styles.title}>Каталог</h1>
        </motion.div>

        {/* Сортировка */}
        <div className={styles.toolbar}>
          <div className={styles.sortRow}>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.sortBtn} ${sort === opt.value ? styles.sortBtnActive : ""}`}
                onClick={() => setSort(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Сетка */}
        <div className={styles.grid}>
          {isLoading
            ? Array.from({ length: 12 }, (_, i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={`skeleton ${styles.skeletonCover}`} />
                  <div className={styles.skeletonMeta}>
                    <div
                      className="skeleton"
                      style={{ height: 12, width: "60%" }}
                    />
                    <div
                      className="skeleton"
                      style={{ height: 16, width: "90%" }}
                    />
                  </div>
                </div>
              ))
            : works.map((work, i) => (
                <WorkCard key={work.id} work={work} index={i} />
              ))}
        </div>
      </div>
    </div>
  );
}
