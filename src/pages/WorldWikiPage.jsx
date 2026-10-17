import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronLeft, Map } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@lib/supabase";
import WorldCodex from "@components/worldbuilding/WorldCodex";
import PublicWorldMap from "@components/worldbuilding/PublicWorldMap";
import styles from "./WorldWikiPage.module.css";

function useWorld(workId) {
  return useQuery({
    queryKey: ["public-world", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works_full")
        .select("id, title, author_username, author_display_name")
        .eq("id", workId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!workId,
  });
}

function usePublicMapSettings(workId) {
  return useQuery({
    queryKey: ["public-world-map-settings", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("world_map_settings")
        .select("background_url")
        .eq("work_id", workId)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workId,
  });
}

export default function WorldWikiPage() {
  const { id: workId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: work, isLoading, error } = useWorld(workId);
  const {
    data: mapSettings,
    isLoading: mapSettingsLoading,
    error: mapSettingsError,
  } = usePublicMapSettings(workId);
  const activeView = searchParams.get("view") === "map" ? "map" : "codex";

  const setView = (view) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (view === "codex") next.delete("view");
      else next.set("view", view);
      return next;
    });
  };

  const openEntry = (entryId) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("view");
      next.set("entry", entryId);
      return next;
    });
  };

  if (isLoading || (activeView === "map" && mapSettingsLoading)) {
    return <div className={styles.status}>Загружаем мир…</div>;
  }

  if (error || !work) {
    return (
      <div className={styles.status} role="alert">
        {error ? "Не удалось открыть мир. Возможно, он ещё не опубликован." : "Мир не найден или ещё не опубликован."}
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <Link to={`/works/${work.id}`} className={styles.backLink}>
            <ChevronLeft size={15} /> К произведению
          </Link>
          <span className={styles.eyebrow}>МИР / АРХИВ</span>
          <h1 className={styles.title}>{work.title}</h1>
          <p className={styles.subtitle}>
            Энциклопедия, атлас и связанные истории мира
          </p>
          <span className={styles.author}>
            Создатель: {work.author_display_name || work.author_username || "Автор"}
          </span>
        </div>
        <span className={styles.heroKanji} aria-hidden="true">世</span>
      </header>

      <nav className={styles.tabs} aria-label="Разделы мира">
        <button
          className={`${styles.tab} ${activeView === "codex" ? styles.tabActive : ""}`}
          type="button"
          onClick={() => setView("codex")}
          aria-current={activeView === "codex" ? "page" : undefined}
        >
          <BookOpen size={15} /> Энциклопедия
        </button>
        <button
          className={`${styles.tab} ${activeView === "map" ? styles.tabActive : ""}`}
          type="button"
          onClick={() => setView("map")}
          aria-current={activeView === "map" ? "page" : undefined}
        >
          <Map size={15} /> Атлас
        </button>
      </nav>

      <section className={styles.content}>
        {activeView === "codex" ? (
          <WorldCodex workId={work.id} readOnly />
        ) : (
          <PublicWorldMap
            workId={work.id}
            backgroundUrl={mapSettings?.background_url || null}
            settingsError={mapSettingsError}
            onOpenEntry={openEntry}
          />
        )}
      </section>
    </main>
  );
}
