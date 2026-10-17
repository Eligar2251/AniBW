// src/store/authStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@lib/supabase";

// ── Утилита: загрузить профиль с ретраями ──
const loadProfile = async (userId, maxAttempts = 5) => {
  for (let i = 1; i <= maxAttempts; i++) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle(); // maybeSingle не бросает ошибку если нет строк

    if (data) return data;

    // Если ошибка не "не найдено" — прекращаем ретраи
    if (error && error.code !== "PGRST116") {
      console.error("loadProfile error:", error.message);
      return null;
    }

    // Ждём перед следующей попыткой
    if (i < maxAttempts) {
      await new Promise((r) => setTimeout(r, i * 1000));
    }
  }

  return null;
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      session: null,
      loading: true,
      initialized: false,

      setSession: (session) =>
        set({
          session,
          user: session?.user ?? null,
        }),

      setProfile: (profile) => set({ profile }),

      setLoading: (v) => set({ loading: v }),

      // ── Инициализация при старте приложения ──
      initialize: async () => {
        if (get().initialized) {
          set({ loading: false });
          return;
        }

        set({ loading: true });

        try {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            console.error("getSession error:", error.message);
            return;
          }

          set({ session, user: session?.user ?? null });

          if (session?.user) {
            const profile = await loadProfile(session.user.id);
            set({ profile });
          }
        } catch (err) {
          console.error("initialize exception:", err);
        } finally {
          set({ loading: false, initialized: true });
        }
      },

      // ── Выход ──
      signOut: async () => {
        set({ loading: true });

        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.error("signOut error:", err);
        } finally {
          set({
            user: null,
            profile: null,
            session: null,
            loading: false,
            initialized: false,
          });
          window.location.href = "/";
        }
      },

      // ── Обновление профиля ──
      refreshProfile: async () => {
        const { user } = get();
        if (!user?.id) return;

        const profile = await loadProfile(user.id);
        if (profile) set({ profile });
      },

      // ── Хелперы ──
      isAuthor: () => {
        const { profile } = get();
        return ["author", "moderator", "admin"].includes(profile?.role);
      },

      isModerator: () => {
        const { profile } = get();
        return ["moderator", "admin"].includes(profile?.role);
      },

      isAdult: () => {
        const { profile } = get();
        return profile?.is_adult === true;
      },
    }),
    {
      name: "aniscript-auth",
      partialize: (state) => ({
        session: state.session,
        user: state.user,
        profile: state.profile,
      }),
    },
  ),
);
