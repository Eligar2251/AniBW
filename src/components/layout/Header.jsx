// src/components/layout/Header.jsx
import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  BookOpen,
  PenLine,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { useAuthStore } from "@store/authStore";
import { useUIStore } from "@store/uiStore";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import NotificationsPanel from "@components/ui/NotificationsPanel";
import { useRealtimeNotifications } from "@hooks/useRealtimeNotifications";
import styles from "./Header.module.css";

function useUnreadCount() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["unread-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

export default function Header() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropOpen, setUserDropOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const dropRef = useRef(null);
  const notifRef = useRef(null);

  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const isAuthor = useAuthStore((s) => s.isAuthor);

  const { data: unreadCount = 0 } = useUnreadCount();
  useRealtimeNotifications();

  const openAuthModal = useUIStore((s) => s.openAuthModal);
  const openSearch = useUIStore((s) => s.openSearch);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setUserDropOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUserDropOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: "/works", label: "Читать" },
    { to: "/search", label: "Поиск" },
  ];

  const avatarUrl = getCloudinaryUrl(profile?.avatar_url, transforms.avatarSm);

  return (
    <motion.header
      className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0, 1] }}
    >
      <div className={styles.accentLine} />

      <div className={styles.inner}>
        {/* Логотип */}
        <Link to="/" className={styles.logo}>
          <span className={styles.logoJp}>ア</span>
          <span className={styles.logoText}>AniScript</span>
        </Link>

        {/* Навигация */}
        <nav className={styles.nav}>
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Правая часть */}
        <div className={styles.actions}>
          {/* Поиск */}
          <button
            className={styles.iconBtn}
            onClick={openSearch}
            aria-label="Поиск"
          >
            <Search size={18} strokeWidth={1.5} />
          </button>

          {user ? (
            <>
              {/* Уведомления */}
              <div className={styles.notifWrap} ref={notifRef}>
                <button
                  className={styles.iconBtn}
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="Уведомления"
                >
                  <Bell size={18} strokeWidth={1.5} />
                  {unreadCount > 0 && (
                    <span className={styles.notifDot}>{unreadCount}</span>
                  )}
                </button>

                <AnimatePresence>
                  {notifOpen && (
                    <NotificationsPanel onClose={() => setNotifOpen(false)} />
                  )}
                </AnimatePresence>
              </div>

              {/* Кабинет */}
              {isAuthor() && (
                <Link to="/dashboard" className={styles.dashboardBtn}>
                  <PenLine size={15} strokeWidth={1.5} />
                  <span>Кабинет</span>
                </Link>
              )}

              {/* Аватар + дроп */}
              <div className={styles.userDropWrap} ref={dropRef}>
                <button
                  className={styles.avatarBtn}
                  onClick={() => setUserDropOpen((v) => !v)}
                >
                  <div className={styles.avatarRing}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className={styles.avatar} />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {profile?.display_name?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  <ChevronDown
                    size={14}
                    className={`${styles.chevron} ${userDropOpen ? styles.chevronOpen : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {userDropOpen && (
                    <motion.div
                      className={styles.userDrop}
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className={styles.dropHeader}>
                        <span className={styles.dropName}>
                          {profile?.display_name || profile?.username}
                        </span>
                        <span className={styles.dropUsername}>
                          @{profile?.username}
                        </span>
                      </div>
                      <div className={styles.dropDivider} />
                      <Link
                        to={`/profile/${profile?.username}`}
                        className={styles.dropItem}
                      >
                        <User size={14} /> Профиль
                      </Link>
                      <Link to="/bookmarks" className={styles.dropItem}>
                        <BookOpen size={14} /> Закладки
                      </Link>
                      <Link to="/settings" className={styles.dropItem}>
                        Настройки
                      </Link>
                      {!isAuthor() && (
                        <button
                          className={styles.dropItem}
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from("profiles")
                                .update({ role: "author" })
                                .eq("id", profile.id);

                              if (error) {
                                console.error("Error becoming author:", error);
                                alert("Ошибка: " + error.message);
                                return;
                              }

                              // Обновляем профиль в store
                              await useAuthStore.getState().refreshProfile();
                              window.location.reload();
                            } catch (err) {
                              console.error("Failed to become author:", err);
                              alert("Не удалось стать автором");
                            }
                          }}
                        >
                          Стать автором
                        </button>
                      )}
                      <div className={styles.dropDivider} />
                      <button
                        className={`${styles.dropItem} ${styles.dropItemDanger}`}
                        onClick={signOut}
                      >
                        <LogOut size={14} /> Выйти
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className={styles.authButtons}>
              <button
                className={styles.loginBtn}
                onClick={() => openAuthModal("login")}
              >
                Войти
              </button>
              <button
                className={styles.registerBtn}
                onClick={() => openAuthModal("register")}
              >
                Регистрация
              </button>
            </div>
          )}

          {/* Бургер */}
          <button
            className={styles.burgerBtn}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Мобильная навигация */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className={styles.mobileNav}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {navLinks.map((link, i) => (
              <motion.div
                key={link.to}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <NavLink to={link.to} className={styles.mobileNavLink}>
                  {link.label}
                </NavLink>
              </motion.div>
            ))}
            {user && isAuthor() && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: navLinks.length * 0.06 }}
              >
                <Link to="/dashboard" className={styles.mobileNavLink}>
                  Кабинет автора
                </Link>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
