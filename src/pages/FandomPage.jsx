// src/pages/FandomPage.jsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@lib/supabase";
import WorkCard from "@components/works/WorkCard";
import styles from "./FandomPage.module.css";

function useFandom(slug) {
  return useQuery({
    queryKey: ["fandom", slug],
    queryFn: async () => {
      const { data: fandom, error: fandomError } = await supabase
        .from("fandoms")
        .select("*")
        .eq("slug", slug)
        .single();
      if (fandomError) throw fandomError;

      const { data: works, error: worksError } = await supabase
        .from("works_full")
        .select("*")
        .eq("fandom_id", fandom.id)
        .eq("visibility", "public")
        .neq("status", "draft")
        .order("views_count", { ascending: false })
        .limit(20);
      if (worksError) throw worksError;

      return { fandom, works: works || [] };
    },
    enabled: !!slug,
  });
}

export default function FandomPage() {
  const { slug } = useParams();
  const { data, isLoading, error } = useFandom(slug);

  if (isLoading)
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div
            className="skeleton"
            style={{ height: 200, borderRadius: 8, marginBottom: 32 }}
          />
        </div>
      </div>
    );

  if (error || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>無</span>
            <p>Фандом не найден</p>
          </div>
        </div>
      </div>
    );
  }

  const { fandom, works } = data;

  return (
    <div className={styles.page}>
      {/* Баннер */}
      <div className={styles.banner}>
        {fandom?.cover_url && (
          <img src={fandom.cover_url} alt="" className={styles.bannerBg} />
        )}
        <div className={styles.bannerOverlay} />
        <motion.div
          className={styles.bannerContent}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className={styles.bannerKanji} aria-hidden>
            界
          </span>
          <h1 className={styles.bannerTitle}>{fandom?.name}</h1>
          {fandom?.name_ru && (
            <p className={styles.bannerSub}>{fandom.name_ru}</p>
          )}
          <span className={styles.worksCount}>
            {fandom?.works_count} произведений
          </span>
        </motion.div>
      </div>

      <div className={styles.container}>
        {fandom?.description && (
          <p className={styles.description}>{fandom.description}</p>
        )}

        <h2 className={styles.sectionTitle}>Произведения</h2>

        <div className={styles.grid}>
          {works.map((work, i) => (
            <WorkCard key={work.id} work={work} index={i} />
          ))}
        </div>

        {works.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>空</span>
            <p>В этом фандоме пока нет произведений</p>
          </div>
        )}
      </div>
    </div>
  );
}
