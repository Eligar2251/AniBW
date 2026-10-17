import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Check,
  Download,
  Edit3,
  ExternalLink,
  Link2,
  Plus,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import styles from "./WorldCodex.module.css";

const ENTRY_TYPES = [
  { value: "place", label: "Место" },
  { value: "faction", label: "Фракция" },
  { value: "species", label: "Народ / вид" },
  { value: "artifact", label: "Артефакт" },
  { value: "culture", label: "Культура" },
  { value: "concept", label: "Понятие" },
];

const ENTRY_FIELDS =
  "id, work_id, entry_type, title, summary, content, is_published, created_at, updated_at";
const EMPTY_FORM = {
  entry_type: "place",
  title: "",
  summary: "",
  content: "",
  is_published: false,
};

function entryTypeLabel(type) {
  return ENTRY_TYPES.find((entryType) => entryType.value === type)?.label || type;
}

function useWorldEntries(workId, publicOnly) {
  return useQuery({
    queryKey: ["world-entries", workId, publicOnly],
    queryFn: async () => {
      let request = supabase
        .from("world_entries")
        .select(ENTRY_FIELDS)
        .eq("work_id", workId)
        .order("entry_type", { ascending: true })
        .order("title", { ascending: true });
      if (publicOnly) request = request.eq("is_published", true);
      const { data, error } = await request;
      if (error) throw error;
      return data || [];
    },
    enabled: !!workId,
  });
}

function useWorldEntryLinks(workId) {
  return useQuery({
    queryKey: ["world-entry-links", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("world_entry_links")
        .select("id, work_id, source_entry_id, target_entry_id, relation_label")
        .eq("work_id", workId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workId,
  });
}

export default function WorldCodex({ workId, readOnly = false }) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterType, setFilterType] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [actionError, setActionError] = useState("");
  const [relationTarget, setRelationTarget] = useState("");
  const [relationLabel, setRelationLabel] = useState("Связано");
  const [shareCopied, setShareCopied] = useState(false);

  const publicOnly = readOnly;
  const {
    data: entries = [],
    isLoading,
    error: entriesError,
  } = useWorldEntries(workId, publicOnly);
  const {
    data: links = [],
    isLoading: linksLoading,
    error: linksError,
  } = useWorldEntryLinks(workId);

  const requestedEntryId = searchParams.get("entry");
  const activeEntry =
    entries.find((entry) => entry.id === requestedEntryId) || entries[0] || null;
  const editing = !!activeEntry && activeEntry.id === editingEntryId;

  useEffect(() => {
    if (!workId) return undefined;
    const refreshEntries = () => {
      queryClient.invalidateQueries({ queryKey: ["world-entries", workId] });
    };
    const refreshLinks = () => {
      queryClient.invalidateQueries({ queryKey: ["world-entry-links", workId] });
    };
    const channel = supabase
      .channel(`world-codex:${workId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "world_entries", filter: `work_id=eq.${workId}` },
        refreshEntries,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "world_entry_links", filter: `work_id=eq.${workId}` },
        refreshLinks,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, workId]);

  const filteredEntries = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase("ru");
    return entries.filter((entry) => {
      if (filterType !== "all" && entry.entry_type !== filterType) return false;
      if (!query) return true;
      return [entry.title, entry.summary, entry.content]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("ru").includes(query));
    });
  }, [entries, filterType, searchText]);

  const selectedLinks = links.filter(
    (link) => link.source_entry_id === activeEntry?.id,
  );
  const relatedEntries = useMemo(
    () =>
      selectedLinks
        .map((link) => ({
          ...link,
          target: entries.find((entry) => entry.id === link.target_entry_id),
        }))
        .filter((link) => link.target),
    [entries, selectedLinks],
  );
  const availableTargets = entries.filter(
    (entry) =>
      entry.id !== activeEntry?.id &&
      !selectedLinks.some((link) => link.target_entry_id === entry.id),
  );

  const invalidateWorld = () => {
    queryClient.invalidateQueries({ queryKey: ["world-entries", workId] });
    queryClient.invalidateQueries({ queryKey: ["world-entry-links", workId] });
  };

  const createEntry = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Войдите в аккаунт автора, чтобы добавить запись.");
      const { data, error } = await supabase
        .from("world_entries")
        .insert({
          work_id: workId,
          author_id: user.id,
          ...EMPTY_FORM,
          title: "Новая запись",
        })
        .select(ENTRY_FIELDS)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (entry) => {
      setActionError("");
      await queryClient.invalidateQueries({
        queryKey: ["world-entries", workId, publicOnly],
      });
      setForm({ ...EMPTY_FORM, title: entry.title });
      setEditingEntryId(entry.id);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("entry", entry.id);
        return next;
      });
    },
    onError: (error) => setActionError(error.message || "Не удалось создать запись."),
  });

  const saveEntry = useMutation({
    mutationFn: async () => {
      if (!activeEntry) throw new Error("Сначала выберите запись.");
      if (!form.title.trim()) throw new Error("У записи должно быть название.");
      const { data, error } = await supabase
        .from("world_entries")
        .update({
          entry_type: form.entry_type,
          title: form.title.trim(),
          summary: form.summary.trim(),
          content: form.content,
          is_published: form.is_published,
        })
        .eq("id", activeEntry.id)
        .eq("work_id", workId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Запись не найдена или у вас нет доступа к ней.");
    },
    onSuccess: () => {
      setActionError("");
      setEditingEntryId(null);
      invalidateWorld();
    },
    onError: (error) => setActionError(error.message || "Не удалось сохранить запись."),
  });

  const deleteEntry = useMutation({
    mutationFn: async () => {
      if (!activeEntry) return;
      const { data, error } = await supabase
        .from("world_entries")
        .delete()
        .eq("id", activeEntry.id)
        .eq("work_id", workId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Запись не найдена или у вас нет доступа к ней.");
    },
    onSuccess: () => {
      setActionError("");
      setEditingEntryId(null);
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("entry");
        return next;
      });
      invalidateWorld();
    },
    onError: (error) => setActionError(error.message || "Не удалось удалить запись."),
  });

  const addLink = useMutation({
    mutationFn: async () => {
      if (!activeEntry || !relationTarget) {
        throw new Error("Выберите запись, с которой нужно установить связь.");
      }
      const { error } = await supabase.from("world_entry_links").insert({
        work_id: workId,
        source_entry_id: activeEntry.id,
        target_entry_id: relationTarget,
        relation_label: relationLabel.trim() || "Связано",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setActionError("");
      setRelationTarget("");
      queryClient.invalidateQueries({ queryKey: ["world-entry-links", workId] });
    },
    onError: (error) => setActionError(error.message || "Не удалось связать записи."),
  });

  const removeLink = useMutation({
    mutationFn: async (linkId) => {
      const { data, error } = await supabase
        .from("world_entry_links")
        .delete()
        .eq("id", linkId)
        .eq("work_id", workId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Связь не найдена или у вас нет доступа к ней.");
    },
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: ["world-entry-links", workId] });
    },
    onError: (error) => setActionError(error.message || "Не удалось удалить связь."),
  });

  const handleSelectEntry = (entryId) => {
    if (entryId === activeEntry?.id) return;
    if (editing && !window.confirm("Отменить несохранённые изменения?")) return;
    setEditingEntryId(null);
    setRelationTarget("");
    setActionError("");
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (entryId) next.set("entry", entryId);
      else next.delete("entry");
      return next;
    });
  };

  const handleShare = async () => {
    if (!activeEntry) return;
    const url = new URL(`/works/${workId}/world`, window.location.origin);
    url.searchParams.set("entry", activeEntry.id);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url.toString());
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      window.prompt("Скопируйте ссылку на статью мира", url.toString());
    }
  };

  const handleExport = () => {
    const payload = {
      format: "anibw-world-codex",
      version: 1,
      exported_at: new Date().toISOString(),
      work_id: workId,
      entries,
      links,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `anibw-world-${workId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  if (isLoading) {
    return <div className={styles.loading}>Загружаем энциклопедию мира…</div>;
  }

  if (entriesError) {
    return (
      <div className={styles.error} role="alert">
        Не удалось загрузить энциклопедию: {entriesError.message}
      </div>
    );
  }

  const queryError = linksError ? `Не удалось загрузить связи: ${linksError.message}` : "";
  const filteredActive = filteredEntries.some((entry) => entry.id === activeEntry?.id);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <label className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className={styles.searchInput}
            placeholder="Искать в мире…"
            aria-label="Поиск по энциклопедии мира"
          />
        </label>
        <select
          value={filterType}
          onChange={(event) => setFilterType(event.target.value)}
          className={styles.typeSelect}
          aria-label="Фильтр по типу записи"
        >
          <option value="all">Все типы</option>
          {ENTRY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <button className={styles.actionButton} onClick={handleExport} type="button">
          <Download size={14} /> Экспорт JSON
        </button>
        {!readOnly && (
          <button
            className={styles.primaryButton}
            onClick={() => createEntry.mutate()}
            disabled={createEntry.isPending}
            type="button"
          >
            <Plus size={14} /> Новая запись
          </button>
        )}
      </div>

      <AnimatePresence>
        {(actionError || queryError) && (
          <motion.p
            className={styles.error}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {actionError || queryError}
          </motion.p>
        )}
      </AnimatePresence>

      <div className={styles.layout}>
        <aside className={styles.entryList} aria-label="Записи мира">
          <div className={styles.listHeader}>
            <span>Архив мира</span>
            <span>{filteredEntries.length} / {entries.length}</span>
          </div>
          {filteredEntries.length === 0 ? (
            <div className={styles.emptyList}>
              <span className={styles.emptyKanji} aria-hidden="true">典</span>
              {entries.length === 0 ? (
                <>
                  <p>{readOnly ? "Автор пока не опубликовал статьи мира." : "В энциклопедии пока нет записей."}</p>
                  {!readOnly && (
                    <button
                      className={styles.primaryButton}
                      onClick={() => createEntry.mutate()}
                      disabled={createEntry.isPending}
                      type="button"
                    >
                      <Plus size={14} /> Создать первую
                    </button>
                  )}
                </>
              ) : (
                <p>Ничего не найдено. Попробуйте изменить поиск или фильтр.</p>
              )}
            </div>
          ) : (
            <div className={styles.entryRows}>
              {filteredEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`${styles.entryRow} ${activeEntry?.id === entry.id ? styles.entryRowActive : ""}`}
                  onClick={() => handleSelectEntry(entry.id)}
                  aria-current={activeEntry?.id === entry.id ? "page" : undefined}
                >
                  <span className={styles.entryRowTop}>
                    <span className={styles.entryType}>{entryTypeLabel(entry.entry_type)}</span>
                    <span className={styles.entryTitle}>{entry.title}</span>
                  </span>
                  {entry.summary && <span className={styles.entrySummary}>{entry.summary}</span>}
                  {!readOnly && (
                    <span className={styles.entryMeta}>
                      {entry.is_published ? "Опубликовано" : "Черновик"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className={styles.detail} aria-live="polite">
          {!activeEntry || !filteredActive ? (
            <div className={styles.detailEmpty}>
              <BookOpen size={22} strokeWidth={1.3} />
              <p>
                {activeEntry && !filteredActive
                  ? "Выбранная статья скрыта фильтром. Очистите поиск или выберите другую запись."
                  : readOnly
                    ? "Выберите статью в архиве мира."
                    : "Создайте запись, чтобы собрать историю, места и народы вашего мира в одном кодексе."}
              </p>
            </div>
          ) : editing && !readOnly ? (
            <form
              className={styles.editForm}
              onSubmit={(event) => {
                event.preventDefault();
                saveEntry.mutate();
              }}
            >
              <div className={styles.formGrid}>
                <label className={styles.fieldLabel}>
                  Название
                  <input
                    required
                    maxLength={120}
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    className={styles.textInput}
                    autoFocus
                  />
                </label>
                <label className={styles.fieldLabel}>
                  Тип записи
                  <select
                    value={form.entry_type}
                    onChange={(event) => setForm((current) => ({ ...current, entry_type: event.target.value }))}
                    className={styles.typeSelect}
                  >
                    {ENTRY_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={styles.fieldLabel}>
                Краткое описание
                <textarea
                  maxLength={600}
                  rows={3}
                  value={form.summary}
                  onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                  className={styles.textArea}
                  placeholder="Кратко: что читателю важно знать об этой записи?"
                />
              </label>
              <label className={styles.fieldLabel}>
                Статья — Markdown поддерживает заголовки, списки, таблицы и ссылки
                <textarea
                  maxLength={100000}
                  rows={14}
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                  className={`${styles.textArea} ${styles.contentArea}`}
                  placeholder="# История\n\nОпишите детали, легенды и правила мира…"
                />
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))}
                />
                <span>
                  <strong>Опубликовать в открытом кодексе</strong><br />
                  Запись будет видна читателям на странице мира, если само произведение открыто.
                </span>
              </label>
              <div className={styles.formActions}>
                <button
                  className={styles.actionButton}
                  type="button"
                  onClick={() => {
                    setForm({
                      entry_type: activeEntry.entry_type,
                      title: activeEntry.title,
                      summary: activeEntry.summary || "",
                      content: activeEntry.content || "",
                      is_published: activeEntry.is_published,
                    });
                    setEditingEntryId(null);
                    setActionError("");
                  }}
                >
                  <X size={14} /> Отмена
                </button>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={saveEntry.isPending || !form.title.trim()}
                >
                  <Check size={14} /> {saveEntry.isPending ? "Сохраняем…" : "Сохранить"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className={styles.detailTop}>
                <div className={styles.detailHeading}>
                  <div className={styles.detailBadges}>
                    <span className={styles.typeBadge}>{entryTypeLabel(activeEntry.entry_type)}</span>
                    {activeEntry.is_published ? (
                      <span className={styles.publishedBadge}>Опубликовано</span>
                    ) : (
                      <span className={styles.draftBadge}>Черновик</span>
                    )}
                  </div>
                  <h2 className={styles.detailTitle}>{activeEntry.title}</h2>
                  {activeEntry.summary && <p className={styles.detailSummary}>{activeEntry.summary}</p>}
                </div>
                <div className={styles.detailActions}>
                  {(activeEntry.is_published || readOnly) && (
                    <button
                      className={styles.actionButton}
                      type="button"
                      onClick={handleShare}
                      title="Скопировать ссылку на эту запись"
                    >
                      {shareCopied ? <Check size={14} /> : <Share2 size={14} />}
                      {shareCopied ? "Скопировано" : "Поделиться"}
                    </button>
                  )}
                  {!readOnly && (
                    <>
                      <button
                        className={styles.iconButton}
                        type="button"
                        title="Редактировать запись"
                        aria-label="Редактировать запись"
                        onClick={() => {
                          setForm({
                            entry_type: activeEntry.entry_type,
                            title: activeEntry.title,
                            summary: activeEntry.summary || "",
                            content: activeEntry.content || "",
                            is_published: activeEntry.is_published,
                          });
                          setEditingEntryId(activeEntry.id);
                          setActionError("");
                        }}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        className={`${styles.iconButton} ${styles.dangerButton}`}
                        type="button"
                        title="Удалить запись"
                        aria-label="Удалить запись"
                        disabled={deleteEntry.isPending}
                        onClick={() => {
                          if (window.confirm(`Удалить запись «${activeEntry.title}»?`)) {
                            deleteEntry.mutate();
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className={styles.markdown}>
                {activeEntry.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeEntry.content}</ReactMarkdown>
                ) : (
                  <p>У этой записи пока нет подробного описания.</p>
                )}
              </div>
              <p className={styles.updatedAt}>
                Обновлено {new Date(activeEntry.updated_at).toLocaleDateString("ru-RU")}
                {readOnly ? " · открытая статья мира" : " · статья сохраняется отдельно от заметок и лор-карточек"}
              </p>

              <section className={styles.relations} aria-label="Связанные статьи">
                <div className={styles.relationHeading}>
                  <h3>Связанные записи</h3>
                  {relatedEntries.length > 0 && <span className={styles.entryMeta}>{relatedEntries.length}</span>}
                </div>
                {linksLoading ? (
                  <div className={styles.entryMeta}>Загружаем связи…</div>
                ) : relatedEntries.length > 0 ? (
                  <div className={styles.relationRows}>
                    {relatedEntries.map((relation) => (
                      <div className={styles.relationRow} key={relation.id}>
                        <button
                          className={styles.relationLink}
                          type="button"
                          onClick={() => handleSelectEntry(relation.target.id)}
                        >
                          <Link2 size={14} />
                          <span>{relation.target.title}</span>
                          <ExternalLink size={12} />
                        </button>
                        <span className={styles.relationLabel}>{relation.relation_label}</span>
                        {!readOnly && (
                          <button
                            className={`${styles.iconButton} ${styles.dangerButton}`}
                            type="button"
                            title="Удалить связь"
                            aria-label={`Удалить связь с записью «${relation.target.title}»`}
                            onClick={() => removeLink.mutate(relation.id)}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.entryMeta}>Пока нет связанных записей.</p>
                )}
                {!readOnly && availableTargets.length > 0 && (
                  <div className={styles.addRelationForm}>
                    <select
                      className={styles.relationSelect}
                      value={relationTarget}
                      onChange={(event) => setRelationTarget(event.target.value)}
                      aria-label="Выберите связанную запись"
                    >
                      <option value="">Связать с…</option>
                      {availableTargets.map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.title}</option>
                      ))}
                    </select>
                    <input
                      className={styles.relationSelect}
                      value={relationLabel}
                      maxLength={80}
                      onChange={(event) => setRelationLabel(event.target.value)}
                      aria-label="Подпись связи"
                      placeholder="Например: основан на"
                    />
                    <button
                      className={styles.actionButton}
                      type="button"
                      onClick={() => addLink.mutate()}
                      disabled={!relationTarget || addLink.isPending}
                    >
                      <Plus size={13} /> Связать
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
