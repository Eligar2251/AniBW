// src/pages/dashboard/CharactersPage.jsx
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Plus, Pencil } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import styles from "./CharactersPage.module.css";

function useCharacters() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["my-characters", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select(
          `
            id, full_name, nickname, role, avatar_url,
            primary_color, is_oc,
            avatar_scale, avatar_offset_x, avatar_offset_y,
            work:works(id, title),
            badges:character_badges(label, color, icon, category)
            `,
        )
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

const ROLE_LABELS = {
  protagonist: "Протагонист",
  antagonist: "Антагонист",
  supporting: "Второстепенный",
  minor: "Эпизодический",
  mentioned: "Упоминается",
};

function clampOffsetY(value) {
  return Math.min(value ?? 0, 0);
}

function getFrame(container, image, scale, offsetX, offsetY) {
  if (!container.width || !container.height || !image.width || !image.height) {
    return null;
  }

  const fitScale = Math.min(
    container.width / image.width,
    container.height / image.height,
  );

  const renderedWidth = image.width * fitScale * scale;
  const renderedHeight = image.height * fitScale * scale;

  const baseLeft = (container.width - renderedWidth) / 2;
  const left = baseLeft + (((offsetX ?? 50) - 50) / 100) * container.width;
  const top = clampOffsetY(((offsetY ?? 0) / 100) * container.height);

  return {
    width: renderedWidth,
    height: renderedHeight,
    left,
    top,
  };
}

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const node = ref.current;

    const update = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: rect.width,
        height: rect.height,
      });
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(node);

    return () => ro.disconnect();
  }, [ref]);

  return size;
}

export default function CharactersPage() {
  const { data: characters = [], isLoading } = useCharacters();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.headerKanji} aria-hidden>
            人
          </span>
          <h1 className={styles.title}>Персонажи</h1>
          <p className={styles.subtitle}>
            {characters.length} персонажей в галерее
          </p>
        </div>
        <Link to="/dashboard/characters/new" className={styles.newBtn}>
          <Plus size={16} strokeWidth={1.5} />
          Новый персонаж
        </Link>
      </div>

      <div className={styles.grid}>
        {isLoading
          ? Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={styles.skeletonCard}>
                <div className={`skeleton ${styles.skeletonCover}`} />
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
          : characters.map((char, i) => (
              <CharacterCard key={char.id} character={char} index={i} />
            ))}

        {!isLoading && (
          <motion.div
            className={styles.cardWrap}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: characters.length * 0.05 }}
          >
            <Link to="/dashboard/characters/new" className={styles.addCard}>
              <span className={styles.addCardKanji}>新</span>
              <Plus size={24} strokeWidth={1} color="var(--color-text-faint)" />
              <span className={styles.addCardLabel}>Добавить персонажа</span>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function CharacterCard({ character, index }) {
  const coverUrl = getCloudinaryUrl(character.avatar_url, transforms.character);
  const primaryColor = character.primary_color || "#6366F1";

  return (
    <motion.div
      className={styles.cardWrap}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.06,
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -6 }}
      style={{ "--char-color": primaryColor }}
    >
      <Link
        to={`/dashboard/characters/${character.id}`}
        className={styles.editBtn}
        title="Редактировать"
        onClick={(e) => e.stopPropagation()}
      >
        <Pencil size={13} strokeWidth={1.5} />
      </Link>

      <Link
        to={`/dashboard/characters/${character.id}`}
        className={styles.card}
      >
        <div className={styles.cardCover}>
          {coverUrl ? (
            <CharacterCardImage
              src={coverUrl}
              alt={character.full_name}
              scale={character.avatar_scale ?? 1}
              offsetX={character.avatar_offset_x ?? 50}
              offsetY={character.avatar_offset_y ?? 0}
            />
          ) : (
            <div className={styles.cardPlaceholder}>
              <span className={styles.cardPlaceholderText}>
                {character.full_name?.[0]}
              </span>
            </div>
          )}

          <div className={styles.cardColorBar} />

          {character.is_oc && <span className={styles.ocBadge}>OC</span>}

          <div className={styles.cardOverlay}>
            <div className={styles.cardOverlayBadges}>
              {character.badges?.slice(0, 3).map((badge, i) => (
                <span
                  key={i}
                  className={styles.cardOverlayBadge}
                  style={{ background: badge.color + "33", color: badge.color }}
                >
                  {badge.label}
                </span>
              ))}
            </div>
            {character.work && (
              <span className={styles.cardOverlayWork}>
                {character.work.title}
              </span>
            )}
          </div>
        </div>

        <div className={styles.cardMeta}>
          <h3 className={styles.cardName}>{character.full_name}</h3>
          {character.nickname && (
            <span className={styles.cardNick}>«{character.nickname}»</span>
          )}
          <span className={styles.cardRole}>
            {ROLE_LABELS[character.role] ?? character.role}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function CharacterCardImage({ src, alt, scale, offsetX, offsetY }) {
  const frameRef = useRef(null);
  const size = useElementSize(frameRef);
  const [natural, setNatural] = useState({ width: 0, height: 0 });

  const frame = useMemo(
    () => getFrame(size, natural, scale, offsetX, offsetY),
    [size, natural, scale, offsetX, offsetY],
  );

  return (
    <div ref={frameRef} className={styles.cardImgFrame}>
      <div className={styles.cardImgLayer}>
        <img
          src={src}
          alt={alt}
          className={styles.cardImg}
          loading="lazy"
          onLoad={(e) => {
            setNatural({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            });
          }}
          style={
            frame
              ? {
                  width: `${frame.width}px`,
                  height: `${frame.height}px`,
                  left: `${frame.left}px`,
                  top: `${frame.top}px`,
                }
              : {
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  objectPosition: "50% 0%",
                }
          }
        />
      </div>
    </div>
  );
}
