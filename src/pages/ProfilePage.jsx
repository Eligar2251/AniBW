// src/pages/ProfilePage.jsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@lib/supabase";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import WorkCard from "@components/works/WorkCard";
import styles from "./ProfilePage.module.css";

function useProfile(username) {
  return useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (!profile) throw new Error("Пользователь не найден");

      const { data: works } = await supabase
        .from("works_full")
        .select("*")
        .eq("author_id", profile.id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(12);

      return { profile, works: works || [] };
    },
    enabled: !!username,
  });
}

export default function ProfilePage() {
  const { username } = useParams();
  const { data, isLoading } = useProfile(username);

  if (isLoading)
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className="skeleton" style={{ height: 240, borderRadius: 8 }} />
        </div>
      </div>
    );

  const { profile, works } = data || {};
  const avatarUrl = getCloudinaryUrl(profile?.avatar_url, transforms.avatar);
  const bannerUrl = getCloudinaryUrl(profile?.banner_url, transforms.banner);

  return (
    <div className={styles.page}>
      {/* Баннер */}
      <div className={styles.banner}>
        {bannerUrl ? (
          <img src={bannerUrl} alt="" className={styles.bannerImg} />
        ) : (
          <div className={styles.bannerDefault} />
        )}
        <div className={styles.bannerOverlay} />
      </div>

      <div className={styles.container}>
        {/* Шапка профиля */}
        <motion.div
          className={styles.profileHead}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className={styles.avatarWrap}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile?.display_name}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {profile?.display_name?.[0]?.toUpperCase()}
              </div>
            )}
          </div>

          <div className={styles.profileInfo}>
            <h1 className={styles.displayName}>
              {profile?.display_name || profile?.username}
            </h1>
            <span className={styles.username}>@{profile?.username}</span>
            {profile?.bio && <p className={styles.bio}>{profile.bio}</p>}
          </div>
        </motion.div>

        {/* Произведения */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Произведения ({works.length})</h2>
          <div className={styles.grid}>
            {works.map((work, i) => (
              <WorkCard key={work.id} work={work} index={i} />
            ))}
          </div>
          {works.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyKanji}>無</span>
              <p>Опубликованных произведений пока нет</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
