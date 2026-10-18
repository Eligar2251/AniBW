// src/pages/dashboard/NewWorkPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, X, Plus } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { uploadToCloudinary } from "@lib/cloudinary";
import styles from "./NewWorkPage.module.css";

const RATINGS = ["G", "PG", "PG-13", "R", "NC-17"];
const CATEGORIES = [
  { value: "gen", label: "Джен" },
  { value: "het", label: "Гет" },
  { value: "slash", label: "Слэш" },
  { value: "femslash", label: "Фем-слэш" },
  { value: "multi", label: "Мульти" },
];
const STATUSES = [
  { value: "draft", label: "Черновик" },
  { value: "ongoing", label: "В процессе" },
  { value: "completed", label: "Завершено" },
];
const VISIBILITIES = [
  { value: "draft", label: "Черновик" },
  { value: "unlisted", label: "По ссылке" },
  { value: "public", label: "Публичный" },
];

function useFandoms() {
  return useQuery({
    queryKey: ["fandoms-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fandoms")
        .select("id, name, slug")
        .order("works_count", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export default function NewWorkPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState({
    title: "",
    summary: "",
    description: "",
    fandom_id: null, // ← null вместо ""
    category: "gen",
    rating: "PG",
    status: "draft",
    language: "ru",
    visibility: "draft",
    warn_violence: false,
    warn_death: false,
    warn_noncon: false,
    warn_underage: false,
    warn_other: "",
  });

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");

  const { data: fandoms = [], isLoading: fandomsLoading } = useFandoms();

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Проверка размера (5 МБ)
    if (file.size > 5 * 1024 * 1024) {
      setError("Файл слишком большой. Максимум 5 МБ");
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError("");
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t) && tags.length < 20) {
      setTags((prev) => [...prev, t]);
      setTagInput("");
    }
  };

  const removeTag = (tag) => setTags((prev) => prev.filter((t) => t !== tag));

  const createWork = useMutation({
    mutationFn: async () => {
      setError("");

      if (!user?.id) throw new Error("Не авторизован");

      // Загрузка обложки
      let cover_url = null;
      if (coverFile) {
        const result = await uploadToCloudinary(coverFile, "aniscript/covers");
        cover_url = result.secure_url;
      }

      // Собираем payload — убираем пустые строки, заменяем на null
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        description: form.description.trim() || null,
        fandom_id: form.fandom_id || null, // "" → null
        category: form.category,
        rating: form.rating,
        status: form.status,
        language: form.language,
        visibility: form.visibility,
        warn_violence: form.warn_violence,
        warn_death: form.warn_death,
        warn_noncon: form.warn_noncon,
        warn_underage: form.warn_underage,
        warn_other: form.warn_other.trim() || null,
        cover_url,
        author_id: user.id,
      };

      // Создаём произведение
      const { data: work, error: workErr } = await supabase
        .from("works")
        .insert(payload)
        .select("id")
        .single();

      if (workErr) throw workErr;

      try {
        if (tags.length > 0) {
          for (const tagName of tags) {
            const { error: tagInsertError } = await supabase
              .from("tags")
              .upsert(
                { name: tagName },
                { onConflict: "name", ignoreDuplicates: true },
              );
            if (tagInsertError) throw tagInsertError;

            const { data: tag, error: tagLoadError } = await supabase
              .from("tags")
              .select("id")
              .eq("name", tagName)
              .single();
            if (tagLoadError) throw tagLoadError;

            const { error: linkError } = await supabase
              .from("work_tags")
              .insert({ work_id: work.id, tag_id: tag.id });
            if (linkError) throw linkError;
          }
        }
      } catch (tagError) {
        const { error: cleanupError } = await supabase
          .from("works")
          .delete()
          .eq("id", work.id);
        if (cleanupError) console.error("Work cleanup failed:", cleanupError);
        throw tagError;
      }

      return work;
    },

    onSuccess: (work) => {
      navigate(`/dashboard/works/${work.id}`);
    },

    onError: (err) => {
      console.error("Create work error:", err);
      // Понятные сообщения об ошибках
      if (
        err.message?.includes("duplicate") ||
        err.message?.includes("unique")
      ) {
        setError("Произведение с таким названием уже существует");
      } else if (err.message?.includes("violates foreign key")) {
        setError("Выбран несуществующий фандом");
      } else {
        setError(err.message || "Ошибка при создании");
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Введи название произведения");
      return;
    }
    createWork.mutate();
  };

  const isPending = createWork.isPending;

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <span className={styles.headerKanji} aria-hidden>
          新
        </span>
        <h1 className={styles.title}>Новое произведение</h1>
      </motion.div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.layout}>
          {/* ── Левая колонка — обложка ── */}
          <motion.div
            className={styles.coverCol}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            <div className={styles.coverLabel}>Обложка</div>
            <label className={styles.coverUpload}>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                style={{ display: "none" }}
                disabled={isPending}
              />
              {coverPreview ? (
                <div className={styles.coverPreviewWrap}>
                  <img
                    src={coverPreview}
                    alt="Обложка"
                    className={styles.coverPreview}
                  />
                  <div className={styles.coverOverlay}>
                    <Upload size={20} strokeWidth={1.5} />
                    <span>Изменить</span>
                  </div>
                </div>
              ) : (
                <div className={styles.coverPlaceholder}>
                  <Upload
                    size={28}
                    strokeWidth={1}
                    color="var(--color-text-faint)"
                  />
                  <span className={styles.coverPlaceholderText}>
                    Загрузить обложку
                  </span>
                  <span className={styles.coverPlaceholderSub}>
                    JPG, PNG, WEBP · до 5 МБ
                  </span>
                </div>
              )}
            </label>
            <div className={styles.coverHint}>
              Рекомендуемый формат 2:3
              <br />
              (например 400×600 px)
            </div>
          </motion.div>

          {/* ── Правая колонка — поля ── */}
          <motion.div
            className={styles.mainCol}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
          >
            {/* Название */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Название <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={styles.input}
                placeholder="Название произведения"
                maxLength={200}
                disabled={isPending}
                required
              />
            </div>

            {/* Краткая аннотация */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Краткая аннотация
                <span className={styles.fieldHint}>
                  (отображается в карточке)
                </span>
              </label>
              <textarea
                value={form.summary}
                onChange={(e) => set("summary", e.target.value)}
                className={styles.textarea}
                placeholder="Пара предложений о сюжете..."
                rows={3}
                maxLength={500}
                disabled={isPending}
              />
              <span className={styles.charCount}>
                {form.summary.length}/500
              </span>
            </div>

            {/* Полная аннотация */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Полная аннотация</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className={styles.textarea}
                placeholder="Расширенное описание произведения..."
                rows={5}
                maxLength={3000}
                disabled={isPending}
              />
            </div>

            {/* Фандом */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Фандом</label>
              <select
                value={form.fandom_id ?? ""}
                onChange={(e) => set("fandom_id", e.target.value || null)}
                className={styles.select}
                disabled={isPending || fandomsLoading}
              >
                <option value="">Без фандома / Оригинальное</option>
                {fandoms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Категория */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Категория</label>
              <div className={styles.segmented}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`${styles.segBtn} ${form.category === c.value ? styles.segBtnActive : ""}`}
                    onClick={() => set("category", c.value)}
                    disabled={isPending}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Рейтинг */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Рейтинг</label>
              <div className={styles.segmented}>
                {RATINGS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.segBtn} ${form.rating === r ? styles.segBtnActive : ""}`}
                    onClick={() => set("rating", r)}
                    disabled={isPending}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Статус */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Статус</label>
              <div className={styles.segmented}>
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`${styles.segBtn} ${form.status === s.value ? styles.segBtnActive : ""}`}
                    onClick={() => set("status", s.value)}
                    disabled={isPending}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Видимость */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Видимость</label>
              <div className={styles.segmented}>
                {VISIBILITIES.map((v) => (
                  <button
                    key={v.value}
                    type="button"
                    className={`${styles.segBtn} ${form.visibility === v.value ? styles.segBtnActive : ""}`}
                    onClick={() => set("visibility", v.value)}
                    disabled={isPending}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Теги */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Теги
                <span className={styles.fieldHint}>({tags.length}/20)</span>
              </label>
              <div className={styles.tagInput}>
                <input
                  type="text"
                  value={tagInput}
                  maxLength={60}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className={styles.input}
                  placeholder="Введи тег и нажми Enter..."
                  disabled={isPending || tags.length >= 20}
                />
                <button
                  type="button"
                  className={styles.addTagBtn}
                  onClick={addTag}
                  disabled={isPending || tags.length >= 20}
                >
                  <Plus size={16} strokeWidth={1.5} />
                </button>
              </div>
              {tags.length > 0 && (
                <div className={styles.tags}>
                  {tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      #{tag}
                      <button
                        type="button"
                        className={styles.tagRemove}
                        onClick={() => removeTag(tag)}
                        disabled={isPending}
                      >
                        <X size={11} strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Предупреждения */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Предупреждения</label>
              <div className={styles.warnings}>
                {[
                  { key: "warn_violence", label: "Жестокость / насилие" },
                  { key: "warn_death", label: "Смерть персонажа" },
                  { key: "warn_noncon", label: "Нон-кон" },
                  { key: "warn_underage", label: "Несовершеннолетние" },
                ].map((w) => (
                  <label key={w.key} className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={form[w.key]}
                      onChange={(e) => set(w.key, e.target.checked)}
                      className={styles.checkbox}
                      disabled={isPending}
                    />
                    <span>{w.label}</span>
                  </label>
                ))}
                <input
                  type="text"
                  value={form.warn_other}
                  onChange={(e) => set("warn_other", e.target.value)}
                  className={styles.input}
                  placeholder="Другие предупреждения..."
                  style={{ marginTop: "var(--space-2)" }}
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Ошибка */}
            {error && (
              <motion.div
                className={styles.error}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.div>
            )}

            {/* Кнопки */}
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => navigate("/dashboard/works")}
                disabled={isPending}
              >
                Отмена
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isPending}
              >
                {isPending ? "Создаю..." : "Создать произведение"}
              </button>
            </div>
          </motion.div>
        </div>
      </form>
    </div>
  );
}
