// src/pages/dashboard/ChapterEditor.jsx
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Send } from "lucide-react";
import { supabase } from "@lib/supabase";
import ChapterEditorComponent from "@components/editor/ChapterEditor";
import styles from "./ChapterEditorPage.module.css";

function useChapter(chapterId) {
  return useQuery({
    queryKey: ["edit-chapter", chapterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select(`*, work:works(id, title)`)
        .eq("id", chapterId)
        .single();
      return data;
    },
    enabled: !!chapterId && chapterId !== "new",
  });
}

export default function ChapterEditorPage() {
  const { id: workId, cId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: chapter, isLoading } = useChapter(cId);

  const [title, setTitle] = useState(chapter?.title || "");
  const [noteBefore, setNoteBefore] = useState(
    chapter?.author_note_before || "",
  );
  const [noteAfter, setNoteAfter] = useState(chapter?.author_note_after || "");
  const [publishing, setPublishing] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const saveChapter = useMutation({
    mutationFn: async ({ content, contentText, wordsCount, saveType }) => {
      const payload = {
        content,
        content_text: contentText,
        words_count: wordsCount,
        title: title || chapter?.title,
        author_note_before: noteBefore,
        author_note_after: noteAfter,
      };

      await supabase.from("chapters").update(payload).eq("id", cId);

      // Сохраняем версию
      await supabase.from("chapter_versions").insert({
        chapter_id: cId,
        content,
        words_count: wordsCount,
        save_type: saveType,
      });

      queryClient.invalidateQueries({ queryKey: ["edit-chapter", cId] });
    },
  });

  const publishChapter = async () => {
    setPublishing(true);
    try {
      await supabase
        .from("chapters")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
        })
        .eq("id", cId);

      queryClient.invalidateQueries({ queryKey: ["edit-chapter", cId] });
      navigate(`/dashboard/works/${workId}`);
    } finally {
      setPublishing(false);
    }
  };

  if (isLoading)
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

  return (
    <div className={styles.page}>
      {/* Верхняя панель */}
      <div className={styles.topbar}>
        <button
          className={styles.backBtn}
          onClick={() => navigate(`/dashboard/works/${workId}`)}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          <span>{chapter?.work?.title}</span>
        </button>

        <div className={styles.titleWrap}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.titleInput}
            placeholder="Название главы"
          />
        </div>

        <div className={styles.topbarActions}>
          <button
            className={styles.notesBtn}
            onClick={() => setShowNotes((v) => !v)}
          >
            {showNotes ? <EyeOff size={14} /> : <Eye size={14} />}
            Заметки автора
          </button>

          {chapter?.status !== "published" && (
            <button
              className={styles.publishBtn}
              onClick={publishChapter}
              disabled={publishing}
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
              onChange={(e) => setNoteBefore(e.target.value)}
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
              onChange={(e) => setNoteAfter(e.target.value)}
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
          initialContent={chapter?.content || ""}
          onSave={saveChapter.mutate}
          placeholder="Начни писать главу..."
        />
      </div>
    </div>
  );
}
