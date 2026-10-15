import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Modal } from "./ui";

/** A themed choice sheet; selecting is the only action that changes the value. */
export default function ChoicePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = options.find((option) => option.value === value);
  return (
    <div className="choice-field">
      <span className="choice-label">{label}</span>
      <button
        type="button"
        className="choice-trigger"
        aria-label={`${label}: ${selected?.label ?? "Elegir plato"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <span>{selected?.label ?? "Elegir plato"}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <Modal
          title={label}
          className="choice-sheet"
          onClose={() => setOpen(false)}
        >
          <p className="muted small">Elegí el plato que querés preparar.</p>
          <div className="choice-options" aria-busy={busy}>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className="choice-option"
                aria-pressed={option.value === value}
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  if (option.value === value) {
                    setOpen(false);
                    return;
                  }
                  setBusy(true);
                  setError("");
                  try {
                    if (await onChange(option.value)) setOpen(false);
                    else
                      setError(
                        "No pudimos cambiar el plato. Volvé a intentarlo.",
                      );
                  } catch {
                    setError(
                      "No pudimos cambiar el plato. Volvé a intentarlo.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <span>{option.label}</span>
                <span className="choice-check" aria-hidden="true">
                  {option.value === value && <Check size={16} />}
                </span>
              </button>
            ))}
          </div>
          {busy && <p role="status">Actualizando plato y compras…</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
