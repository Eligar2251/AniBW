// src/components/ui/NotificationsPanel.jsx
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  MessageCircle,
  Heart,
  Users,
  BookOpen,
  Trophy,
  X,
  CheckCheck,
} from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import styles from "./NotificationsPanel.module.css";

const TYPE_ICONS = {
  comment: { icon: MessageCircle, color: "#5B9BD5" },
  reply: { icon: MessageCircle, color: "#5B9BD5" },
  like: { icon: Heart, color: "#E8354A" },
  new_follower: { icon: Users, color: "#10B981" },
  new_chapter: { icon: BookOpen, color: "#F0A830" },
  achievement: { icon: Trophy, color: "#F0A830" },
  system: { icon: Bell, color: "#6B7280" },
};

function useNotifications() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, actor:profiles(username, display_name, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export default function NotificationsPanel({ onClose }) {
  const {
    data: notifications = [],
    isLoading,
    error: notificationsError,
  } = useNotifications();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    queryClient.invalidateQueries({ queryKey: ["unread-count", user.id] });
  };

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: invalidateNotifications,
  });

  const markRead = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: invalidateNotifications,
  });

  return (
    <motion.div
      className={styles.panel}
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Шапка */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>Уведомления</h3>
          {unreadCount > 0 && (
            <span className={styles.unreadBadge}>{unreadCount}</span>
          )}
        </div>
        <div className={styles.headerActions}>
          {unreadCount > 0 && (
            <button
              className={styles.markAllBtn}
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              title="Отметить все как прочитанные"
            >
              <CheckCheck size={14} strokeWidth={1.5} />
            </button>
          )}
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Список */}
      <div className={styles.list}>
        {isLoading ? (
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={styles.skeletonItem}>
              <div className={`skeleton ${styles.skeletonIcon}`} />
              <div className={styles.skeletonMeta}>
                <div
                  className="skeleton"
                  style={{ height: 12, width: "80%" }}
                />
                <div
                  className="skeleton"
                  style={{ height: 10, width: "40%" }}
                />
              </div>
            </div>
          ))
        ) : notificationsError ? (
          <div className={styles.empty}>
            <p role="alert">Не удалось загрузить уведомления.</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>鐘</span>
            <p>Уведомлений нет</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <NotifItem
              key={notif.id}
              notif={notif}
              onRead={() => markRead.mutate(notif.id)}
              onClose={onClose}
            />
          ))
        )}
        {(markAllRead.isError || markRead.isError) && (
          <div className={styles.empty}>
            <p role="alert">Не удалось обновить уведомление.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function NotifItem({ notif, onRead, onClose }) {
  const typeInfo = TYPE_ICONS[notif.type] || TYPE_ICONS.system;
  const Icon = typeInfo.icon;
  const navigate = useNavigate();
  const destination = notif.chapter_id && notif.work_id
    ? `/works/${notif.work_id}/read/${notif.chapter_id}`
    : notif.work_id
      ? `/works/${notif.work_id}`
      : notif.actor?.username
        ? `/profile/${notif.actor.username}`
        : null;

  const handleClick = (event) => {
    if (!notif.is_read) onRead();
    onClose?.();
    if (event.target.closest("a")) return;
    if (destination) navigate(destination);
  };

  return (
    <div
      className={`${styles.item} ${!notif.is_read ? styles.itemUnread : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick(event);
        }
      }}
    >
      {/* Иконка */}
      <div
        className={styles.itemIcon}
        style={{ background: typeInfo.color + "20", color: typeInfo.color }}
      >
        <Icon size={16} strokeWidth={1.5} />
      </div>

      {/* Контент */}
      <div className={styles.itemContent}>
        <p className={styles.itemBody}>
          {notif.actor && (
            <Link
              to={`/profile/${notif.actor.username}`}
              className={styles.itemActor}
            >
              {notif.actor.display_name || notif.actor.username}
            </Link>
          )}{" "}
          {notif.body}
        </p>

        <div className={styles.itemMeta}>
          <span className={styles.itemTime}>
            {formatDistanceToNow(new Date(notif.created_at), {
              addSuffix: true,
              locale: ru,
            })}
          </span>
        </div>
      </div>

      {/* Индикатор непрочитанного */}
      {!notif.is_read && <div className={styles.unreadDot} />}
    </div>
  );
}
