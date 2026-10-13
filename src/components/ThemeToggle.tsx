import { Sun, Moon } from "lucide-react";
export default function ThemeToggle({
  dark,
  onChange,
}: {
  dark: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="theme-toggle" role="group" aria-label="Apariencia">
      <button
        type="button"
        aria-label="Claro"
        aria-pressed={!dark}
        onClick={() => onChange(false)}
      >
        <Sun size={16} />
        <span>Claro</span>
      </button>
      <button type="button" aria-label="Oscuro" aria-pressed={dark} onClick={() => onChange(true)}>
        <Moon size={16} />
        <span>Oscuro</span>
      </button>
    </div>
  );
}
