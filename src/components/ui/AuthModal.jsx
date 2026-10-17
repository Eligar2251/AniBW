// src/components/ui/AuthModal.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { SiDiscord } from "react-icons/si";
import { supabase } from "@lib/supabase";
import { useUIStore } from "@store/uiStore";
import { useAuthStore } from "@store/authStore";
import styles from "./AuthModal.module.css";

export default function AuthModal() {
  const closeAuthModal = useUIStore((s) => s.closeAuthModal);
  const authModalMode = useUIStore((s) => s.authModalMode);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const [mode, setMode] = useState(authModalMode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setUsername("");
    setError("");
    setSuccess("");
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    resetForm();
  };

  // ── Перевод ошибок Supabase ──
  const translateError = (err) => {
    const msg = err?.message ?? "";

    if (
      msg.includes("User already registered") ||
      msg.includes("already registered")
    ) {
      return "Пользователь с таким email уже зарегистрирован. Попробуй войти.";
    }
    if (msg.includes("Invalid login credentials")) {
      return "Неверный email или пароль";
    }
    if (msg.includes("Email not confirmed")) {
      return "Подтвердите email перед входом";
    }
    if (msg.includes("Password should be")) {
      return "Пароль должен содержать минимум 6 символов";
    }
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return "Этот никнейм уже занят, попробуй другой";
    }
    if (msg.includes("Unable to validate email")) {
      return "Некорректный email адрес";
    }
    if (msg.includes("signup_disabled")) {
      return "Регистрация временно отключена";
    }
    return msg || "Неизвестная ошибка";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // ── Клиентская валидация ──
    if (mode === "register") {
      const trimmed = username.trim();
      if (trimmed.length < 3) {
        setError("Никнейм должен содержать минимум 3 символа");
        return;
      }
      if (trimmed.length > 30) {
        setError("Никнейм не может быть длиннее 30 символов");
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        setError("Никнейм может содержать только латинские буквы, цифры и _");
        return;
      }
    }

    if (!email.trim()) {
      setError("Введите email");
      return;
    }

    if (password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        // ── ВХОД ──
        const { data, error: signInErr } =
          await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });

        if (signInErr) throw signInErr;

        if (data?.user) {
          await refreshProfile();
          closeAuthModal();
        }
      } else {
        // ── РЕГИСТРАЦИЯ ──

        // Сначала проверяем — не занят ли никнейм
        const cleanUsername = username.trim().toLowerCase();
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", cleanUsername)
          .maybeSingle();

        if (existingProfile) {
          setError("Этот никнейм уже занят, попробуй другой");
          return;
        }

        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              username: cleanUsername,
              full_name: username.trim(),
            },
          },
        });

        if (signUpErr) throw signUpErr;

        // Email confirmation включён — пользователь ещё не активен
        if (data?.user && !data?.session) {
          setSuccess(
            `Письмо с подтверждением отправлено на ${email.trim()}. Проверь почту!`,
          );
          return;
        }

        // Email confirmation выключён — пользователь сразу активен
        if (data?.user && data?.session) {
          setSuccess("Аккаунт создан! Добро пожаловать 🎉");

          // Ждём пока триггер создаст профиль
          let profileReady = false;
          for (let attempt = 1; attempt <= 6; attempt++) {
            await new Promise((r) => setTimeout(r, attempt * 800));

            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("id", data.user.id)
              .maybeSingle();

            if (profile) {
              profileReady = true;
              break;
            }
          }

          // Fallback — создаём профиль вручную если триггер не сработал
          if (!profileReady) {
            const fallback =
              cleanUsername + "_" + Math.floor(Math.random() * 9999);
            await supabase.from("profiles").insert({
              id: data.user.id,
              username: fallback,
              display_name: username.trim(),
            });
          }

          await refreshProfile();
          setTimeout(() => closeAuthModal(), 1000);
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      setError(translateError(err));
      setLoading(false);
    }
  };

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && closeAuthModal()}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Декор */}
        <span className={styles.modalKanji} aria-hidden>
          {mode === "login" ? "入" : "始"}
        </span>

        {/* Закрыть */}
        <button
          className={styles.closeBtn}
          onClick={closeAuthModal}
          type="button"
          disabled={loading}
        >
          <X size={18} strokeWidth={1.5} />
        </button>

        {/* Заголовок */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {mode === "login" ? "Добро пожаловать" : "Присоединиться"}
          </h2>
          <p className={styles.modalSub}>
            {mode === "login"
              ? "Войди в свой аккаунт AniScript"
              : "Создай аккаунт — это бесплатно"}
          </p>
        </div>

        {/* OAuth */}
        <div className={styles.oauthRow}>
          <button
            className={styles.oauthBtn}
            onClick={() => handleOAuth("google")}
            type="button"
            disabled={loading}
          >
            <FcGoogle size={18} />
            <span>Google</span>
          </button>
          <button
            className={`${styles.oauthBtn} ${styles.oauthDiscord}`}
            onClick={() => handleOAuth("discord")}
            type="button"
            disabled={loading}
          >
            <SiDiscord size={16} color="#5865F2" />
            <span>Discord</span>
          </button>
        </div>

        <div className={styles.orDivider}>
          <span className={styles.orLine} />
          <span className={styles.orText}>или</span>
          <span className={styles.orLine} />
        </div>

        {/* Форма */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* Никнейм — только при регистрации */}
          <AnimatePresence>
            {mode === "register" && (
              <motion.div
                className={styles.formField}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                key="username-field"
              >
                <label className={styles.label}>Никнейм</label>
                <div className={styles.inputWrap}>
                  <User
                    size={15}
                    className={styles.inputIcon}
                    strokeWidth={1.5}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={styles.input}
                    placeholder="твой_ник"
                    autoComplete="username"
                    maxLength={30}
                    disabled={loading}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div className={styles.formField}>
            <label className={styles.label}>Email</label>
            <div className={styles.inputWrap}>
              <Mail size={15} className={styles.inputIcon} strokeWidth={1.5} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder="anime@mail.ru"
                autoComplete="email"
                disabled={loading}
              />
            </div>
          </div>

          {/* Пароль */}
          <div className={styles.formField}>
            <label className={styles.label}>Пароль</label>
            <div className={styles.inputWrap}>
              <Lock size={15} className={styles.inputIcon} strokeWidth={1.5} />
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="••••••••"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                disabled={loading}
              />
              <button
                type="button"
                className={styles.showPassBtn}
                onClick={() => setShowPass((v) => !v)}
                disabled={loading}
              >
                {showPass ? (
                  <EyeOff size={14} strokeWidth={1.5} />
                ) : (
                  <Eye size={14} strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          {/* Сообщения об ошибках / успехе */}
          <AnimatePresence>
            {error && (
              <motion.div
                className={styles.errorMsg}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                key="error"
              >
                {error}
                {/* Подсказка: если email занят — предлагаем войти */}
                {error.includes("уже зарегистрирован") && (
                  <button
                    type="button"
                    className={styles.switchBtn}
                    style={{ marginTop: 6, display: "block" }}
                    onClick={() => switchMode("login")}
                  >
                    → Войти в аккаунт
                  </button>
                )}
              </motion.div>
            )}
            {success && (
              <motion.div
                className={styles.successMsg}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                key="success"
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (
              <span className={styles.spinner} />
            ) : mode === "login" ? (
              "Войти"
            ) : (
              "Создать аккаунт"
            )}
          </button>
        </form>

        {/* Переключение режима */}
        <div className={styles.switchMode}>
          {mode === "login" ? (
            <>
              <span>Нет аккаунта?</span>
              <button
                className={styles.switchBtn}
                onClick={() => switchMode("register")}
                type="button"
                disabled={loading}
              >
                Зарегистрироваться
              </button>
            </>
          ) : (
            <>
              <span>Уже есть аккаунт?</span>
              <button
                className={styles.switchBtn}
                onClick={() => switchMode("login")}
                type="button"
                disabled={loading}
              >
                Войти
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
