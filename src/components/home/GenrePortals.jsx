// src/components/home/GenrePortals.jsx
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import styles from "./GenrePortals.module.css";

const GENRES = [
  {
    name: "Экшн",
    slug: "action",
    jp: "戦",
    color: "#E8354A",
    bg: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&q=60",
    desc: "Битвы, сражения, адреналин",
  },
  {
    name: "Романтика",
    slug: "romance",
    jp: "愛",
    color: "#EC4899",
    bg: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&q=60",
    desc: "Сердца и чувства",
  },
  {
    name: "Хоррор",
    slug: "horror",
    jp: "恐",
    color: "#7C3AED",
    bg: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=600&q=60",
    desc: "Тьма, страх, паранойя",
  },
  {
    name: "Ангст",
    slug: "angst",
    jp: "痛",
    color: "#6366F1",
    bg: "https://images.unsplash.com/photo-1519750783826-e2420f4d687f?w=600&q=60",
    desc: "Боль, потеря, внутренний конфликт",
  },
  {
    name: "AU",
    slug: "au",
    jp: "夢",
    color: "#10B981",
    bg: "https://images.unsplash.com/photo-1465101162946-4377e57745c3?w=600&q=60",
    desc: "Альтернативные вселенные",
  },
  {
    name: "Флафф",
    slug: "fluff",
    jp: "甘",
    color: "#F0A830",
    bg: "https://images.unsplash.com/photo-1548247416-ec66f4900b2e?w=600&q=60",
    desc: "Милота, уют, мягкость",
  },
];

export default function GenrePortals() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className={styles.section} ref={ref}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <span className={styles.bgNumber} aria-hidden>
            02
          </span>
          <h2 className={styles.title}>Жанры</h2>
          <span className={styles.subtitle}>Выбери настроение</span>
        </motion.div>

        <div className={styles.grid}>
          {GENRES.map((genre, i) => (
            <motion.div
              key={genre.slug}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{
                delay: i * 0.08,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <GenreCard genre={genre} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GenreCard({ genre }) {
  return (
    <Link
      to={`/search?genre=${genre.slug}`}
      className={styles.card}
      style={{ "--genre-color": genre.color }}
    >
      {/* Фоновое изображение */}
      <div className={styles.cardBg}>
        <img src={genre.bg} alt="" className={styles.cardBgImg} />
        <div className={styles.cardBgOverlay} />
      </div>

      {/* Японский иероглиф */}
      <span className={styles.cardJp} aria-hidden>
        {genre.jp}
      </span>

      {/* Контент */}
      <div className={styles.cardContent}>
        <h3 className={styles.cardName}>{genre.name}</h3>
        <p className={styles.cardDesc}>{genre.desc}</p>
        <span className={styles.cardArrow}>→</span>
      </div>

      {/* Акцентная линия снизу */}
      <div className={styles.cardAccentLine} />
    </Link>
  );
}
