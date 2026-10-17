// src/components/layout/Footer.jsx
import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.brandKanji}>ア</span>
          <div>
            <span className={styles.brandName}>AniScript</span>
            <p className={styles.brandSub}>Платформа аниме-фанфиков</p>
          </div>
        </div>

        <nav className={styles.links}>
          <div className={styles.linkGroup}>
            <span className={styles.linkGroupLabel}>Читать</span>
            <Link to="/works" className={styles.link}>
              Каталог
            </Link>
            <Link to="/search" className={styles.link}>
              Поиск
            </Link>
          </div>
          <div className={styles.linkGroup}>
            <span className={styles.linkGroupLabel}>Создавать</span>
            <Link to="/dashboard" className={styles.link}>
              Кабинет автора
            </Link>
            <Link to="/dashboard/works/new" className={styles.link}>
              Новое произведение
            </Link>
          </div>
          <div className={styles.linkGroup}>
            <span className={styles.linkGroupLabel}>О проекте</span>
            <Link to="/about" className={styles.link}>
              О нас
            </Link>
            <Link to="/rules" className={styles.link}>
              Правила
            </Link>
          </div>
        </nav>
      </div>

      <div className={styles.bottom}>
        <span className={styles.copy}>© 2024 AniScript</span>
        <span className={styles.bottomKanji} aria-hidden>
          物語は続く
        </span>
      </div>
    </footer>
  );
}
