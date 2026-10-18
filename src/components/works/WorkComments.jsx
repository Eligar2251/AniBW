// src/components/works/WorkComments.jsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Heart, Flag, ChevronDown } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useCommentLike } from "@hooks/useCommentLike";
import { useRealtimeComments } from "@hooks/useRealtimeComments";
import { useAuthStore } from "@store/authStore";
import { useUIStore } from "@store/uiStore";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import styles from "./WorkComments.module.css";

function useComments(workId, sort) {
  return useQuery({
    queryKey: ["work-comments", workId, sort],
    queryFn: async () => {
      let query = supabase
        .from("comments")
        .select("*, author:profiles(id, username, display_name, avatar_url)")
        .eq("work_id", workId)
        .is("chapter_id", null)
        .is("parent_id", null)
        .eq("is_hidden", false);

      query =
        sort === "top"
          ? query.order("likes_count", { ascending: false }).order("created_at", { ascending: false })
          : query.order("created_at", { ascending: false });

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!workId,
  });
}

function useReplies(workId, parentId, enabled) {
  return useQuery({
    queryKey: ["work-comment-replies", workId, parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, author:profiles(id, username, display_name, avatar_url)")
        .eq("work_id", workId)
        .is("chapter_id", null)
        .eq("parent_id", parentId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!enabled && !!workId && !!parentId,
  });
}

function formatCommentTime(createdAt) {
  return formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: ru,
  });
}

function useReportComment(commentId) {
  const user = useAuthStore((state) => state.user);
  return useMutation({
    mutationFn: async (reason) => {
      const { error } = await supabase.from("comment_reports").insert({
        comment_id: commentId,
        reporter_id: user.id,
        reason,
      });
      if (error) throw error;
    },
  });
}

export default function WorkComments({ workId }) {
  const [sort, setSort] = useState("new");
  const [text, setText] = useState("");
  const { data: comments = [], isLoading, error } = useComments(workId, sort);
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useUIStore((state) => state.openAuthModal);
  const queryClient = useQueryClient();
  useRealtimeComments({ workId });

  const addComment = useMutation({
    mutationFn: async (content) => {
      const { error: insertError } = await supabase.from("comments").insert({
        work_id: workId,
        author_id: user.id,
        content,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["work-comments", workId] });
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!user) {
      openAuthModal("login");
      return;
    }
    if (text.trim()) addComment.mutate(text.trim());
  };

  return (
    <div className={styles.wrap}>
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
            onChange={(event) => setText(event.target.value)}
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
          {addComment.isError && (
            <p className={styles.commentText} role="alert">
              Не удалось отправить комментарий. Попробуйте ещё раз.
            </p>
          )}
        </form>
      </div>

      <div className={styles.sortRow}>
        <span className={styles.count}>
          <MessageCircle size={14} strokeWidth={1.5} />
          {comments.length} комментариев
        </span>
        <div className={styles.sortBtns}>
          {[
            { id: "new", label: "Новые" },
            { id: "top", label: "Топ" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              className={`${styles.sortBtn} ${sort === option.id ? styles.sortBtnActive : ""}`}
              onClick={() => setSort(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.list}>
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={styles.skeletonComment}>
              <div className={`skeleton ${styles.skeletonAvatar}`} />
              <div className={styles.skeletonBody}>
                <div className="skeleton" style={{ height: 12, width: "30%" }} />
                <div className="skeleton" style={{ height: 14, width: "90%" }} />
                <div className="skeleton" style={{ height: 14, width: "70%" }} />
              </div>
            </div>
          ))
        ) : error ? (
          <div className={styles.empty}>
            <p role="alert">Не удалось загрузить комментарии.</p>
          </div>
        ) : comments.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>言</span>
            <p>Комментариев пока нет. Будь первым!</p>
          </div>
        ) : (
          comments.map((comment, index) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              index={index}
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
  const [reportSent, setReportSent] = useState(false);
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useUIStore((state) => state.openAuthModal);
  const queryClient = useQueryClient();
  const { data: replies = [], isLoading: repliesLoading, error: repliesError } =
    useReplies(workId, comment.id, showReplies);
  const like = useCommentLike(comment.id, ["work-comments", workId]);
  const report = useReportComment(comment.id);
  const avatarUrl = getCloudinaryUrl(comment.author?.avatar_url, transforms.avatarSm);

  const addReply = useMutation({
    mutationFn: async (content) => {
      const { error } = await supabase.from("comments").insert({
        work_id: workId,
        author_id: user.id,
        content,
        parent_id: comment.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReplyText("");
      setReplyOpen(false);
      setShowReplies(true);
      queryClient.invalidateQueries({ queryKey: ["work-comments", workId] });
      queryClient.invalidateQueries({
        queryKey: ["work-comment-replies", workId, comment.id],
      });
    },
  });

  const handleLike = () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    like.mutate();
  };

  const handleReport = () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    const reason = window.prompt("Укажите причину жалобы:");
    if (reason?.trim()) {
      report.mutate(reason.trim(), {
        onSuccess: () => setReportSent(true),
      });
    }
  };

  return (
    <motion.div
      className={styles.comment}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.5 }}
    >
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
        <div className={styles.commentHeader}>
          <span className={styles.commentAuthor}>
            {comment.author?.display_name || comment.author?.username}
          </span>
          <span className={styles.commentTime}>
            {formatCommentTime(comment.created_at)}
          </span>
          {comment.is_pinned && (
            <span className={styles.pinnedBadge}>Закреплено</span>
          )}
        </div>

        {comment.quoted_text && (
          <blockquote className={styles.quote}>{comment.quoted_text}</blockquote>
        )}
        <p className={styles.commentText}>{comment.content}</p>

        <div className={styles.commentActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleLike}
            disabled={like.isPending}
            aria-label="Нравится"
          >
            <Heart size={13} strokeWidth={1.5} />
            <span>{comment.likes_count || 0}</span>
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              if (!user) {
                openAuthModal("login");
                return;
              }
              setReplyOpen((value) => !value);
            }}
          >
            <MessageCircle size={13} strokeWidth={1.5} />
            Ответить
          </button>
          {(comment.replies_count > 0 || showReplies) && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setShowReplies((value) => !value)}
            >
              <ChevronDown
                size={13}
                style={{
                  transform: showReplies ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
              {comment.replies_count || replies.length} ответов
            </button>
          )}
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.reportBtn}`}
            onClick={handleReport}
            disabled={report.isPending || reportSent}
            title={reportSent ? "Жалоба отправлена" : "Пожаловаться"}
            aria-label="Пожаловаться"
          >
            <Flag size={12} strokeWidth={1.5} />
          </button>
        </div>

        {report.isError && (
          <p className={styles.commentText} role="alert">
            Не удалось отправить жалобу. Попробуйте ещё раз.
          </p>
        )}

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
                onChange={(event) => setReplyText(event.target.value)}
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
                  {addReply.isPending ? "Отправляю..." : "Ответить"}
                </button>
              </div>
              {addReply.isError && (
                <p className={styles.commentText} role="alert">
                  Не удалось отправить ответ. Попробуйте ещё раз.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showReplies && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {repliesLoading ? (
                <div className={styles.skeletonComment}>
                  <div className={`skeleton ${styles.skeletonAvatar}`} />
                  <div className={styles.skeletonBody}>
                    <div className="skeleton" style={{ height: 12, width: "35%" }} />
                    <div className="skeleton" style={{ height: 14, width: "70%" }} />
                  </div>
                </div>
              ) : repliesError ? (
                <p className={styles.commentText} role="alert">
                  Не удалось загрузить ответы.
                </p>
              ) : (
                replies.map((reply) => (
                  <ReplyItem key={reply.id} reply={reply} workId={workId} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ReplyItem({ reply, workId }) {
  const [reportSent, setReportSent] = useState(false);
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useUIStore((state) => state.openAuthModal);
  const like = useCommentLike(reply.id, ["work-comments", workId]);
  const report = useReportComment(reply.id);
  const avatarUrl = getCloudinaryUrl(reply.author?.avatar_url, transforms.avatarSm);

  const handleReport = () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    const reason = window.prompt("Укажите причину жалобы:");
    if (reason?.trim()) {
      report.mutate(reason.trim(), {
        onSuccess: () => setReportSent(true),
      });
    }
  };

  return (
    <div className={styles.comment} style={{ marginLeft: 36 }}>
      <div className={styles.commentAvatar}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className={styles.commentAvatarImg} />
        ) : (
          <div className={styles.commentAvatarPlaceholder}>
            {reply.author?.display_name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </div>
      <div className={styles.commentBody}>
        <div className={styles.commentHeader}>
          <span className={styles.commentAuthor}>
            {reply.author?.display_name || reply.author?.username}
          </span>
          <span className={styles.commentTime}>
            {formatCommentTime(reply.created_at)}
          </span>
        </div>
        <p className={styles.commentText}>{reply.content}</p>
        <div className={styles.commentActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              if (!user) {
                openAuthModal("login");
                return;
              }
              like.mutate();
            }}
            disabled={like.isPending}
            aria-label="Нравится"
          >
            <Heart size={13} strokeWidth={1.5} />
            <span>{reply.likes_count || 0}</span>
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.reportBtn}`}
            onClick={handleReport}
            disabled={report.isPending || reportSent}
            title={reportSent ? "Жалоба отправлена" : "Пожаловаться"}
            aria-label="Пожаловаться"
          >
            <Flag size={12} strokeWidth={1.5} />
          </button>
        </div>
        {report.isError && (
          <p className={styles.commentText} role="alert">
            Не удалось отправить жалобу. Попробуйте ещё раз.
          </p>
        )}
      </div>
    </div>
  );
}
