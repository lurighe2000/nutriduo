import {
  useEffect,
  useContext,
  useRef,
  useId,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
import { X, Plus, ArrowRight, Check, ChevronDown } from "lucide-react";
import { AppContext } from "../app/context";
import { useDialogBack } from "../app/navigation";
export function Button({
  children,
  onClick,
  secondary = false,
  type = "button",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`${secondary ? "button secondary" : "button"} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = "any",
  required = true,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  required?: boolean;
}) {
  return (
    <Field
      label={label}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={Number.isNaN(value) || (value === 0 && min > 0) ? "" : value}
      required={required}
      onChange={(e) =>
        onChange(e.target.value === "" ? NaN : Number(e.target.value))
      }
    />
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <ChoicePicker
      label={label}
      value={value}
      onChange={onChange}
      options={options.map((v) => ({ value: v, label: v }))}
    />
  );
}
export function ChoicePicker<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  description = "Elegí una opción.",
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void | boolean | Promise<void | boolean>;
  disabled?: boolean;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = options.find((option) => option.value === value);
  const labelId = useId(),
    valueId = useId();
  return (
    <div className="choice-field">
      <span className="choice-label" id={labelId}>
        {label}
      </span>
      <button
        type="button"
        className="choice-trigger"
        aria-labelledby={labelId}
        aria-describedby={valueId}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <span id={valueId}>{selected?.label ?? "Elegir opción"}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <Modal
          title={label}
          className="choice-sheet"
          onClose={() => setOpen(false)}
          showNotice={false}
        >
          <p className="muted small">{description}</p>
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
                    if ((await onChange(option.value)) !== false)
                      setOpen(false);
                    else
                      setError(
                        "No pudimos guardar la opción. Volvé a intentarlo.",
                      );
                  } catch {
                    setError(
                      "No pudimos guardar la opción. Volvé a intentarlo.",
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
          {busy && <p role="status">Guardando…</p>}
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
export function Modal({
  title,
  children,
  onClose,
  className = "",
  showNotice = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  showNotice?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const close = useDialogBack(onClose);
  const context = useContext(AppContext);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      className={`modal ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-head">
        <h2 id={headingId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Cerrar"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <div className="modal-content">
        {showNotice && context?.notice && (
          <div className="notice" role="status">
            {context.notice}
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
export function Empty({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Plus size={23} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action && (
        <Button secondary onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </Button>
      )}
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function Confirm({
  title,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{children}</p>
      <div className="actions">
        <Button secondary onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={onConfirm}>Confirmar</Button>
      </div>
    </Modal>
  );
}
