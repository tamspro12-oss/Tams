import React from "react";
import { useElementVisibility } from "@/hooks/useScrollAnimation";

interface PublicRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const PublicReveal: React.FC<PublicRevealProps> = ({
  children,
  delay = 0,
  className = "",
}) => {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    (typeof window.IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true);

  const { ref, isVisible } = useElementVisibility<HTMLDivElement>({
    threshold: 0.05,
    rootMargin: "0px 0px -24px 0px",
    triggerOnce: true,
  });

  const shown = prefersReducedMotion || isVisible;

  return (
    <div
      ref={ref}
      className={`tams-reveal ${shown ? "tams-reveal-visible" : ""} ${className}`.trim()}
      style={prefersReducedMotion ? undefined : { transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

export default PublicReveal;

