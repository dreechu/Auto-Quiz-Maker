"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      document.documentElement.classList.toggle(
        "dark",
        window.localStorage.getItem("recall-theme") === "dark",
      );
    } catch (error) {
      console.error("Could not initialize the saved color theme.", error);
    }
  }, []);

  return <AuthProvider>{children}</AuthProvider>;
}
