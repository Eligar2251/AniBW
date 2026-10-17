// src/components/editor/ChapterEditor.jsx
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Quote,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Link as LinkIcon,
  Minus,
  Table as TableIcon,
  Maximize2,
  Minimize2,
  Save,
  Clock,
  Hash,
  AlignLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { uploadToCloudinary } from "@lib/cloudinary";
import styles from "./ChapterEditor.module.css";

const WORD_GOAL = 1000;

export default function ChapterEditor({
  initialContent = "",
  onSave,
  autoSaveInterval = 30000,
  placeholder = "Начни историю...",
  disabled = false,
  onRegisterSave,
}) {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [wordGoalDone, setWordGoalDone] = useState(false);
  const autoSaveRef = useRef(null);
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        blockquote: true,
        horizontalRule: true,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Typography,
      Placeholder.configure({ placeholder }),
      CharacterCount,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: styles.editorContent,
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      const wc = editor.storage.characterCount.words();
      setWordGoalDone(wc >= WORD_GOAL);
    },
  });

  // ── Автосохранение ──
  const handleSave = useCallback(
    async (type = "auto") => {
      if (!editor || !onSave || disabled) return false;
      setIsSaving(true);
      setSaveError("");
      try {
        await onSave({
          content: editor.getHTML(),
          contentText: editor.getText(),
          wordsCount: editor.storage.characterCount.words(),
          saveType: type,
        });
        setLastSaved(new Date());
        return true;
      } catch (error) {
        console.error("Chapter save failed:", error);
        setSaveError(error?.message || "Ошибка сохранения");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [editor, onSave, disabled],
  );

  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      void handleSave("auto");
    }, autoSaveInterval);
    return () => clearInterval(autoSaveRef.current);
  }, [handleSave, autoSaveInterval]);

  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(handleSave);
    return () => onRegisterSave(null);
  }, [handleSave, onRegisterSave]);

  // Ctrl+S
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave("manual");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // ── Загрузка изображения ──
  const handleImageUpload = useCallback(
    async (file) => {
      if (!file || !editor) return;
      try {
        const result = await uploadToCloudinary(file, "aniscript/chapters");
        editor.chain().focus().setImage({ src: result.secure_url }).run();
      } catch (err) {
        console.error("Image upload failed:", err);
      }
    },
    [editor],
  );

  if (!editor) return null;

  const wordCount = editor.storage.characterCount.words();
  const charCount = editor.storage.characterCount.characters();
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  const goalPct = Math.min(100, (wordCount / WORD_GOAL) * 100);

  return (
    <div className={`${styles.wrap} ${isFocusMode ? styles.focusMode : ""}`}>
      {/* ── Тулбар ── */}
      <AnimatePresence>
        {!isFocusMode && (
          <motion.div
            className={styles.toolbar}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Форматирование */}
            <div className={styles.toolGroup}>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive("bold")}
                title="Жирный (Ctrl+B)"
              >
                <Bold size={15} strokeWidth={1.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive("italic")}
                title="Курсив (Ctrl+I)"
              >
                <Italic size={15} strokeWidth={1.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                active={editor.isActive("underline")}
                title="Подчёркнутый"
              >
                <UnderlineIcon size={15} strokeWidth={1.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleStrike().run()}
                active={editor.isActive("strike")}
                title="Зачёркнутый"
              >
                <Strikethrough size={15} strokeWidth={1.5} />
              </ToolBtn>
            </div>

            <div className={styles.toolDivider} />

            {/* Заголовки */}
            <div className={styles.toolGroup}>
              <ToolBtn
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                active={editor.isActive("heading", { level: 2 })}
                title="Заголовок 2"
              >
                <Heading2 size={15} strokeWidth={1.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
                active={editor.isActive("heading", { level: 3 })}
                title="Заголовок 3"
              >
                <Heading3 size={15} strokeWidth={1.5} />
              </ToolBtn>
            </div>

            <div className={styles.toolDivider} />

            {/* Блоки */}
            <div className={styles.toolGroup}>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                active={editor.isActive("blockquote")}
                title="Цитата"
              >
                <Quote size={15} strokeWidth={1.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                active={editor.isActive("bulletList")}
                title="Список"
              >
                <List size={15} strokeWidth={1.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                active={editor.isActive("orderedList")}
                title="Нумерованный список"
              >
                <ListOrdered size={15} strokeWidth={1.5} />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Разделитель"
              >
                <Minus size={15} strokeWidth={1.5} />
              </ToolBtn>
            </div>

            <div className={styles.toolDivider} />

            {/* Медиа */}
            <div className={styles.toolGroup}>
              <ToolBtn
                onClick={() => fileInputRef.current?.click()}
                title="Вставить изображение"
              >
                <ImageIcon size={15} strokeWidth={1.5} />
              </ToolBtn>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleImageUpload(e.target.files?.[0])}
              />
            </div>

            {/* Правая часть тулбара */}
            <div className={styles.toolbarRight}>
              {/* Превью */}
              <button
                className={styles.toolBtnRight}
                onClick={() => setShowPreview((v) => !v)}
                title="Предпросмотр"
              >
                {showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>

              {/* Режим фокуса */}
              <button
                className={styles.toolBtnRight}
                onClick={() => setIsFocusMode((v) => !v)}
                title="Режим фокуса"
              >
                <Maximize2 size={15} strokeWidth={1.5} />
              </button>

              {/* Сохранение */}
              <button
                className={`${styles.saveBtn} ${isSaving ? styles.saveBtnLoading : ""}`}
                onClick={() => handleSave("manual")}
                disabled={isSaving || disabled}
              >
                <Save size={14} strokeWidth={1.5} />
                {isSaving ? "Сохраняю..." : "Сохранить"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Редактор / Превью ── */}
      <div className={styles.editorWrap}>
        {showPreview ? (
          <div
            className={`${styles.previewContent} ${styles.editorContent}`}
            dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
          />
        ) : (
          <EditorContent editor={editor} className={styles.editorOuter} />
        )}
      </div>

      {/* ── Нижняя панель ── */}
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          {/* Автосохранение */}
          <span className={styles.statusItem} title={saveError || undefined}>
            <Clock size={11} strokeWidth={1.5} />
            {saveError
              ? "Ошибка сохранения"
              : lastSaved
                ? `Сохранено в ${lastSaved.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}`
                : "Не сохранено"}
          </span>
        </div>

        <div className={styles.statusCenter}>
          {/* Цель по словам */}
          <div className={styles.goalWrap}>
            <div
              className={`${styles.goalBar} ${wordGoalDone ? styles.goalDone : ""}`}
            >
              <div
                className={styles.goalFill}
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <span className={styles.goalLabel}>
              {wordCount} / {WORD_GOAL} слов
            </span>
          </div>
        </div>

        <div className={styles.statusRight}>
          <span className={styles.statusItem}>
            <Hash size={11} strokeWidth={1.5} />
            {charCount} символов
          </span>
          <span className={styles.statusItem}>
            <AlignLeft size={11} strokeWidth={1.5} />
            {wordCount} слов
          </span>
          <span className={styles.statusItem}>~{readTime} мин.</span>
        </div>
      </div>

      {/* Кнопка выхода из фокус-режима */}
      <AnimatePresence>
        {isFocusMode && (
          <motion.button
            className={styles.exitFocusBtn}
            onClick={() => setIsFocusMode(false)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            title="Выйти из режима фокуса (Esc)"
          >
            <Minimize2 size={14} strokeWidth={1.5} />
            Выйти из фокуса
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolBtn({ children, onClick, active, title }) {
  return (
    <button
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ""}`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}
