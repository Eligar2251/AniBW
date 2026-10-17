// src/components/reader/ChapterComments.jsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Heart } from "lucide-react";
import { supabase } from "@lib/supabase";
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
      const { data } = await supabase
        .from("comments")
        .select(
          `
          *,
          author:profiles(id, username, display_name, avatar_url)
        `,
        )
        .eq("chapter_id", chapterId)
        .is("parent_id", null)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!chapterId,
  });
}

export default function ChapterComments({ chapterId, workId }) {
  const [text, setText] = useState("");
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useUIStore((s) => s.openAuthModal);
  const queryClient = useQueryClient();
  const { data: comments = [], isLoading } = useChapterComments(chapterId);

  const addComment = useMutation({
    mutationFn: async (content) => {
      const { error } = await supabase.from("comments").insert({
        chapter_id: chapterId,
        work_id: workId,
        author_id: user.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({
        queryKey: ["chapter-comments", chapterId],
      });
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
      <div className={styles.header}>
        <h3 className={styles.title}>
          <MessageCircle size={18} strokeWidth={1.5} />
          Комментарии к главе
          <span className={styles.count}>{comments.length}</span>
        </h3>
      </div>

      {/* Форма */}
      <form className={styles.form} onSubmit={handleSubmit}>
        <textarea
          className={styles.textarea}
          placeholder={
            user
              ? "Поделись впечатлением о главе..."
              : "Войди чтобы оставить комментарий"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
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
      </form>

      {/* Список */}
      <div className={styles.list}>
        {isLoading
          ? Array.from({ length: 2 }, (_, i) => (
              <div key={i} className={styles.skeleton}>
                <div className={`skeleton ${styles.skeletonAvatar}`} />
                <div className={styles.skeletonBody}>
                  <div
                    className="skeleton"
                    style={{ height: 12, width: "25%" }}
                  />
                  <div
                    className="skeleton"
                    style={{ height: 14, width: "80%" }}
                  />
                </div>
              </div>
            ))
          : comments.map((comment, i) => (
              <motion.div
                key={comment.id}
                className={styles.comment}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className={styles.commentAvatar}>
                  {comment.author?.avatar_url ? (
                    <img
                      src={getCloudinaryUrl(
                        comment.author.avatar_url,
                        transforms.avatarSm,
                      )}
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
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </span>
                  </div>
                  {comment.quoted_text && (
                    <blockquote className={styles.quote}>
                      «{comment.quoted_text}»
                    </blockquote>
                  )}
                  <p className={styles.commentText}>{comment.content}</p>
                  <div className={styles.commentActions}>
                    <button className={styles.likeBtn}>
                      <Heart size={12} strokeWidth={1.5} />
                      {comment.likes_count || 0}
                    </button>
                    <span className={styles.replyCount}>
                      {comment.replies_count > 0 &&
                        `${comment.replies_count} ответов`}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}

        {!isLoading && comments.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyKanji}>言</span>
            <p>Комментариев пока нет</p>
          </div>
        )}
      </div>
    </div>
  );
}
