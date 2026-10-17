// src/components/works/WorkComments.jsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Heart, Flag, ChevronDown } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { useUIStore } from "@store/uiStore";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import styles from "./WorkComments.module.css";

function useComments(workId) {
  return useQuery({
    queryKey: ["work-comments", workId],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select(
          `
          *,
          author:profiles(id, username, display_name, avatar_url)
        `,
        )
        .eq("work_id", workId)
        .is("chapter_id", null)
        .is("parent_id", null)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!workId,
  });
}

export default function WorkComments({ workId }) {
  const [sort, setSort] = useState("new");
  const { data: comments = [], isLoading } = useComments(workId);
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useUIStore((s) => s.openAuthModal);
  const [text, setText] = useState("");
  const queryClient = useQueryClient();

  const addComment = useMutation({
    mutationFn: async (content) => {
      const { error } = await supabase.from("comments").insert({
        work_id: workId,
        author_id: user.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["work-comments", workId] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!user) {
      openAuthModal("login");
      return;
    }
    if (!text.trim()) return;
    addComment.mutate(text.trim());
  };

  return (
    <div className={styles.wrap}>
      {/* Форма */}
      <div className={styles.formWrap}>
        <div className={styles.formAvatar}>
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className={styles.formAvatarImg}
            />
          ) : (
            <div className={styles.formAvatarPlaceholder}>
              {user ? user.email?.[0]?.toUpperCase() : "?"}
            </div>
          )}
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <textarea
            className={styles.textarea}
            placeholder={
              user ? "Напиши комментарий..." : "Войди чтобы комментировать"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            onClick={() => {
              if (!user) openAuthModal("login");
            }}
            readOnly={!user}
          />
          {text.trim() && user && (
            <motion.div
              className={styles.formActions}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setText("")}
              >
                Отмена
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={addComment.isPending}
              >
                {addComment.isPending ? "Отправляю..." : "Отправить"}
              </button>
            </motion.div>
          )}
        </form>
      </div>

      {/* Сортировка */}
      <div className={styles.sortRow}>
        <span className={styles.count}>
          <MessageCircle size={14} strokeWidth={1.5} />
          {comments.length} комментариев
        </span>
        <div className={styles.sortBtns}>
          {[
            { id: "new", label: "Новые" },
            { id: "top", label: "Топ" },
          ].map((s) => (
            <button
              key={s.id}
              className={`${styles.sortBtn} ${sort === s.id ? styles.sortBtnActive : ""}`}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Список */}
      <div className={styles.list}>
        {isLoading ? (
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={styles.skeletonComment}>
              <div className={`skeleton ${styles.skeletonAvatar}`} />
              <div className={styles.skeletonBody}>
                <div
                  className="skeleton"
                  style={{ height: 12, width: "30%" }}
                />
                <div
                  className="skeleton"
                  style={{ height: 14, width: "90%" }}
                />
                <div
                  className="skeleton"
                  style={{ height: 14, width: "70%" }}
                />
              </div>
            </div>
          ))
        ) : comments.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>言</span>
            <p>Комментариев пока нет. Будь первым!</p>
          </div>
        ) : (
          comments.map((comment, i) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              index={i}
              workId={workId}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CommentItem({ comment, index, workId }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useUIStore((s) => s.openAuthModal);
  const queryClient = useQueryClient();

  const avatarUrl = getCloudinaryUrl(
    comment.author?.avatar_url,
    transforms.avatarSm,
  );

  const addReply = useMutation({
    mutationFn: async (content) => {
      await supabase.from("comments").insert({
        work_id: workId,
        author_id: user.id,
        content,
        parent_id: comment.id,
      });
    },
    onSuccess: () => {
      setReplyText("");
      setReplyOpen(false);
      queryClient.invalidateQueries({ queryKey: ["work-comments", workId] });
    },
  });

  return (
    <motion.div
      className={styles.comment}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.5 }}
    >
      {/* Аватар */}
      <div className={styles.commentAvatar}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className={styles.commentAvatarImg} />
        ) : (
          <div className={styles.commentAvatarPlaceholder}>
            {comment.author?.display_name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </div>

      <div className={styles.commentBody}>
        {/* Шапка */}
        <div className={styles.commentHeader}>
          <span className={styles.commentAuthor}>
            {comment.author?.display_name || comment.author?.username}
          </span>
          <span className={styles.commentTime}>
            {formatDistanceToNow(new Date(comment.created_at), {
              addSuffix: true,
              locale: ru,
            })}
          </span>
          {comment.is_pinned && (
            <span className={styles.pinnedBadge}>Закреплено</span>
          )}
        </div>

        {/* Текст */}
        {comment.quoted_text && (
          <blockquote className={styles.quote}>
            {comment.quoted_text}
          </blockquote>
        )}
        <p className={styles.commentText}>{comment.content}</p>

        {/* Действия */}
        <div className={styles.commentActions}>
          <button className={styles.actionBtn}>
            <Heart size={13} strokeWidth={1.5} />
            <span>{comment.likes_count || 0}</span>
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => {
              if (!user) {
                openAuthModal("login");
                return;
              }
              setReplyOpen((v) => !v);
            }}
          >
            <MessageCircle size={13} strokeWidth={1.5} />
            Ответить
          </button>
          {comment.replies_count > 0 && (
            <button
              className={styles.actionBtn}
              onClick={() => setShowReplies((v) => !v)}
            >
              <ChevronDown
                size={13}
                style={{
                  transform: showReplies ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
              {comment.replies_count} ответов
            </button>
          )}
          <button className={`${styles.actionBtn} ${styles.reportBtn}`}>
            <Flag size={12} strokeWidth={1.5} />
          </button>
        </div>

        {/* Форма ответа */}
        <AnimatePresence>
          {replyOpen && (
            <motion.div
              className={styles.replyForm}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <textarea
                className={styles.replyTextarea}
                placeholder="Ответить..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
              />
              <div className={styles.replyActions}>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setReplyOpen(false)}
                  type="button"
                >
                  Отмена
                </button>
                <button
                  className={styles.submitBtn}
                  onClick={() =>
                    replyText.trim() && addReply.mutate(replyText.trim())
                  }
                  disabled={!replyText.trim() || addReply.isPending}
                  type="button"
                >
                  Ответить
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
