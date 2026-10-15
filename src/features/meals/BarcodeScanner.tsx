import { useEffect, useRef, useState } from "react";
import { Flashlight, Keyboard, X } from "lucide-react";
import { useDialogBack } from "../../app/navigation";
import { haptic } from "../../components/motion";
import { validBarcode } from "../../services/products";

type Detector = {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
};
type DetectorClass = new (options: { formats: string[] }) => Detector;

/** Full-screen camera with a guide frame; native BarcodeDetector or ZXing. */
export default function BarcodeScanner({
  onResult,
  onClose,
}: {
  onResult: (code: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const done = useRef(false);
  const handlers = useRef({ onResult, onClose });
  handlers.current = { onResult, onClose };
  const close = useDialogBack(onClose);
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState("");
  const [torch, setTorch] = useState<{
    on: boolean;
    track: MediaStreamTrack;
  }>();

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopZxing: (() => void) | undefined;
    let timer: number | undefined;
    let alive = true;
    const found = (raw: string) => {
      const value = raw.replace(/\D/g, "");
      if (done.current || !validBarcode(value)) return;
      done.current = true;
      haptic([20, 40, 20]);
      handlers.current.onResult(value);
    };
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (!alive) return stream.getTracks().forEach((t) => t.stop());
        const el = video.current!;
        el.srcObject = stream;
        await el.play();
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() as
          { torch?: boolean } | undefined;
        if (caps?.torch) setTorch({ on: false, track });
        const Native = (
          window as unknown as { BarcodeDetector?: DetectorClass }
        ).BarcodeDetector;
        if (Native) {
          const detector = new Native({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
          });
          const scan = async () => {
            if (!alive || done.current) return;
            try {
              const codes = await detector.detect(el);
              codes.forEach((c) => found(c.rawValue));
            } catch {
              // A frame that fails to decode is fine.
            }
            timer = window.setTimeout(() => void scan(), 120);
          };
          void scan();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromStream(stream, el, (r) => {
            if (r) found(r.getText());
          });
          stopZxing = () => controls.stop();
          if (!alive) stopZxing();
        }
      } catch (e) {
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "NutriDuo no tiene permiso para usar la cámara. Activalo en los ajustes del navegador o escribí el código."
            : "No pudimos abrir la cámara. Escribí el código a mano.",
        );
        setTyping(true);
      }
    })();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="scanner-dialog"
      aria-label="Escanear código de barras"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <video ref={video} className="scanner-video" muted playsInline />
      <div className="scanner-shade" aria-hidden="true">
        <span className="scanner-frame">
          <i />
        </span>
      </div>
      <div className="scanner-top">
        <button
          type="button"
          className="scanner-round"
          aria-label="Cerrar cámara"
          onClick={close}
        >
          <X size={22} />
        </button>
        {torch && (
          <button
            type="button"
            className={`scanner-round ${torch.on ? "on" : ""}`}
            aria-label="Linterna"
            aria-pressed={torch.on}
            onClick={() => {
              const on = !torch.on;
              void torch.track
                .applyConstraints({
                  advanced: [{ torch: on } as MediaTrackConstraintSet],
                })
                .then(() => setTorch({ ...torch, on }))
                .catch(() => setTorch(undefined));
            }}
          >
            <Flashlight size={20} />
          </button>
        )}
      </div>
      <div className="scanner-bottom">
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p>Apuntá al código de barras del envase</p>
        )}
        {typing ? (
          <form
            className="scanner-manual"
            onSubmit={(e) => {
              e.preventDefault();
              const value = code.replace(/\D/g, "");
              if (/^\d{8,14}$/.test(value)) {
                done.current = true;
                handlers.current.onResult(value);
              } else setError("Ingresá entre 8 y 14 dígitos.");
            }}
          >
            <input
              aria-label="Número del código de barras"
              inputMode="numeric"
              autoFocus
              placeholder="Ej. 7790580…"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit">Buscar</button>
          </form>
        ) : (
          <button
            type="button"
            className="scanner-type"
            onClick={() => setTyping(true)}
          >
            <Keyboard size={18} /> Escribir el número
          </button>
        )}
      </div>
    </dialog>
  );
}
