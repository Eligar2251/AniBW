// src/pages/dashboard/board/CharacterGraph.jsx
import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Save,
  X,
  Heart,
  Swords,
  Users,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { getCloudinaryUrl, transforms } from "@lib/cloudinary";
import styles from "./CharacterGraph.module.css";

const RELATION_TYPES = [
  { value: "ally", label: "Союзник", color: "#10B981", icon: Users },
  { value: "enemy", label: "Враг", color: "#E8354A", icon: Swords },
  { value: "love", label: "Любовь", color: "#EC4899", icon: Heart },
  { value: "family", label: "Семья", color: "#F0A830", icon: Users },
  { value: "rival", label: "Соперник", color: "#8B5CF6", icon: Swords },
  { value: "mentor", label: "Наставник", color: "#5B9BD5", icon: Users },
  { value: "unknown", label: "Другое", color: "#6B7280", icon: HelpCircle },
];

function useCharacters(workId) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["graph-characters", workId],
    queryFn: async () => {
      const { data } = await supabase
        .from("characters")
        .select("id, full_name, nickname, avatar_url, primary_color, role")
        .eq("author_id", user.id)
        .order("full_name");
      return data || [];
    },
    enabled: !!user,
  });
}

function useRelations(workId) {
  return useQuery({
    queryKey: ["character-relations", workId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("character_relations")
        .select("*")
        .eq("work_id", workId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!workId,
  });
}

export default function CharacterGraph({ workId }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const svgRef = useRef(null);

  const { data: characters = [] } = useCharacters(workId);
  const { data: relations = [] } = useRelations(workId);

  const [addingRelation, setAddingRelation] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [relType, setRelType] = useState("ally");
  const [relLabel, setRelLabel] = useState("");

  const [selectedRelation, setSelectedRelation] = useState(null);

  // Позиции узлов (по кругу)
  const nodePositions = useMemo(() => {
    const positions = {};
    const count = characters.length;
    const centerX = 400;
    const centerY = 300;
    const radius = Math.min(250, 80 + count * 20);

    characters.forEach((char, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      positions[char.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    return positions;
  }, [characters]);

  const addRelation = useMutation({
    mutationFn: async () => {
      if (!sourceId || !targetId || sourceId === targetId)
        throw new Error("Выбери двух разных персонажей");
      const { error } = await supabase.from("character_relations").insert({
        work_id: workId,
        author_id: user.id,
        source_character_id: sourceId,
        target_character_id: targetId,
        relation_type: relType,
        label: relLabel,
        color:
          RELATION_TYPES.find((r) => r.value === relType)?.color || "#6B7280",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["character-relations", workId],
      });
      setAddingRelation(false);
      setSourceId("");
      setTargetId("");
      setRelLabel("");
    },
  });

  const removeRelation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("character_relations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedRelation(null);
      queryClient.invalidateQueries({
        queryKey: ["character-relations", workId],
      });
    },
  });

  if (characters.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyKanji}>縁</span>
        <p>Сначала создай персонажей</p>
        <span className={styles.emptyHint}>
          Перейди в раздел «Персонажи» и добавь хотя бы двух
        </span>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Тулбар */}
      <div className={styles.toolbar}>
        <button
          className={styles.toolBtn}
          onClick={() => setAddingRelation(!addingRelation)}
        >
          <Plus size={14} strokeWidth={1.5} />
          {addingRelation ? "Отмена" : "Связь"}
        </button>
        <span className={styles.toolInfo}>
          {characters.length} персонажей · {relations.length} связей
        </span>
      </div>

      {/* Форма добавления */}
      <AnimatePresence>
        {addingRelation && (
          <motion.div
            className={styles.addForm}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className={styles.formSelect}
            >
              <option value="">Персонаж 1...</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>

            <select
              value={relType}
              onChange={(e) => setRelType(e.target.value)}
              className={styles.formSelect}
            >
              {RELATION_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={styles.formSelect}
            >
              <option value="">Персонаж 2...</option>
              {characters
                .filter((c) => c.id !== sourceId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
            </select>

            <input
              type="text"
              value={relLabel}
              onChange={(e) => setRelLabel(e.target.value)}
              className={styles.formInput}
              placeholder="Подпись (опционально)"
            />

            <button
              className={styles.formSubmit}
              onClick={() => addRelation.mutate()}
              disabled={!sourceId || !targetId || addRelation.isPending}
            >
              <Plus size={13} /> Добавить
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SVG Граф */}
      <div className={styles.graphContainer}>
        <svg ref={svgRef} viewBox="0 0 800 600" className={styles.graphSvg}>
          {/* Связи (линии) */}
          {relations.map((rel) => {
            const from = nodePositions[rel.source_character_id];
            const to = nodePositions[rel.target_character_id];
            if (!from || !to) return null;

            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2 - 15;

            return (
              <g
                key={rel.id}
                onClick={() => setSelectedRelation(rel)}
                style={{ cursor: "pointer" }}
              >
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={rel.color}
                  strokeWidth="2"
                  strokeOpacity="0.6"
                  strokeDasharray={
                    rel.relation_type === "enemy" ? "6,4" : "none"
                  }
                />
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="transparent"
                  strokeWidth="12"
                />
                {rel.label && (
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    fill={rel.color}
                    fontSize="10"
                    fontFamily="var(--font-ui)"
                    style={{ letterSpacing: "0.05em" }}
                  >
                    {rel.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Узлы (персонажи) */}
          {characters.map((char) => {
            const pos = nodePositions[char.id];
            if (!pos) return null;
            const color = char.primary_color || "#6366F1";
            const avatarUrl = getCloudinaryUrl(
              char.avatar_url,
              transforms.avatarSm,
            );

            return (
              <g key={char.id}>
                {/* Круг */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="28"
                  fill="var(--color-bg-raised)"
                  stroke={color}
                  strokeWidth="2"
                />
                {/* Аватар (clipPath) */}
                <defs>
                  <clipPath id={`clip-${char.id}`}>
                    <circle cx={pos.x} cy={pos.y} r="26" />
                  </clipPath>
                </defs>
                {avatarUrl ? (
                  <image
                    href={avatarUrl}
                    x={pos.x - 26}
                    y={pos.y - 26}
                    width="52"
                    height="52"
                    clipPath={`url(#clip-${char.id})`}
                  />
                ) : (
                  <text
                    x={pos.x}
                    y={pos.y + 5}
                    textAnchor="middle"
                    fill={color}
                    fontSize="16"
                    fontWeight="700"
                    fontFamily="var(--font-display)"
                  >
                    {char.full_name?.[0]}
                  </text>
                )}
                {/* Имя */}
                <text
                  x={pos.x}
                  y={pos.y + 42}
                  textAnchor="middle"
                  fill="var(--color-text-primary)"
                  fontSize="11"
                  fontFamily="var(--font-display)"
                  fontWeight="600"
                >
                  {char.full_name}
                </text>
                {char.nickname && (
                  <text
                    x={pos.x}
                    y={pos.y + 54}
                    textAnchor="middle"
                    fill="var(--color-text-muted)"
                    fontSize="9"
                    fontFamily="var(--font-body)"
                    fontStyle="italic"
                  >
                    «{char.nickname}»
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Легенда */}
        <div className={styles.legend}>
          {RELATION_TYPES.map((r) => (
            <span key={r.value} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: r.color }}
              />
              {r.label}
            </span>
          ))}
        </div>

        {/* Фоновый декор */}
        <span className={styles.graphBgKanji} aria-hidden>
          縁
        </span>
      </div>

      {/* Панель выбранной связи */}
      <AnimatePresence>
        {selectedRelation && (
          <motion.div
            className={styles.relationPanel}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className={styles.relationHeader}>
              <span>
                Связь:{" "}
                {
                  RELATION_TYPES.find(
                    (r) => r.value === selectedRelation.relation_type,
                  )?.label
                }
              </span>
              <button onClick={() => setSelectedRelation(null)}>
                <X size={14} />
              </button>
            </div>
            {selectedRelation.label && (
              <p className={styles.relationLabel}>{selectedRelation.label}</p>
            )}
            <button
              className={styles.relationRemove}
              onClick={() => removeRelation.mutate(selectedRelation.id)}
            >
              <Trash2 size={12} /> Удалить связь
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
