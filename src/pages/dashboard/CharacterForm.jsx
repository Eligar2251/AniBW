// src/pages/dashboard/CharacterForm.jsx
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Save } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";
import { uploadToCloudinary } from "@lib/cloudinary";
import styles from "./CharacterFormPage.module.css";
import AvatarCropper from "@components/ui/AvatarCropper";

const MBTI_TYPES = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
];

const ROLES = [
  { value: "protagonist", label: "Протагонист" },
  { value: "antagonist", label: "Антагонист" },
  { value: "supporting", label: "Второстепенный" },
  { value: "minor", label: "Эпизодический" },
  { value: "mentioned", label: "Упоминается" },
];

const SECTIONS = [
  { id: "basic", label: "Основное" },
  { id: "appear", label: "Внешность" },
  { id: "psycho", label: "Психология" },
  { id: "skills", label: "Навыки" },
  { id: "badges", label: "Бейджи" },
];

const DEFAULT_FORM = {
  full_name: "",
  nickname: "",
  role: "supporting",
  work_id: "",
  age: "",
  gender: "",
  pronouns: "",
  species: "",
  affiliation: "",
  height: "",
  weight: "",
  body_type: "",
  hair_color: "",
  eye_color: "",
  skin_tone: "",
  distinctive_features: "",
  mbti: "",
  hogwarts_house: "",
  backstory: "",
  goals: "",
  motivation: "",
  fears: "",
  secrets: "",
  primary_color: "#6366F1",
  speech_color: "#F59E0B",
  is_oc: false,
};

function useMyWorks() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["my-works-select", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("works")
        .select("id, title")
        .eq("author_id", user.id)
        .order("title");
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

function initFormFromCharacter(char) {
  if (!char) return DEFAULT_FORM;
  return {
    full_name: char.full_name ?? "",
    nickname: char.nickname ?? "",
    role: char.role ?? "supporting",
    work_id: char.work_id ?? "",
    age: char.age ?? "",
    gender: char.gender ?? "",
    pronouns: char.pronouns ?? "",
    species: char.species ?? "",
    affiliation: char.affiliation ?? "",
    height: char.height ?? "",
    weight: char.weight ?? "",
    body_type: char.body_type ?? "",
    hair_color: char.hair_color ?? "",
    eye_color: char.eye_color ?? "",
    skin_tone: char.skin_tone ?? "",
    distinctive_features: char.distinctive_features ?? "",
    mbti: char.mbti ?? "",
    hogwarts_house: char.hogwarts_house ?? "",
    backstory: char.backstory ?? "",
    goals: char.goals ?? "",
    motivation: char.motivation ?? "",
    fears: char.fears ?? "",
    secrets: char.secrets ?? "",
    primary_color: char.primary_color ?? "#6366F1",
    speech_color: char.speech_color ?? "#F59E0B",
    is_oc: char.is_oc ?? false,
  };
}

export default function CharacterForm({ character = null }) {
  const isEdit = !!character;
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data: myWorks = [] } = useMyWorks();

  const [form, setForm] = useState(() => initFormFromCharacter(character));
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(
    character?.avatar_url ?? null,
  );
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [strengths, setStrengths] = useState(
    character?.strengths?.length ? character.strengths : [""],
  );
  const [avatarScale, setAvatarScale] = useState(
    character?.avatar_scale ?? 1.0,
  );
  const [avatarOffsetX, setAvatarOffsetX] = useState(
    character?.avatar_offset_x ?? 50,
  );
  const [avatarOffsetY, setAvatarOffsetY] = useState(
    character?.avatar_offset_y ?? 0,
  );

  const [weaknesses, setWeaknesses] = useState(
    character?.weaknesses?.length ? character.weaknesses : [""],
  );
  const [abilities, setAbilities] = useState(character?.abilities ?? []);
  const [badges, setBadges] = useState(character?.badges ?? []);
  const [newBadge, setNewBadge] = useState({
    label: "",
    category: "custom",
    color: "#6366F1",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState("basic");

  const set = useCallback(
    (key, val) => setForm((f) => ({ ...f, [key]: val })),
    [],
  );

  const buildPayload = async () => {
    let avatar_url = character?.avatar_url ?? null;

    if (avatarFile) {
      const res = await uploadToCloudinary(avatarFile, "aniscript/characters");
      avatar_url = res.secure_url;
    }

    return {
      full_name: form.full_name.trim(),
      nickname: form.nickname.trim() || null,
      role: form.role,
      work_id: form.work_id || null,
      age: form.age.trim() || null,
      gender: form.gender.trim() || null,
      pronouns: form.pronouns.trim() || null,
      species: form.species.trim() || null,
      affiliation: form.affiliation.trim() || null,
      height: form.height.trim() || null,
      weight: form.weight.trim() || null,
      body_type: form.body_type.trim() || null,
      hair_color: form.hair_color.trim() || null,
      eye_color: form.eye_color.trim() || null,
      skin_tone: form.skin_tone.trim() || null,
      distinctive_features: form.distinctive_features.trim() || null,
      mbti: form.mbti || null,
      hogwarts_house: form.hogwarts_house || null,
      backstory: form.backstory.trim() || null,
      goals: form.goals.trim() || null,
      motivation: form.motivation.trim() || null,
      fears: form.fears.trim() || null,
      secrets: form.secrets.trim() || null,
      primary_color: form.primary_color,
      speech_color: form.speech_color,
      is_oc: form.is_oc,
      strengths: strengths.filter(Boolean),
      weaknesses: weaknesses.filter(Boolean),
      avatar_url,
      avatar_scale: avatarScale,
      avatar_offset_x: avatarOffsetX,
      avatar_offset_y: avatarOffsetY,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      setError("");
      if (!user?.id) throw new Error("Не авторизован");

      const payload = await buildPayload();

      if (isEdit) {
        const { error: upErr } = await supabase
          .from("characters")
          .update(payload)
          .eq("id", character.id);
        if (upErr) throw upErr;

        await supabase
          .from("character_badges")
          .delete()
          .eq("character_id", character.id);

        if (badges.length > 0) {
          await supabase.from("character_badges").insert(
            badges.map((b, i) => ({
              character_id: character.id,
              label: b.label,
              category: b.category,
              color: b.color,
              sort_order: i,
            })),
          );
        }

        await supabase
          .from("character_abilities")
          .delete()
          .eq("character_id", character.id);

        if (abilities.filter((a) => a.name?.trim()).length > 0) {
          await supabase.from("character_abilities").insert(
            abilities
              .filter((a) => a.name?.trim())
              .map((a, i) => ({
                character_id: character.id,
                name: a.name.trim(),
                description: a.description?.trim() || null,
                level: a.level || 5,
                sort_order: i,
              })),
          );
        }

        return { id: character.id };
      } else {
        const { data: char, error: charErr } = await supabase
          .from("characters")
          .insert({ ...payload, author_id: user.id })
          .select("id")
          .single();
        if (charErr) throw charErr;

        if (badges.length > 0) {
          await supabase.from("character_badges").insert(
            badges.map((b, i) => ({
              character_id: char.id,
              label: b.label,
              category: b.category,
              color: b.color,
              sort_order: i,
            })),
          );
        }

        if (abilities.filter((a) => a.name?.trim()).length > 0) {
          await supabase.from("character_abilities").insert(
            abilities
              .filter((a) => a.name?.trim())
              .map((a, i) => ({
                character_id: char.id,
                name: a.name.trim(),
                description: a.description?.trim() || null,
                level: a.level || 5,
                sort_order: i,
              })),
          );
        }

        return char;
      }
    },

    onSuccess: (char) => {
      if (isEdit) {
        queryClient.invalidateQueries({
          queryKey: ["character-edit", character.id],
        });
        queryClient.invalidateQueries({ queryKey: ["my-characters"] });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        navigate(`/dashboard/characters/${char.id}`);
      }
    },

    onError: (err) => {
      console.error("Save character error:", err);
      setError(err.message || "Ошибка сохранения");
    },
  });

  const isPending = saveMutation.isPending;

  return (
    <div className={styles.page}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span className={styles.headerKanji} aria-hidden>
          {isEdit ? "編" : "人"}
        </span>
        <h1 className={styles.title}>
          {isEdit ? `Редактирование: ${character.full_name}` : "Новый персонаж"}
        </h1>
      </motion.div>

      <div className={styles.layout}>
        <div className={styles.leftPanel}>
          <AvatarCropper
            src={avatarPreview}
            scale={avatarScale}
            offsetX={avatarOffsetX}
            offsetY={avatarOffsetY}
            disabled={isPending}
            onChange={({ scale, offsetX, offsetY }) => {
              setAvatarScale(scale);
              setAvatarOffsetX(offsetX);
              setAvatarOffsetY(offsetY);
            }}
            onFileSelect={(file) => {
              setAvatarFile(file);
              setAvatarPreview(URL.createObjectURL(file));
            }}
          />

          <div className={styles.colorSection}>
            {[
              { key: "primary_color", label: "Основной цвет" },
              { key: "speech_color", label: "Цвет реплик" },
            ].map(({ key, label }) => (
              <div key={key} className={styles.colorField}>
                <span className={styles.colorLabel}>{label}</span>
                <div
                  className={styles.colorSwatch}
                  style={{ background: form[key] }}
                  onClick={() =>
                    setShowColorPicker(showColorPicker === key ? null : key)
                  }
                >
                  <span>{form[key]}</span>
                </div>
                {showColorPicker === key && (
                  <div className={styles.colorPickerWrap}>
                    <HexColorPicker
                      color={form[key]}
                      onChange={(c) => set(key, c)}
                    />
                    <button
                      type="button"
                      className={styles.colorPickerClose}
                      onClick={() => setShowColorPicker(null)}
                    >
                      Закрыть
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <label className={styles.ocLabel}>
            <input
              type="checkbox"
              checked={form.is_oc}
              onChange={(e) => set("is_oc", e.target.checked)}
              className={styles.checkbox}
              disabled={isPending}
            />
            <span>Оригинальный персонаж (OC)</span>
          </label>
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.sectionNav}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.sectionBtn} ${activeSection === s.id ? styles.sectionBtnActive : ""}`}
                onClick={() => setActiveSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {activeSection === "basic" && (
            <div className={styles.section}>
              <div className={styles.fieldGrid2}>
                <Field label="Полное имя *">
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => set("full_name", e.target.value)}
                    className={styles.input}
                    placeholder="Имя персонажа"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Псевдоним / прозвище">
                  <input
                    type="text"
                    value={form.nickname}
                    onChange={(e) => set("nickname", e.target.value)}
                    className={styles.input}
                    placeholder="Прозвище"
                    disabled={isPending}
                  />
                </Field>
              </div>

              <div className={styles.fieldGrid2}>
                <Field label="Роль в истории">
                  <select
                    value={form.role}
                    onChange={(e) => set("role", e.target.value)}
                    className={styles.select}
                    disabled={isPending}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Произведение">
                  <select
                    value={form.work_id}
                    onChange={(e) => set("work_id", e.target.value)}
                    className={styles.select}
                    disabled={isPending}
                  >
                    <option value="">Без произведения</option>
                    {myWorks.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className={styles.fieldGrid3}>
                <Field label="Возраст">
                  <input
                    type="text"
                    value={form.age}
                    onChange={(e) => set("age", e.target.value)}
                    className={styles.input}
                    placeholder="17"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Пол">
                  <input
                    type="text"
                    value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}
                    className={styles.input}
                    placeholder="Мужской"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Местоимения">
                  <input
                    type="text"
                    value={form.pronouns}
                    onChange={(e) => set("pronouns", e.target.value)}
                    className={styles.input}
                    placeholder="он/его"
                    disabled={isPending}
                  />
                </Field>
              </div>

              <div className={styles.fieldGrid2}>
                <Field label="Раса / вид">
                  <input
                    type="text"
                    value={form.species}
                    onChange={(e) => set("species", e.target.value)}
                    className={styles.input}
                    placeholder="Человек"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Принадлежность / фракция">
                  <input
                    type="text"
                    value={form.affiliation}
                    onChange={(e) => set("affiliation", e.target.value)}
                    className={styles.input}
                    placeholder="Лига героев"
                    disabled={isPending}
                  />
                </Field>
              </div>

              <Field label="Предыстория">
                <textarea
                  value={form.backstory}
                  onChange={(e) => set("backstory", e.target.value)}
                  className={styles.textarea}
                  placeholder="История персонажа..."
                  rows={5}
                  disabled={isPending}
                />
              </Field>
            </div>
          )}

          {activeSection === "appear" && (
            <div className={styles.section}>
              <div className={styles.fieldGrid3}>
                <Field label="Рост">
                  <input
                    type="text"
                    value={form.height}
                    onChange={(e) => set("height", e.target.value)}
                    className={styles.input}
                    placeholder="175 см"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Вес">
                  <input
                    type="text"
                    value={form.weight}
                    onChange={(e) => set("weight", e.target.value)}
                    className={styles.input}
                    placeholder="65 кг"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Телосложение">
                  <input
                    type="text"
                    value={form.body_type}
                    onChange={(e) => set("body_type", e.target.value)}
                    className={styles.input}
                    placeholder="Атлетическое"
                    disabled={isPending}
                  />
                </Field>
              </div>
              <div className={styles.fieldGrid3}>
                <Field label="Цвет волос">
                  <input
                    type="text"
                    value={form.hair_color}
                    onChange={(e) => set("hair_color", e.target.value)}
                    className={styles.input}
                    placeholder="Чёрный"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Цвет глаз">
                  <input
                    type="text"
                    value={form.eye_color}
                    onChange={(e) => set("eye_color", e.target.value)}
                    className={styles.input}
                    placeholder="Серый"
                    disabled={isPending}
                  />
                </Field>
                <Field label="Тон кожи">
                  <input
                    type="text"
                    value={form.skin_tone}
                    onChange={(e) => set("skin_tone", e.target.value)}
                    className={styles.input}
                    placeholder="Светлый"
                    disabled={isPending}
                  />
                </Field>
              </div>
              <Field label="Особые приметы">
                <textarea
                  value={form.distinctive_features}
                  onChange={(e) => set("distinctive_features", e.target.value)}
                  className={styles.textarea}
                  placeholder="Шрам на щеке, татуировка..."
                  rows={3}
                  disabled={isPending}
                />
              </Field>
            </div>
          )}

          {activeSection === "psycho" && (
            <div className={styles.section}>
              <div className={styles.fieldGrid2}>
                <Field label="Тип личности (MBTI)">
                  <select
                    value={form.mbti}
                    onChange={(e) => set("mbti", e.target.value)}
                    className={styles.select}
                    disabled={isPending}
                  >
                    <option value="">Не указан</option>
                    {MBTI_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Факультет Хогвартса">
                  <select
                    value={form.hogwarts_house}
                    onChange={(e) => set("hogwarts_house", e.target.value)}
                    className={styles.select}
                    disabled={isPending}
                  >
                    <option value="">Не указан</option>
                    <option value="Gryffindor">Гриффиндор</option>
                    <option value="Slytherin">Слизерин</option>
                    <option value="Ravenclaw">Когтевран</option>
                    <option value="Hufflepuff">Пуффендуй</option>
                  </select>
                </Field>
              </div>

              <ListField
                label="Сильные стороны"
                items={strengths}
                setItems={setStrengths}
                placeholder="Сильная сторона..."
                disabled={isPending}
              />
              <ListField
                label="Слабости"
                items={weaknesses}
                setItems={setWeaknesses}
                placeholder="Слабость..."
                disabled={isPending}
              />

              <Field label="Цели">
                <textarea
                  value={form.goals}
                  onChange={(e) => set("goals", e.target.value)}
                  className={styles.textarea}
                  rows={3}
                  placeholder="Чего хочет достичь персонаж?"
                  disabled={isPending}
                />
              </Field>
              <Field label="Мотивация">
                <textarea
                  value={form.motivation}
                  onChange={(e) => set("motivation", e.target.value)}
                  className={styles.textarea}
                  rows={3}
                  placeholder="Что движет персонажем?"
                  disabled={isPending}
                />
              </Field>
              <Field label="Страхи">
                <textarea
                  value={form.fears}
                  onChange={(e) => set("fears", e.target.value)}
                  className={styles.textarea}
                  rows={2}
                  placeholder="Чего боится персонаж?"
                  disabled={isPending}
                />
              </Field>
              <Field label="Секреты">
                <textarea
                  value={form.secrets}
                  onChange={(e) => set("secrets", e.target.value)}
                  className={styles.textarea}
                  rows={2}
                  placeholder="Что скрывает персонаж?"
                  disabled={isPending}
                />
              </Field>
            </div>
          )}

          {activeSection === "skills" && (
            <div className={styles.section}>
              <div className={styles.abilitiesList}>
                {abilities.map((ab, i) => (
                  <div key={i} className={styles.abilityItem}>
                    <input
                      type="text"
                      value={ab.name ?? ""}
                      onChange={(e) => {
                        const next = [...abilities];
                        next[i] = { ...next[i], name: e.target.value };
                        setAbilities(next);
                      }}
                      className={styles.input}
                      placeholder="Название навыка"
                      disabled={isPending}
                    />
                    <div className={styles.abilityLevel}>
                      <span className={styles.abilityLevelLabel}>
                        Ур. {ab.level}/10
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={ab.level ?? 5}
                        onChange={(e) => {
                          const next = [...abilities];
                          next[i] = {
                            ...next[i],
                            level: Number(e.target.value),
                          };
                          setAbilities(next);
                        }}
                        className={styles.levelSlider}
                        disabled={isPending}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() =>
                        setAbilities(abilities.filter((_, j) => j !== i))
                      }
                      disabled={isPending}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.addAbilityBtn}
                  onClick={() =>
                    setAbilities([
                      ...abilities,
                      { name: "", description: "", level: 5 },
                    ])
                  }
                  disabled={isPending}
                >
                  <Plus size={14} strokeWidth={1.5} />
                  Добавить навык
                </button>
              </div>
            </div>
          )}

          {activeSection === "badges" && (
            <div className={styles.section}>
              <div className={styles.badgesList}>
                {badges.map((b, i) => (
                  <div
                    key={i}
                    className={styles.badgeItem}
                    style={{
                      background: b.color + "22",
                      borderColor: b.color + "55",
                    }}
                  >
                    <span style={{ color: b.color }}>{b.label}</span>
                    <button
                      type="button"
                      className={styles.removeBadgeBtn}
                      onClick={() =>
                        setBadges(badges.filter((_, j) => j !== i))
                      }
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>

              <div className={styles.addBadgeForm}>
                <input
                  type="text"
                  value={newBadge.label}
                  onChange={(e) =>
                    setNewBadge((b) => ({ ...b, label: e.target.value }))
                  }
                  className={styles.input}
                  placeholder="Название бейджа..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!newBadge.label.trim()) return;
                      setBadges([...badges, { ...newBadge }]);
                      setNewBadge({
                        label: "",
                        category: "custom",
                        color: "#6366F1",
                      });
                    }
                  }}
                  disabled={isPending}
                />
                <select
                  value={newBadge.category}
                  onChange={(e) =>
                    setNewBadge((b) => ({ ...b, category: e.target.value }))
                  }
                  className={styles.select}
                  disabled={isPending}
                >
                  <option value="archetype">Архетип</option>
                  <option value="role">Роль</option>
                  <option value="trait">Черта</option>
                  <option value="hobby">Хобби</option>
                  <option value="custom">Кастомный</option>
                </select>
                <div
                  className={styles.badgeColorSwatch}
                  style={{ background: newBadge.color }}
                />
                <button
                  type="button"
                  className={styles.addBadgeBtn}
                  onClick={() => {
                    if (!newBadge.label.trim()) return;
                    setBadges([...badges, { ...newBadge }]);
                    setNewBadge({
                      label: "",
                      category: "custom",
                      color: "#6366F1",
                    });
                  }}
                  disabled={isPending}
                >
                  <Plus size={14} strokeWidth={1.5} />
                  Добавить
                </button>
              </div>
            </div>
          )}

          {error && (
            <motion.div
              className={styles.error}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => navigate("/dashboard/characters")}
              disabled={isPending}
            >
              {isEdit ? "Назад" : "Отмена"}
            </button>
            <button
              type="button"
              className={styles.submitBtn}
              disabled={isPending || !form.full_name.trim()}
              onClick={() => saveMutation.mutate()}
            >
              {isPending ? (
                <span className={styles.spinner} />
              ) : saved ? (
                "✓ Сохранено"
              ) : isEdit ? (
                <>
                  <Save size={14} strokeWidth={1.5} />
                  Сохранить
                </>
              ) : (
                "Создать персонажа"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function ListField({ label, items, setItems, placeholder, disabled }) {
  return (
    <Field label={label}>
      <div className={styles.listItems}>
        {items.map((item, i) => (
          <div key={i} className={styles.listItem}>
            <input
              type="text"
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                setItems(next);
              }}
              className={styles.input}
              placeholder={placeholder}
              disabled={disabled}
            />
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              disabled={disabled}
            >
              <X size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addListItemBtn}
          onClick={() => setItems([...items, ""])}
          disabled={disabled}
        >
          <Plus size={13} strokeWidth={1.5} />
          Добавить
        </button>
      </div>
    </Field>
  );
}
