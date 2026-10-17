// src/components/layout/Layout.jsx
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import AuthModal from "@components/ui/AuthModal";
import GlobalSearch from "@components/ui/GlobalSearch";
import { useUIStore } from "@store/uiStore";
import styles from "./Layout.module.css";

export default function Layout() {
  const authModalOpen = useUIStore((s) => s.authModalOpen);
  const searchOpen = useUIStore((s) => s.searchOpen);

  return (
    <div className={styles.root}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      {authModalOpen && <AuthModal />}
      {searchOpen && <GlobalSearch />}
    </div>
  );
}
