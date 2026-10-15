import { Heart } from "lucide-react";
import { useApp } from "../../app/context";
import {
  connectHeartRate,
  disconnectHeartRate,
  heartRateSupported,
  useHeartRate,
} from "../../services/heartRate";

/** Connects a Bluetooth heart-rate monitor (Android Chrome). */
export default function HeartRateButton() {
  const { notify } = useApp();
  const heart = useHeartRate();
  if (!heartRateSupported()) return null;
  return (
    <div className="run-heart-link">
      <button
        type="button"
        className={`run-voice ${heart.status === "on" ? "on" : ""}`}
        disabled={heart.status === "connecting"}
        onClick={() => {
          if (heart.status === "on" || heart.status === "lost") {
            disconnectHeartRate();
            return;
          }
          void connectHeartRate().catch((error: Error) => {
            if (error.name !== "NotFoundError")
              notify("No pude conectar el pulsómetro. Probá de nuevo.");
          });
        }}
      >
        <Heart
          size={16}
          fill={heart.status === "on" ? "currentColor" : "none"}
        />
        {heart.status === "on"
          ? `${heart.bpm ?? "--"} lpm · ${heart.name ?? "Pulsómetro"}`
          : heart.status === "lost"
            ? "Reconectando pulsómetro…"
            : heart.status === "connecting"
              ? "Buscando pulsómetro…"
              : "Conectar pulsómetro"}
      </button>
      {heart.status === "off" && (
        <span className="run-muted small">
          Galaxy Watch: abrí en el reloj una app que comparta el pulso por
          Bluetooth.
        </span>
      )}
    </div>
  );
}
