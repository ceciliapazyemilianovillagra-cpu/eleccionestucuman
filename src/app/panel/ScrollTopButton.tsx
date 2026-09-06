"use client";
import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 420);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button className="scroll-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Volver arriba">
      <ArrowUp size={20} strokeWidth={2.5} />
    </button>
  );
}
