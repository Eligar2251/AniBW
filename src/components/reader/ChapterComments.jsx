// src/components/reader/ChapterComments.jsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Heart, ChevronDown, Flag } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useCommentLike } from "@hooks/useCommentLike";
import { useRealtimeComments } from "@hooks/useRealtimeComments";
import { useAuthStore } from "@store/authStore";
import { useUIStore } from "@store/uiStore";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import styles from "./ChapterComments.module.css";

function useChapterComments(chapterId) {
  return useQuery({
    queryKey: ["chapter-comments", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, author:profiles(id, username, display_name, avatar_url)")
        .eq("chapter_id", chapterId)
        .is("parent_id", null)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!chapterId,
  });
}

function useChapterReplies(chapterId, parentId, enabled) {
  return useQuery({
    queryKey: ["chapter-comment-replies", chapterId, parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, author:profiles(id, username, display_name, avatar_url)")
        .eq("chapter_id", chapterId)
        .eq("parent_id", parentId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!enabled && !!chapterId && !!parentId,
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

function formatCommentTime(createdAt) {
  return formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: ru,
  });
}

export default function ChapterComments({ chapterId, workId }) {
  const [text, setText] = useState("");
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useUIStore((state) => state.openAuthModal);
  const queryClient = useQueryClient();
  const { data: comments = [], isLoading, error } = useChapterComments(chapterId);
  useRealtimeComments(chapterId);

  const addComment = useMutation({
    mutationFn: async (content) => {
      const { error: insertError } = await supabase.from("comments").insert({
        chapter_id: chapterId,
        work_id: workId,
        author_id: user.id,
        content,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["chapter-comments", chapterId] });
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
      <div className={styles.header}>
        <h3 className={styles.title}>
          <MessageCircle size={18} strokeWidth={1.5} />
          Комментарии к главе
          <span className={styles.count}>{comments.length}</span>
        </h3>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          className={styles.textarea}
          placeholder={
            user
              ? "Поделись впечатлением о главе..."
              : "Войди чтобы оставить комментарий"
          }
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          onClick={() => {
            if (!user) openAuthModal("login");
          }}
          readOnly={!user}
        />
        <AnimatePresence>
          {text.trim() && user && (
            <motion.div
              className={styles.formFooter}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setText("")}
              >
                Очистить
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
        </AnimatePresence>
        {addComment.isError && (
          <p className={styles.commentText} role="alert">
            Не удалось отправить комментарий. Попробуйте ещё раз.
          </p>
        )}
      </form>

      <div className={styles.list}>
        {isLoading ? (
          Array.from({ length: 2 }, (_, index) => (
            <div key={index} className={styles.skeleton}>
              <div className={`skeleton ${styles.skeletonAvatar}`} />
              <div className={styles.skeletonBody}>
                <div className="skeleton" style={{ height: 12, width: "25%" }} />
                <div className="skeleton" style={{ height: 14, width: "80%" }} />
              </div>
            </div>
          ))
        ) : error ? (
          <div className={styles.empty}>
            <p role="alert">Не удалось загрузить комментарии.</p>
          </div>
        ) : (
          comments.map((comment, index) => (
            <ChapterCommentItem
              key={comment.id}
              comment={comment}
              index={index}
              chapterId={chapterId}
              workId={workId}
            />
          ))
        )}

        {!isLoading && !error && comments.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>言</span>
            <p>Комментариев пока нет</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChapterCommentItem({ comment, index, chapterId, workId }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useUIStore((state) => state.openAuthModal);
  const queryClient = useQueryClient();
  const { data: replies = [], isLoading, error } = useChapterReplies(
    chapterId,
    comment.id,
    showReplies,
  );
  const like = useCommentLike(comment.id, ["chapter-comments", chapterId]);
  const report = useReportComment(comment.id);

  const addReply = useMutation({
    mutationFn: async (content) => {
      const { error: insertError } = await supabase.from("comments").insert({
        chapter_id: chapterId,
        work_id: workId,
        author_id: user.id,
        content,
        parent_id: comment.id,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      setReplyText("");
      setReplyOpen(false);
      setShowReplies(true);
      queryClient.invalidateQueries({ queryKey: ["chapter-comments", chapterId] });
      queryClient.invalidateQueries({
        queryKey: ["chapter-comment-replies", chapterId, comment.id],
      });
    },
  });

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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <div className={styles.commentAvatar}>
        {comment.author?.avatar_url ? (
          <img
            src={getCloudinaryUrl(comment.author.avatar_url, transforms.avatarSm)}
            alt=""
            className={styles.commentAvatarImg}
          />
        ) : (
          <div className={styles.commentAvatarPlaceholder}>
            {comment.author?.display_name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </div>
      <div className={styles.commentBody}>
        <div className={styles.commentMeta}>
          <span className={styles.commentAuthor}>
            {comment.author?.display_name || comment.author?.username}
          </span>
          <span className={styles.commentTime}>
            {formatCommentTime(comment.created_at)}
          </span>
        </div>
        {comment.quoted_text && (
          <blockquote className={styles.quote}>«{comment.quoted_text}»</blockquote>
        )}
        <p className={styles.commentText}>{comment.content}</p>
        <div className={styles.commentActions}>
          <button
            type="button"
            className={styles.likeBtn}
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
            <Heart size={12} strokeWidth={1.5} />
            {comment.likes_count || 0}
          </button>
          <button
            type="button"
            className={styles.replyCount}
            onClick={() => {
              if (!user) {
                openAuthModal("login");
                return;
              }
              setReplyOpen((value) => !value);
            }}
          >
            Ответить
          </button>
          {(comment.replies_count > 0 || showReplies) && (
            <button
              type="button"
              className={styles.replyCount}
              onClick={() => setShowReplies((value) => !value)}
            >
              <ChevronDown
                size={12}
                style={{ transform: showReplies ? "rotate(180deg)" : "none" }}
              />
              {comment.replies_count || replies.length} ответов
            </button>
          )}
          <button
            type="button"
            className={styles.replyCount}
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
              className={styles.form}
              style={{ overflow: "hidden" }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <textarea
                className={styles.textarea}
                placeholder="Ответить..."
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                rows={2}
              />
              <div className={styles.formFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setReplyOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className={styles.submitBtn}
                  disabled={!replyText.trim() || addReply.isPending}
                  onClick={() => replyText.trim() && addReply.mutate(replyText.trim())}
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
              style={{ overflow: "hidden" }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {isLoading ? (
                <div className={styles.skeleton}>
                  <div className={`skeleton ${styles.skeletonAvatar}`} />
                  <div className={styles.skeletonBody}>
                    <div className="skeleton" style={{ height: 12, width: "30%" }} />
                    <div className="skeleton" style={{ height: 14, width: "70%" }} />
                  </div>
                </div>
              ) : error ? (
                <p className={styles.commentText} role="alert">
                  Не удалось загрузить ответы.
                </p>
              ) : (
                replies.map((reply) => (
                  <ChapterReply
                    key={reply.id}
                    reply={reply}
                    chapterId={chapterId}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ChapterReply({ reply, chapterId }) {
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useUIStore((state) => state.openAuthModal);
  const [reportSent, setReportSent] = useState(false);
  const like = useCommentLike(reply.id, ["chapter-comments", chapterId]);
  const report = useReportComment(reply.id);

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
    <div className={styles.comment} style={{ marginLeft: 28 }}>
      <div className={styles.commentAvatar}>
        {reply.author?.avatar_url ? (
          <img
            src={getCloudinaryUrl(reply.author.avatar_url, transforms.avatarSm)}
            alt=""
            className={styles.commentAvatarImg}
          />
        ) : (
          <div className={styles.commentAvatarPlaceholder}>
            {reply.author?.display_name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </div>
      <div className={styles.commentBody}>
        <div className={styles.commentMeta}>
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
            className={styles.likeBtn}
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
            <Heart size={12} strokeWidth={1.5} />
            {reply.likes_count || 0}
          </button>
          <button
            type="button"
            className={styles.replyCount}
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
