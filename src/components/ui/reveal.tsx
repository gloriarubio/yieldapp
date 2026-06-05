"use client";

import { useEffect, useRef } from "react";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  as?: React.ElementType;
}

export function Reveal({ children, className = "", style, delay = 0, as: Tag = "div" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("sr-visible");
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const delayClass = delay > 0 ? `sr-delay-${delay}` : "";

  return (
    <Tag ref={ref as React.Ref<HTMLDivElement>} className={`sr ${delayClass} ${className}`} style={style}>
      {children}
    </Tag>
  );
}
