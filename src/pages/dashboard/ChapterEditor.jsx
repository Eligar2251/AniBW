// src/pages/dashboard/ChapterEditor.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Send } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import ChapterEditorComponent from "@components/editor/ChapterEditor";
import styles from "./ChapterEditorPage.module.css";

function useChapter(chapterId) {
  return useQuery({
    queryKey: ["edit-chapter", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*, work:works(id, title)")
        .eq("id", chapterId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId && chapterId !== "new",
  });
}

export default function ChapterEditorPage() {
  const { id: workId, cId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const createStarted = useRef(false);
  const { data: chapter, isLoading, error } = useChapter(cId);

  const createChapter = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Не авторизован");

      const { data: lastChapter, error: lastChapterError } = await supabase
        .from("chapters")
        .select("chapter_number")
        .eq("work_id", workId)
        .order("chapter_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastChapterError) throw lastChapterError;

      const chapterNumber = (lastChapter?.chapter_number || 0) + 1;
      const { data, error: insertError } = await supabase
        .from("chapters")
        .insert({
          work_id: workId,
          author_id: user.id,
          title: `Глава ${chapterNumber}`,
          chapter_number: chapterNumber,
          status: "draft",
          content: "",
          content_text: "",
          words_count: 0,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;
      return data;
    },
    onSuccess: (createdChapter) => {
      queryClient.invalidateQueries({
        queryKey: ["work-chapters-dashboard", workId],
      });
      navigate(`/dashboard/works/${workId}/chapters/${createdChapter.id}`, {
        replace: true,
      });
    },
  });

  const startCreateChapter = createChapter.mutate;
  useEffect(() => {
    if (cId !== "new" || createStarted.current) return;
    createStarted.current = true;
    startCreateChapter();
  }, [cId, startCreateChapter]);

  if (cId === "new") {
    if (createChapter.error) {
      return (
        <div className={styles.page}>
          <div className={styles.topbar}>
            <button
              className={styles.backBtn}
              onClick={() => navigate(`/dashboard/works/${workId}`)}
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
              <span>Вернуться к произведению</span>
            </button>
          </div>
          <p role="alert">Не удалось создать главу: {createChapter.error.message}</p>
        </div>
      );
    }
    return <EditorLoading />;
  }

  if (isLoading) return <EditorLoading />;
  if (error || !chapter) {
    return (
      <div className={styles.page}>
        <div className={styles.topbar}>
          <button
            className={styles.backBtn}
            onClick={() => navigate(`/dashboard/works/${workId}`)}
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            <span>Вернуться к произведению</span>
          </button>
        </div>
        <p role="alert">Глава не найдена или у вас нет доступа к ней.</p>
      </div>
    );
  }

  return (
    <ChapterEditorForm
      key={chapter.id}
      chapter={chapter}
      workId={workId}
      navigate={navigate}
      queryClient={queryClient}
    />
  );
}

function ChapterEditorForm({ chapter, workId, navigate, queryClient }) {
  const [title, setTitle] = useState(chapter.title || "");
  const [noteBefore, setNoteBefore] = useState(chapter.author_note_before || "");
  const [noteAfter, setNoteAfter] = useState(chapter.author_note_after || "");
  const [publishing, setPublishing] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [saveEditor, setSaveEditor] = useState(null);

  const registerSave = useCallback((saveFunction) => {
    setSaveEditor(() => saveFunction || null);
  }, []);

  const saveChapter = useMutation({
    mutationFn: async ({ content, contentText, wordsCount, saveType }) => {
      const payload = {
        content,
        content_text: contentText,
        words_count: wordsCount,
        title: title.trim() || chapter.title,
        author_note_before: noteBefore.trim() || null,
        author_note_after: noteAfter.trim() || null,
      };

      const { error: updateError } = await supabase
        .from("chapters")
        .update(payload)
        .eq("id", chapter.id);
      if (updateError) throw updateError;

      const { error: versionError } = await supabase
        .from("chapter_versions")
        .insert({
          chapter_id: chapter.id,
          content,
          words_count: wordsCount,
          save_type: saveType,
        });
      if (versionError) throw versionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edit-chapter", chapter.id] });
      queryClient.invalidateQueries({
        queryKey: ["work-chapters-dashboard", workId],
      });
    },
  });

  const publishChapter = async () => {
    setPublishing(true);
    try {
      if (saveEditor) {
        const saved = await saveEditor("manual");
        if (!saved) throw new Error("Не удалось сохранить текст перед публикацией");
      }

      const { error } = await supabase
        .from("chapters")
        .update({
          status: "published",
          title: title.trim() || chapter.title,
          author_note_before: noteBefore.trim() || null,
          author_note_after: noteAfter.trim() || null,
        })
        .eq("id", chapter.id);
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["edit-chapter", chapter.id] }),
        queryClient.invalidateQueries({
          queryKey: ["work-chapters-dashboard", workId],
        }),
        queryClient.invalidateQueries({ queryKey: ["work", workId] }),
      ]);
      navigate(`/dashboard/works/${workId}`);
    } catch (publishError) {
      console.error("Publish chapter error:", publishError);
      window.alert(publishError.message || "Не удалось опубликовать главу");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Верхняя панель */}
      <div className={styles.topbar}>
        <button
          className={styles.backBtn}
          onClick={() => navigate(`/dashboard/works/${workId}`)}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          <span>{chapter.work?.title}</span>
        </button>

        <div className={styles.titleWrap}>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={styles.titleInput}
            placeholder="Название главы"
          />
        </div>

        <div className={styles.topbarActions}>
          <button
            className={styles.notesBtn}
            onClick={() => setShowNotes((value) => !value)}
          >
            {showNotes ? <EyeOff size={14} /> : <Eye size={14} />}
            Заметки автора
          </button>

          {chapter.status !== "published" && (
            <button
              className={styles.publishBtn}
              onClick={publishChapter}
              disabled={publishing || saveChapter.isPending || !saveEditor}
            >
              <Send size={14} strokeWidth={1.5} />
              {publishing ? "Публикую..." : "Опубликовать"}
            </button>
          )}
        </div>
      </div>

      {/* Заметки автора */}
      {showNotes && (
        <motion.div
          className={styles.notesPanel}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className={styles.noteField}>
            <label className={styles.noteLabel}>
              <span className={styles.noteKanji}>前</span>
              Заметка перед главой
            </label>
            <textarea
              value={noteBefore}
              onChange={(event) => setNoteBefore(event.target.value)}
              className={styles.noteTextarea}
              placeholder="Заметка автора в начале главы (AN: before)..."
              rows={3}
            />
          </div>
          <div className={styles.noteField}>
            <label className={styles.noteLabel}>
              <span className={styles.noteKanji}>後</span>
              Заметка после главы
            </label>
            <textarea
              value={noteAfter}
              onChange={(event) => setNoteAfter(event.target.value)}
              className={styles.noteTextarea}
              placeholder="Заметка автора в конце главы (AN: after)..."
              rows={3}
            />
          </div>
        </motion.div>
      )}

      {/* Редактор */}
      <div className={styles.editorWrap}>
        <ChapterEditorComponent
          initialContent={chapter.content || ""}
          onSave={saveChapter.mutateAsync}
          onRegisterSave={registerSave}
          placeholder="Начни писать главу..."
        />
      </div>
    </div>
  );
}

function EditorLoading() {
  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div
          className="skeleton"
          style={{ height: 32, width: 200, borderRadius: 4 }}
        />
      </div>
    </div>
  );
}
