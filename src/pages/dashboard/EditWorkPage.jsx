// src/pages/dashboard/EditWorkPage.jsx
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, GripVertical, Trash2, Eye, PenLine, Copy } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import styles from "./EditWorkPage.module.css";

function useWork(id) {
  return useQuery({
    queryKey: ["dashboard-work", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

function useWorkChapters(workId) {
  return useQuery({
    queryKey: ["work-chapters-dashboard", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select(
          "id, title, chapter_number, status, words_count, published_at, scheduled_at",
        )
        .eq("work_id", workId)
        .order("chapter_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!workId,
  });
}

export default function EditWorkPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const {
    data: work,
    isLoading: workLoading,
    error: workError,
  } = useWork(id);
  const {
    data: chapters,
    isLoading: chaptersLoading,
    error: chaptersError,
  } = useWorkChapters(id);

  const [activeTab, setActiveTab] = useState("info");

  const createChapter = useMutation({
    mutationFn: async () => {
      const { data: lastChapter, error: lastChapterError } = await supabase
        .from("chapters")
        .select("chapter_number")
        .eq("work_id", id)
        .order("chapter_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastChapterError) throw lastChapterError;

      const nextNum = (lastChapter?.chapter_number || 0) + 1;
      const { data, error } = await supabase
        .from("chapters")
        .insert({
          work_id: id,
          author_id: user.id,
          title: `Глава ${nextNum}`,
          chapter_number: nextNum,
          status: "draft",
          content: "",
          words_count: 0,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (chapter) => {
      queryClient.invalidateQueries({
        queryKey: ["work-chapters-dashboard", id],
      });
      navigate(`/dashboard/works/${id}/chapters/${chapter.id}`);
    },
  });

  const duplicateChapter = useMutation({
    mutationFn: async (chapterId) => {
      const { data: source, error: sourceError } = await supabase
        .from("chapters")
        .select("title, content, content_text, words_count, author_note_before, author_note_after")
        .eq("id", chapterId)
        .eq("work_id", id)
        .single();
      if (sourceError) throw sourceError;

      const { data: lastChapter, error: lastChapterError } = await supabase
        .from("chapters")
        .select("chapter_number")
        .eq("work_id", id)
        .order("chapter_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastChapterError) throw lastChapterError;

      const chapterNumber = (lastChapter?.chapter_number || 0) + 1;
      const { data, error } = await supabase
        .from("chapters")
        .insert({
          work_id: id,
          author_id: user.id,
          chapter_number: chapterNumber,
          title: `${source.title} — копия`.slice(0, 200),
          content: source.content,
          content_text: source.content_text,
          words_count: source.words_count,
          author_note_before: source.author_note_before,
          author_note_after: source.author_note_after,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (chapter) => {
      queryClient.invalidateQueries({
        queryKey: ["work-chapters-dashboard", id],
      });
      navigate(`/dashboard/works/${id}/chapters/${chapter.id}`);
    },
  });

  const deleteChapter = useMutation({
    mutationFn: async (chapterId) => {
      const { error } = await supabase
        .from("chapters")
        .delete()
        .eq("id", chapterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["work-chapters-dashboard", id],
      });
    },
  });

  if (workLoading)
    return (
      <div className={styles.page}>
        <div
          className="skeleton"
          style={{ height: 40, width: 300, borderRadius: 4 }}
        />
      </div>
    );

  if (workError || !work) {
    return (
      <div className={styles.page}>
        <p role="alert">Произведение не найдено или у вас нет доступа.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={styles.headerMeta}>
          <span className={styles.headerKanji} aria-hidden>
            編
          </span>
          <div>
            <h1 className={styles.title}>{work?.title}</h1>
            <span className={styles.subtitle}>Редактирование произведения</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <a
            href={`/works/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.previewBtn}
          >
            <Eye size={14} strokeWidth={1.5} />
            Просмотр
          </a>
          <button
            className={styles.newChapterBtn}
            onClick={() => createChapter.mutate()}
            disabled={createChapter.isPending || chaptersLoading}
          >
            <Plus size={14} strokeWidth={1.5} />
            {createChapter.isPending ? "Создаю..." : "Новая глава"}
          </button>
        </div>
      </motion.div>

      {(createChapter.isError || duplicateChapter.isError || deleteChapter.isError) && (
        <p role="alert">
          {createChapter.error?.message ||
            duplicateChapter.error?.message ||
            deleteChapter.error?.message ||
            "Не удалось выполнить действие."}
        </p>
      )}

      {/* Табы */}
      <div className={styles.tabs}>
        {[
          { id: "info", label: "Информация" },
          { id: "chapters", label: `Главы (${chapters?.length || 0})` },
          { id: "board", label: "Доска мира" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Контент таба */}
      {activeTab === "info" && <WorkInfoForm work={work} workId={id} />}

      {activeTab === "chapters" && (
        <div className={styles.chaptersList}>
          {chaptersLoading ? (
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={`skeleton ${styles.skeletonChapter}`} />
            ))
          ) : chaptersError ? (
            <p role="alert">Не удалось загрузить список глав.</p>
          ) : chapters?.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyKanji}>空</span>
              <p>Глав пока нет</p>
              <button
                className={styles.emptyBtn}
                onClick={() => createChapter.mutate()}
                disabled={createChapter.isPending || chaptersLoading}
              >
                Создать первую главу
              </button>
            </div>
          ) : (
            chapters?.map((ch, i) => (
              <motion.div
                key={ch.id}
                className={styles.chapterItem}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <span className={styles.chapterDrag}>
                  <GripVertical size={16} strokeWidth={1.5} />
                </span>
                <span className={styles.chapterNum}>
                  {String(ch.chapter_number).padStart(2, "0")}
                </span>
                <div className={styles.chapterMeta}>
                  <span className={styles.chapterTitle}>{ch.title}</span>
                  <div className={styles.chapterStats}>
                    <span
                      className={`${styles.chapterStatus} ${styles[`cs-${ch.status}`]}`}
                    >
                      {ch.status === "published"
                        ? "Опубл."
                        : ch.status === "draft"
                          ? "Черновик"
                          : ch.status === "scheduled"
                            ? "Запланир."
                            : ch.status}
                    </span>
                    <span className={styles.chapterWords}>
                      {(ch.words_count || 0).toLocaleString()} сл.
                    </span>
                  </div>
                </div>
                <div className={styles.chapterActions}>
                  <button
                    className={styles.chapterBtn}
                    onClick={() =>
                      navigate(`/dashboard/works/${id}/chapters/${ch.id}`)
                    }
                    title="Редактировать"
                  >
                    <PenLine size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    className={styles.chapterBtn}
                    title="Дублировать"
                    onClick={() => duplicateChapter.mutate(ch.id)}
                    disabled={duplicateChapter.isPending}
                  >
                    <Copy size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    className={`${styles.chapterBtn} ${styles.chapterBtnDanger}`}
                    onClick={() => {
                      if (confirm(`Удалить главу "${ch.title}"?`)) {
                        deleteChapter.mutate(ch.id);
                      }
                    }}
                    title="Удалить"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {activeTab === "board" && (
        <div className={styles.boardLink}>
          <span className={styles.boardKanji} aria-hidden>
            図
          </span>
          <h3 className={styles.boardTitle}>Доска мира</h3>
          <p className={styles.boardSub}>
            Таймлайн, карта мира, заметки, граф персонажей
          </p>
          <button
            className={styles.newChapterBtn}
            onClick={() => navigate(`/dashboard/board/${id}`)}
          >
            Открыть доску
          </button>
        </div>
      )}
    </div>
  );
}

function WorkInfoForm({ work, workId }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: work?.title || "",
    summary: work?.summary || "",
    description: work?.description || "",
    status: work?.status || "draft",
    visibility: work?.visibility || "draft",
    rating: work?.rating || "PG",
  });
  const [saved, setSaved] = useState(false);

  const updateWork = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("works")
        .update({
          ...form,
          title: form.title.trim(),
          summary: form.summary.trim() || null,
          description: form.description.trim() || null,
        })
        .eq("id", workId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["dashboard-work", workId] });
      queryClient.invalidateQueries({ queryKey: ["work", workId] });
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["infinite-works"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["search-results"] });
      queryClient.invalidateQueries({ queryKey: ["hot-works"] });
      queryClient.invalidateQueries({ queryKey: ["recent-updates"] });
      queryClient.invalidateQueries({ queryKey: ["hero-covers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <form
      className={styles.infoForm}
      onSubmit={(e) => {
        e.preventDefault();
        updateWork.mutate();
      }}
    >
      <div className={styles.infoField}>
        <label className={styles.infoLabel}>Название</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          className={styles.infoInput}
        />
      </div>
      <div className={styles.infoField}>
        <label className={styles.infoLabel}>Краткая аннотация</label>
        <textarea
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          className={styles.infoTextarea}
          rows={3}
        />
      </div>
      <div className={styles.infoField}>
        <label className={styles.infoLabel}>Полная аннотация</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={styles.infoTextarea}
          rows={5}
        />
      </div>
      <div className={styles.infoGrid}>
        {[
          {
            key: "status",
            label: "Статус",
            opts: [
              { v: "draft", l: "Черновик" },
              { v: "ongoing", l: "В процессе" },
              { v: "completed", l: "Завершено" },
              { v: "frozen", l: "Заморожено" },
            ],
          },
          {
            key: "visibility",
            label: "Видимость",
            opts: [
              { v: "draft", l: "Черновик" },
              { v: "unlisted", l: "По ссылке" },
              { v: "public", l: "Публичный" },
            ],
          },
          {
            key: "rating",
            label: "Рейтинг",
            opts: ["G", "PG", "PG-13", "R", "NC-17"].map((r) => ({
              v: r,
              l: r,
            })),
          },
        ].map(({ key, label, opts }) => (
          <div key={key} className={styles.infoField}>
            <label className={styles.infoLabel}>{label}</label>
            <select
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              className={styles.infoSelect}
            >
              {opts.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {updateWork.isError && (
        <p role="alert">Не удалось сохранить изменения: {updateWork.error.message}</p>
      )}
      <div className={styles.infoActions}>
        <button
          type="submit"
          className={styles.saveBtn}
          disabled={updateWork.isPending}
        >
          {updateWork.isPending
            ? "Сохраняю..."
            : saved
              ? "✓ Сохранено"
              : "Сохранить изменения"}
        </button>
      </div>
    </form>
  );
}
