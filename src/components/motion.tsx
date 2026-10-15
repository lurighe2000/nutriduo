import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Short tap feedback on phones that support it (Android). iOS ignores it. */
export function haptic(pattern: number | number[] = 10) {
  try {
    if (!prefersReducedMotion()) navigator.vibrate?.(pattern);
  } catch {
    // Vibration is optional.
  }
}

/** Animates a number from its previous value to the new one. */
export function useCountUp(value: number, duration = 1100) {
  const [shown, setShown] = useState(() =>
    prefersReducedMotion() ? value : 0,
  );
  const from = useRef(shown);
  const frame = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(frame.current);
    const start = from.current;
    if (prefersReducedMotion() || start === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const x = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - x, 3);
      const next = start + (value - start) * eased;
      from.current = x < 1 ? next : value;
      setShown(from.current);
      if (x < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);
  return shown;
}

/** Burst of small sparks, shown for a moment after a milestone. */
export function Celebration({ show }: { show: boolean }) {
  if (!show || prefersReducedMotion()) return null;
  return (
    <span className="duo-burst" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const distance = 60 + (i % 3) * 24;
        return (
          <i
            key={i}
            className={`c${i % 4}`}
            style={
              {
                "--dx": `${Math.round(Math.cos(angle) * distance * 1.6)}px`,
                "--dy": `${Math.round(Math.sin(angle) * distance)}px`,
                width: i % 2 ? 8 : 6,
                height: i % 2 ? 8 : 6,
              } as CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

/** Duo, the round NutriDuo buddy in the profile's colors. */
export function DuoBuddy({
  size = 76,
  className = "",
  label = "Duo, la mascota de NutriDuo, sonriendo",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  const fill = `duoBuddy${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      className={`duo-buddy ${className}`}
      width={size}
      height={size}
      viewBox="0 0 84 84"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--duo-3)" />
          <stop offset="1" stopColor="var(--duo-1)" />
        </linearGradient>
      </defs>
      <ellipse cx="42" cy="78" rx="22" ry="4" className="duo-buddy-shadow" />
      <path
        d="M42 8 C58 8 72 24 72 44 C72 62 59 72 42 72 C25 72 12 62 12 44 C12 24 26 8 42 8 Z"
        fill={`url(#${fill})`}
      />
      <ellipse cx="33" cy="22" rx="8" ry="5" fill="#fff" opacity=".35" />
      <g className="duo-buddy-eyes">
        <circle cx="33" cy="42" r="3.6" fill="#0b1030" />
        <circle cx="51" cy="42" r="3.6" fill="#0b1030" />
      </g>
      <path
        d="M34 52 Q42 59 50 52"
        fill="none"
        stroke="#0b1030"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="27" cy="51" r="3.5" fill="#fff" opacity=".35" />
      <circle cx="57" cy="51" r="3.5" fill="#fff" opacity=".35" />
    </svg>
  );
}
