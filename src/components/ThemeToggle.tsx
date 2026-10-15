import { Sun, Moon } from "lucide-react";
import SwitchBuddy from "./SwitchBuddy";

// Soft "pressed" switch: the knob jumps between sun and moon while a tiny
// buddy lives on top of it (walks, reads, trains, sleeps, uses an umbrella).
export default function ThemeToggle({
  dark,
  onChange,
}: {
  dark: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <span className="theme-control">
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Modo oscuro"
        title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        className={`duo-switch ${dark ? "is-dark" : ""}`}
        onClick={() => onChange(!dark)}
      >
        <SwitchBuddy dark={dark} />
        <span className="duo-switch-stars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="duo-switch-knob" aria-hidden="true">
          <Sun className="sun" size={16} strokeWidth={2.2} />
          <Moon className="moon" size={15} strokeWidth={2.2} />
        </span>
      </button>
    </span>
  );
}
