// src/pages/HomePage.jsx
import HeroSection from "@components/home/HeroSection";
import HotWorksSection from "@components/home/HotWorksSection";
import RecentUpdatesSection from "@components/home/RecentUpdatesSection";
import GenrePortals from "@components/home/GenrePortals";
import NewAuthorsSection from "@components/home/NewAuthorsSection";
import RandomWorkBtn from "@components/home/RandomWorkBtn";
import styles from "./HomePage.module.css";

export default function HomePage() {
  return (
    <div className={styles.page}>
      <HeroSection />

      <div className={styles.sectionBreak}>
        <span className={styles.breakKanji}>物語</span>
        <div className={styles.breakLine} />
      </div>

      <HotWorksSection />

      <div className={styles.sectionBreak}>
        <span className={styles.breakKanji}>世界</span>
        <div className={styles.breakLine} />
      </div>

      <GenrePortals />

      <div className={styles.sectionBreak}>
        <span className={styles.breakKanji}>更新</span>
        <div className={styles.breakLine} />
      </div>

      <RecentUpdatesSection />

      <div className={styles.sectionBreak}>
        <span className={styles.breakKanji}>作者</span>
        <div className={styles.breakLine} />
      </div>

      <NewAuthorsSection />
      <RandomWorkBtn />
    </div>
  );
}
