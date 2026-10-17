// src/pages/BookmarksPage.jsx
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import WorkCard from "@components/works/WorkCard";
import styles from "./BookmarksPage.module.css";

const FOLDERS = [
  { id: "reading", label: "Читаю" },
  { id: "completed", label: "Прочитано" },
  { id: "want_to_read", label: "Хочу прочитать" },
  { id: "dropped", label: "Брошено" },
];

function useBookmarks(folder) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["bookmarks", user?.id, folder],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookmarks")
        .select("work:works_full(*)")
        .eq("user_id", user.id)
        .eq("folder", folder)
        .order("added_at", { ascending: false });
      return (data || []).map((b) => b.work).filter(Boolean);
    },
    enabled: !!user,
  });
}

import { useState } from "react";

export default function BookmarksPage() {
  const [activeFolder, setActiveFolder] = useState("reading");
  const { data: works = [], isLoading } = useBookmarks(activeFolder);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className={styles.headerKanji} aria-hidden>
            栞
          </span>
          <h1 className={styles.title}>Закладки</h1>
        </motion.div>

        <div className={styles.folders}>
          {FOLDERS.map((f) => (
            <button
              key={f.id}
              className={`${styles.folderBtn} ${activeFolder === f.id ? styles.folderBtnActive : ""}`}
              onClick={() => setActiveFolder(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {isLoading
            ? Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div
                    className={`skeleton`}
                    style={{ aspectRatio: "2/3", borderRadius: 4 }}
                  />
                </div>
              ))
            : works.map((work, i) => (
                <WorkCard key={work.id} work={work} index={i} />
              ))}
        </div>

        {!isLoading && works.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>空</span>
            <p>В этой папке пусто</p>
          </div>
        )}
      </div>
    </div>
  );
}
