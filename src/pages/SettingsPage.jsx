// src/pages/SettingsPage.jsx
import { useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@store/authStore";
import { supabase } from "@lib/supabase";
import styles from "./SettingsPage.module.css";

export default function SettingsPage() {
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              className="skeleton"
              style={{ height: 40, width: 200, borderRadius: 4 }}
            />
            <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p style={{ color: "var(--color-text-muted)" }}>
            Профиль не найден. Попробуйте перезайти в аккаунт.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SettingsForm
      key={profile.id}
      profile={profile}
      refreshProfile={refreshProfile}
    />
  );
}

function SettingsForm({ profile, refreshProfile }) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleSave = async (event) => {
    event.preventDefault();
    setSaveError("");
    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("id", profile.id)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Профиль не найден или у вас нет доступа к нему.");

      await refreshProfile();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setSaveError(error.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className={styles.headerKanji} aria-hidden>
            設
          </span>
          <h1 className={styles.title}>Настройки</h1>
        </motion.div>

        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className={styles.cardTitle}>Профиль</h2>

          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="settings-display-name">
                Отображаемое имя
              </label>
              <input
                id="settings-display-name"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className={styles.input}
                placeholder="Твоё имя"
                maxLength={50}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="settings-username">
                Никнейм
              </label>
              <input
                id="settings-username"
                type="text"
                value={profile.username ?? ""}
                className={`${styles.input} ${styles.inputDisabled}`}
                disabled
                readOnly
              />
              <span className={styles.fieldHint}>Никнейм нельзя изменить</span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="settings-bio">О себе</label>
              <textarea
                id="settings-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className={styles.textarea}
                placeholder="Расскажи о себе..."
                rows={4}
                maxLength={500}
              />
              <span className={styles.fieldHint}>{bio.length} / 500</span>
            </div>

            {saveError && (
              <div
                role="alert"
                style={{
                  color: "var(--color-accent)",
                  fontSize: 13,
                  padding: "8px 12px",
                  background: "rgba(232,53,74,0.1)",
                  borderRadius: 4,
                  border: "1px solid rgba(232,53,74,0.2)",
                }}
              >
                {saveError}
              </div>
            )}

            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? "Сохраняю..." : saved ? "✓ Сохранено" : "Сохранить"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
