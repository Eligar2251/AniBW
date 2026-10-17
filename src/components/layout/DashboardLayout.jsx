// src/components/layout/DashboardLayout.jsx
import { Outlet, NavLink, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  PenLine,
  ChevronLeft,
  ChevronRight,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@store/authStore";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import styles from "./DashboardLayout.module.css";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Обзор", end: true },
  { to: "/dashboard/works", icon: BookOpen, label: "Произведения" },
  { to: "/dashboard/characters", icon: Users, label: "Персонажи" },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const avatarUrl = getCloudinaryUrl(profile?.avatar_url, transforms.avatarSm);

  return (
    <div className={styles.root}>
      {/* ── Боковая панель ── */}
      <motion.aside
        className={styles.sidebar}
        animate={{ width: collapsed ? 56 : 220 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Логотип */}
        <div className={styles.sidebarLogo}>
          <Link to="/" className={styles.logoMark}>
            <span className={styles.logoKanji}>ア</span>
          </Link>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                className={styles.logoText}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
              >
                AniScript
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Профиль */}
        <div className={styles.sidebarProfile}>
          <div className={styles.profileAvatar}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className={styles.profileImg} />
            ) : (
              <span className={styles.profileInitial}>
                {profile?.display_name?.[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                className={styles.profileInfo}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
              >
                <span className={styles.profileName}>
                  {profile?.display_name || profile?.username}
                </span>
                <span className={styles.profileRole}>Автор</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={styles.sidebarDivider} />

        {/* Навигация */}
        <nav className={styles.sidebarNav}>
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ""}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={1.5} className={styles.navIcon} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    className={styles.navLabel}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.12 }}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        {/* Нижние кнопки */}
        <div className={styles.sidebarBottom}>
          <Link
            to="/settings"
            className={styles.bottomItem}
            title={collapsed ? "Настройки" : undefined}
          >
            <Settings size={16} strokeWidth={1.5} />
            {!collapsed && <span>Настройки</span>}
          </Link>
          <button
            className={styles.bottomItem}
            onClick={signOut}
            title={collapsed ? "Выйти" : undefined}
          >
            <LogOut size={16} strokeWidth={1.5} />
            {!collapsed && <span>Выйти</span>}
          </button>
        </div>

        {/* Кнопка сворачивания */}
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Развернуть" : "Свернуть"}
        >
          {collapsed ? (
            <ChevronRight size={14} strokeWidth={1.5} />
          ) : (
            <ChevronLeft size={14} strokeWidth={1.5} />
          )}
        </button>
      </motion.aside>

      {/* ── Основная область ── */}
      <div className={styles.main} style={{ marginLeft: collapsed ? 56 : 220 }}>
        {/* Топбар */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={styles.topbarKanji} aria-hidden>
              作
            </span>
            <span className={styles.topbarLabel}>Кабинет автора</span>
          </div>
          <div className={styles.topbarRight}>
            <Link to="/dashboard/works/new" className={styles.newWorkBtn}>
              <PenLine size={14} strokeWidth={1.5} />
              Новое произведение
            </Link>
            <button className={styles.topbarIcon}>
              <Bell size={16} strokeWidth={1.5} />
              <span className={styles.notifDot} />
            </button>
          </div>
        </header>

        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
