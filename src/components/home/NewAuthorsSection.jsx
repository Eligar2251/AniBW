// src/components/home/NewAuthorsSection.jsx
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star, ChevronRight } from "lucide-react";
import { supabase } from "@lib/supabase";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import styles from "./NewAuthorsSection.module.css";

function useNewAuthors() {
  return useQuery({
    queryKey: ["new-authors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          `
          id, username, display_name, avatar_url, bio,
          works(count)
        `,
        )
        .eq("role", "author")
        .order("created_at", { ascending: false })
        .limit(6);
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export default function NewAuthorsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const { data: authors = [], isLoading } = useNewAuthors();

  if (!isLoading && authors.length === 0) return null;

  return (
    <section className={styles.section} ref={ref}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, x: -30 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.bgNumber} aria-hidden>
            04
          </span>
          <div className={styles.headerLeft}>
            <Star size={20} color="var(--color-amber)" strokeWidth={1.5} />
            <h2 className={styles.title}>Новые авторы</h2>
          </div>
        </motion.div>

        <div className={styles.grid}>
          {isLoading
            ? Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={`skeleton ${styles.skeletonAvatar}`} />
                  <div className={styles.skeletonMeta}>
                    <div
                      className="skeleton"
                      style={{ height: 14, width: "70%" }}
                    />
                    <div
                      className="skeleton"
                      style={{ height: 11, width: "50%" }}
                    />
                  </div>
                </div>
              ))
            : authors.map((author, i) => (
                <motion.div
                  key={author.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    delay: i * 0.08,
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <AuthorCard author={author} />
                </motion.div>
              ))}
        </div>
      </div>
    </section>
  );
}

function AuthorCard({ author }) {
  const avatarUrl = getCloudinaryUrl(author.avatar_url, transforms.avatar);

  return (
    <Link to={`/profile/${author.username}`} className={styles.card}>
      {/* Аватар */}
      <div className={styles.avatarWrap}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={author.display_name}
            className={styles.avatar}
          />
        ) : (
          <div className={styles.avatarPlaceholder}>
            {author.display_name?.[0]?.toUpperCase() ||
              author.username?.[0]?.toUpperCase()}
          </div>
        )}
        <div className={styles.avatarRing} />
      </div>

      {/* Инфо */}
      <div className={styles.info}>
        <span className={styles.name}>
          {author.display_name || author.username}
        </span>
        <span className={styles.username}>@{author.username}</span>
        {author.bio && (
          <p className={styles.bio}>{author.bio.slice(0, 60)}...</p>
        )}
      </div>

      {/* Декор */}
      <span className={styles.cardKanji} aria-hidden>
        新
      </span>
    </Link>
  );
}
