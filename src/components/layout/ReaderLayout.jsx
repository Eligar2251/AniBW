// src/components/layout/ReaderLayout.jsx
import { Outlet } from "react-router-dom";
import { useUIStore } from "@store/uiStore";
import AuthModal from "@components/ui/AuthModal";
import styles from "./ReaderLayout.module.css";

export default function ReaderLayout() {
  const authModalOpen = useUIStore((s) => s.authModalOpen);

  return (
    <div className={styles.root}>
      <Outlet />
      {authModalOpen && <AuthModal />}
    </div>
  );
}
