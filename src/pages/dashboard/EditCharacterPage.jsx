// src/pages/dashboard/EditCharacterPage.jsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@lib/supabase";
import CharacterForm from "./CharacterForm";
import styles from "./CharacterFormPage.module.css";

function useCharacter(id) {
  return useQuery({
    queryKey: ["character-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("characters")
        .select(
          `
          *,
          badges:character_badges(*),
          abilities:character_abilities(*)
        `,
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export default function EditCharacterPage() {
  const { id } = useParams();
  const { data: character, isLoading, error } = useCharacter(id);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            className="skeleton"
            style={{ height: 40, width: 300, borderRadius: 4 }}
          />
          <div className="skeleton" style={{ height: 400, borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className={styles.page}>
        <p style={{ color: "var(--color-text-muted)" }}>Персонаж не найден</p>
      </div>
    );
  }

  return <CharacterForm character={character} />;
}
