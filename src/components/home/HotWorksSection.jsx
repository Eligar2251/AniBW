// src/components/home/HotWorksSection.jsx
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Flame, ChevronRight } from "lucide-react";
import { supabase } from "@lib/supabase";
import WorkCard from "@components/works/WorkCard";
import styles from "./HotWorksSection.module.css";

function useHotWorks() {
  return useQuery({
    queryKey: ["hot-works"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works_full")
        .select("*")
        .eq("visibility", "public")
        .neq("status", "draft")
        .order("views_count", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function HotWorksSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const { data: works = [], isLoading } = useHotWorks();

  return (
    <section className={styles.section} ref={ref}>
      <div className={styles.container}>
        {/* Заголовок секции */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, x: -30 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Большая фоновая цифра */}
          <span className={styles.bgNumber} aria-hidden>
            01
          </span>

          <div className={styles.headerLeft}>
            <Flame size={20} color="var(--color-accent)" strokeWidth={1.5} />
            <h2 className={styles.title}>
              Горячее
              <em className={styles.titleSub}> — топ этой недели</em>
            </h2>
          </div>

          <Link to="/works?sort=popular" className={styles.viewAll}>
            Все популярные
            <ChevronRight size={16} strokeWidth={1.5} />
          </Link>
        </motion.div>

        {/* Горизонтальный скролл */}
        <div className={styles.scrollTrack}>
          <div className={styles.scrollInner}>
            {isLoading
              ? Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className={styles.cardSkeleton}>
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
                      <div
                        className="skeleton"
                        style={{ height: 12, width: "40%" }}
                      />
                    </div>
                  </div>
                ))
              : works.map((work, i) => (
                  <div key={work.id} className={styles.cardWrap}>
                    <WorkCard work={work} index={i} />
                  </div>
                ))}
          </div>

          {/* Фейд по краям */}
          <div className={styles.fadeLeft} />
          <div className={styles.fadeRight} />
        </div>
      </div>
    </section>
  );
}
