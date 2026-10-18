// src/pages/dashboard/DashboardHome.jsx
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  BookOpen,
  Users,
  PenLine,
  Plus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import styles from "./DashboardHome.module.css";

function useDashboardData() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: async () => {
      const [worksRes, statsRes, activityRes] = await Promise.all([
        supabase
          .from("works")
          .select(
            "id, title, cover_url, status, views_count, likes_count, chapters_count, updated_at",
          )
          .eq("author_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase.rpc("get_author_stats", {
          p_author_id: user.id,
          p_period: "month",
        }),
        supabase.rpc("get_author_activity", {
          p_author_id: user.id,
          p_days: 14,
        }),
      ]);

      if (worksRes.error) throw worksRes.error;
      if (statsRes.error) throw statsRes.error;
      if (activityRes.error) throw activityRes.error;

      return {
        works: worksRes.data || [],
        stats: statsRes.data?.[0] || {},
        activity: (activityRes.data || []).map((day) => ({
          date: format(new Date(`${day.activity_date}T00:00:00`), "d MMM", {
            locale: ru,
          }),
          views: Number(day.views) || 0,
          likes: Number(day.likes) || 0,
        })),
      };
    },
    enabled: !!user,
  });
}

export default function DashboardHome() {
  const profile = useAuthStore((s) => s.profile);
  const { data, isLoading, error } = useDashboardData();

  const stats = data?.stats || {};
  const works = data?.works || [];
  const chartData = data?.activity || [];

  const STAT_CARDS = [
    {
      icon: Eye,
      label: "Просмотры",
      value: stats.total_views,
      color: "#5B9BD5",
    },
    { icon: Heart, label: "Лайки", value: stats.total_likes, color: "#E8354A" },
    {
      icon: MessageCircle,
      label: "Комментарии",
      value: stats.total_comments,
      color: "#F0A830",
    },
    {
      icon: Users,
      label: "Подписчики",
      value: stats.total_followers,
      color: "#10B981",
    },
  ];

  return (
    <div className={styles.page}>
      {/* ── Верхняя полоса: приветствие + быстрые кнопки ── */}
      <motion.div
        className={styles.topRow}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={styles.welcomeText}>
          <span className={styles.welcomeKanji} aria-hidden>
            創
          </span>
          <div>
            <h1 className={styles.welcomeTitle}>
              Привет, <em>{profile?.display_name || profile?.username}</em>
            </h1>
            <p className={styles.welcomeSub}>Что создаём сегодня?</p>
          </div>
        </div>

        <div className={styles.quickActions}>
          <Link to="/dashboard/works/new" className={styles.quickBtn}>
            <Plus size={15} strokeWidth={1.5} /> Произведение
          </Link>
          <Link to="/dashboard/characters/new" className={styles.quickBtnGhost}>
            <Users size={15} strokeWidth={1.5} /> Персонаж
          </Link>
        </div>
      </motion.div>

      {/* ── Основной контент: стата + график | произведения ── */}
      <div className={styles.mainGrid}>
        {/* Левая колонка */}
        <div className={styles.leftCol}>
          {/* Статистика */}
          <div className={styles.statsRow}>
            {STAT_CARDS.map(({ icon: Icon, label, value, color }, i) => (
              <motion.div
                key={label}
                className={styles.statCard}
                style={{ "--stat-color": color }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
              >
                <div className={styles.statIcon}>
                  <Icon size={18} strokeWidth={1.5} />
                </div>
                <div className={styles.statContent}>
                  <span className={styles.statValue}>
                    {isLoading || error ? "—" : formatNum(value || 0)}
                  </span>
                  <span className={styles.statLabel}>{label}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* График */}
          <motion.div
            className={styles.chartCard}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className={styles.chartHeader}>
              <div>
                <h2 className={styles.chartTitle}>Активность</h2>
                <p className={styles.chartSub}>Просмотры и лайки · 14 дней</p>
              </div>
              <div className={styles.chartLegend}>
                <span
                  className={styles.legendItem}
                  style={{ "--lc": "#5B9BD5" }}
                >
                  Просмотры
                </span>
                <span
                  className={styles.legendItem}
                  style={{ "--lc": "#E8354A" }}
                >
                  Лайки
                </span>
              </div>
            </div>

            {error && (
              <p className={styles.chartSub} role="alert">
                Не удалось загрузить аналитику. Попробуйте обновить страницу.
              </p>
            )}
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 0, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5B9BD5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#5B9BD5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E8354A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E8354A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{
                    fill: "var(--color-text-muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-ui)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: "var(--color-text-muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-ui)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 4,
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    color: "var(--color-text-primary)",
                  }}
                  cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#5B9BD5"
                  strokeWidth={1.5}
                  fill="url(#vGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="likes"
                  stroke="#E8354A"
                  strokeWidth={1.5}
                  fill="url(#lGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Правая колонка — произведения */}
        <motion.div
          className={styles.rightCol}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionKanji}>最</span>
              Произведения
            </h2>
            <Link to="/dashboard/works" className={styles.sectionLink}>
              Все →
            </Link>
          </div>

          <div className={styles.worksList}>
            {works.length === 0 && !isLoading && (
              <div className={styles.emptyWorks}>
                <span className={styles.emptyKanji}>無</span>
                <p>Произведений нет</p>
                <Link to="/dashboard/works/new" className={styles.emptyBtn}>
                  Создать
                </Link>
              </div>
            )}

            {works.map((work, i) => (
              <motion.div
                key={work.id}
                className={styles.workItem}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
              >
                <div className={styles.workCover}>
                  {work.cover_url ? (
                    <img
                      src={getCloudinaryUrl(
                        work.cover_url,
                        transforms.avatarSm,
                      )}
                      alt={work.title}
                      className={styles.workCoverImg}
                    />
                  ) : (
                    <span className={styles.workCoverPlaceholder}>
                      {work.title?.[0]}
                    </span>
                  )}
                </div>

                <div className={styles.workMeta}>
                  <Link
                    to={`/dashboard/works/${work.id}`}
                    className={styles.workTitle}
                  >
                    {work.title}
                  </Link>
                  <div className={styles.workStats}>
                    <span>
                      <Eye size={11} /> {formatNum(work.views_count)}
                    </span>
                    <span>
                      <Heart size={11} /> {work.likes_count}
                    </span>
                    <span>
                      <BookOpen size={11} /> {work.chapters_count} гл.
                    </span>
                  </div>
                </div>

                <span
                  className={`${styles.workStatus} ${styles[`ws-${work.status}`]}`}
                >
                  {work.status === "published"
                    ? "Опубл."
                    : work.status === "draft"
                      ? "Черн."
                      : work.status === "ongoing"
                        ? "В проц."
                        : work.status}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function formatNum(n = 0) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}
