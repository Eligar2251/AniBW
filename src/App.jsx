// src/App.jsx
import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { supabase } from "@lib/supabase";
import { useAuthStore } from "@store/authStore";

import Layout from "@components/layout/Layout";
import ReaderLayout from "@components/layout/ReaderLayout";
import DashboardLayout from "@components/layout/DashboardLayout";
import ProtectedRoute from "@components/layout/ProtectedRoute";
import PageLoader from "@components/ui/PageLoader";

// ── Публичные страницы ──
const HomePage = lazy(() => import("@pages/HomePage"));
const WorksPage = lazy(() => import("@pages/WorksPage"));
const WorkPage = lazy(() => import("@pages/WorkPage"));
const ReaderPage = lazy(() => import("@pages/ReaderPage"));
const FandomPage = lazy(() => import("@pages/FandomPage"));
const SearchPage = lazy(() => import("@pages/SearchPage"));
const ProfilePage = lazy(() => import("@pages/ProfilePage"));
const BookmarksPage = lazy(() => import("@pages/BookmarksPage"));
const SettingsPage = lazy(() => import("@pages/SettingsPage"));
const NotFoundPage = lazy(() => import("@pages/NotFoundPage"));

// ── Дашборд ──
const DashboardHome = lazy(() => import("@pages/dashboard/DashboardHome"));
const MyWorksPage = lazy(() => import("@pages/dashboard/MyWorksPage"));
const NewWorkPage = lazy(() => import("@pages/dashboard/NewWorkPage"));
const EditWorkPage = lazy(() => import("@pages/dashboard/EditWorkPage"));
const ChapterEditorPage = lazy(() => import("@pages/dashboard/ChapterEditor"));
const CharactersPage = lazy(() => import("@pages/dashboard/CharactersPage"));
const NewCharacterPage = lazy(
  () => import("@pages/dashboard/NewCharacterPage"),
);
const EditCharacterPage = lazy(
  () => import("@pages/dashboard/EditCharacterPage"),
);
const WorldBoardPage = lazy(() => import("@pages/dashboard/WorldBoardPage"));

export default function App() {
  const location = useLocation();
  const initialize = useAuthStore((s) => s.initialize);
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Первичная инициализация
    initialize();

    // Слушаем изменения авторизации
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth]", event);

      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        setSession(session);

        if (session?.user) {
          // При SIGNED_IN даём время триггеру БД создать профиль
          const delay = event === "SIGNED_IN" ? 1200 : 0;
          if (delay) await new Promise((r) => setTimeout(r, delay));

          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();

          setProfile(profile ?? null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Показываем лоадер только при первом запуске
  if (!initialized && loading) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* ── Публичные ── */}
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/works" element={<WorksPage />} />
            <Route path="/works/:id" element={<WorkPage />} />
            <Route path="/fandoms/:slug" element={<FandomPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route
              path="/bookmarks"
              element={
                <ProtectedRoute>
                  <BookmarksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* ── Читалка ── */}
          <Route element={<ReaderLayout />}>
            <Route path="/works/:id/read/:chapterId" element={<ReaderPage />} />
          </Route>

          {/* ── Дашборд ── */}
          <Route
            element={
              <ProtectedRoute authorOnly>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/dashboard/works" element={<MyWorksPage />} />
            <Route path="/dashboard/works/new" element={<NewWorkPage />} />
            <Route path="/dashboard/works/:id" element={<EditWorkPage />} />
            <Route
              path="/dashboard/works/:id/chapters/:cId"
              element={<ChapterEditorPage />}
            />
            <Route path="/dashboard/characters" element={<CharactersPage />} />
            <Route
              path="/dashboard/characters/new"
              element={<NewCharacterPage />}
            />
            <Route
              path="/dashboard/characters/:id"
              element={<EditCharacterPage />}
            />
            <Route
              path="/dashboard/board/:workId"
              element={<WorldBoardPage />}
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
