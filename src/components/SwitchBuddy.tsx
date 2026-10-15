import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

type Activity =
  | "walk"
  | "read"
  | "jumping"
  | "squat"
  | "drink"
  | "wave"
  | "yoga"
  | "umbrella"
  | "sleep"
  | "surprise";

const DAY: Activity[] = [
  "walk",
  "read",
  "jumping",
  "walk",
  "drink",
  "squat",
  "wave",
  "yoga",
];
const NIGHT: Activity[] = ["walk", "read", "sleep", "yoga", "sleep", "drink"];
const RAIN: Activity[] = ["umbrella", "read", "umbrella", "drink"];
const STEP_MS = 7500;
const WEATHER_KEY = "nutriduo-buddy-weather";
const RAIN_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
]);

// Rain in Buenos Aires from the free Open-Meteo forecast (no key, no location
// permission). Cached for 30 minutes; any failure simply means "no rain".
async function isRaining(): Promise<boolean> {
  if (navigator.webdriver || !navigator.onLine) return false;
  try {
    const cached = JSON.parse(sessionStorage.getItem(WEATHER_KEY) ?? "null");
    if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.rain;
  } catch {
    // Storage may be unavailable.
  }
  try {
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=-34.61&longitude=-58.38&current=precipitation,weather_code",
      {
        signal: AbortSignal.timeout(6000),
        credentials: "omit",
        referrerPolicy: "no-referrer",
      },
    );
    const data = await response.json();
    const rain =
      Number(data?.current?.precipitation) > 0 ||
      RAIN_CODES.has(Number(data?.current?.weather_code));
    try {
      sessionStorage.setItem(
        WEATHER_KEY,
        JSON.stringify({ at: Date.now(), rain }),
      );
    } catch {
      // Ignore.
    }
    return rain;
  } catch {
    return false;
  }
}

const Head = ({ x = 14, y = 5 }: { x?: number; y?: number }) => (
  <circle cx={x} cy={y} r="3" />
);

function Pose({ activity }: { activity: Activity }) {
  switch (activity) {
    case "read":
      return (
        <g className="bd-read">
          <path className="bd-prop" d="M9 10 V25 M9 18 H18 M18 18 V25" />
          <Head x={13} y={6} />
          <path d="M13 9 L12 17 L18 17 L18 24 M13 11 L17 13" />
          <rect
            className="bd-book"
            x="15.5"
            y="10.5"
            width="5"
            height="4"
            rx=".6"
          />
        </g>
      );
    case "jumping":
      return (
        <g className="bd-bounce">
          <g className="bd-frame-a">
            <Head />
            <path d="M14 8 V17 M14 10 L10 15 M14 10 L18 15 M14 17 L13 25 M14 17 L15 25" />
          </g>
          <g className="bd-frame-b">
            <Head />
            <path d="M14 8 V17 M14 10 L9 4 M14 10 L19 4 M14 17 L9 24 M14 17 L19 24" />
          </g>
        </g>
      );
    case "squat":
      return (
        <g>
          <g className="bd-frame-a">
            <Head />
            <path d="M14 8 V17 M14 11 L19 12 M14 17 L13 25 M14 17 L15 25" />
          </g>
          <g className="bd-frame-b">
            <Head y={10} />
            <path d="M14 13 V20 M14 15 L20 15 M14 20 L19 21 L18 25 M14 20 L10 22 L11 25" />
          </g>
        </g>
      );
    case "drink":
      return (
        <g>
          <g className="bd-tilt">
            <Head />
          </g>
          <path d="M14 8 V17 M14 10 L10 15 M14 10 L17 8 M14 17 L13 25 M14 17 L15 25" />
          <rect
            className="bd-bottle"
            x="16.5"
            y="2.5"
            width="2.6"
            height="6"
            rx=".8"
          />
        </g>
      );
    case "wave":
      return (
        <g>
          <Head />
          <path d="M14 8 V17 M14 10 L10 15 M14 17 L13 25 M14 17 L15 25" />
          <path className="bd-wave-arm" d="M14 10 L19 5" />
        </g>
      );
    case "yoga":
      return (
        <g className="bd-sway">
          <Head />
          <path d="M14 8 V17 M14 10 L12 2 M14 10 L16 2 M14 17 L14 25 M14 17 L18 20 L14 21" />
        </g>
      );
    case "umbrella":
      return (
        <g className="bd-walk">
          <path className="bd-canopy" d="M7 4 Q15 -4 23 4 Z" />
          <path className="bd-prop" d="M15 3 V13 Q15 15 13 14" />
          <Head />
          <path d="M14 8 V17 M14 10 L10 14 M14 10 L15 12" />
          <path className="bd-leg-a" d="M14 17 V25" />
          <path className="bd-leg-b" d="M14 17 V25" />
        </g>
      );
    case "sleep":
      return (
        <g>
          <Head x={5} y={22} />
          <path d="M8 23 H20 M20 23 L26 24 M11 23 L14 20" />
          <text className="bd-z z1" x="9" y="16">
            z
          </text>
          <text className="bd-z z2" x="12" y="12">
            z
          </text>
          <text className="bd-z z3" x="15" y="8">
            Z
          </text>
        </g>
      );
    case "surprise":
      return (
        <g className="bd-hop">
          <Head />
          <path d="M14 8 V17 M14 10 L9 5 M14 10 L19 5 M14 17 L12 25 M14 17 L16 25" />
          <path className="bd-prop" d="M21 1 V4 M21 6 V6.5" />
        </g>
      );
    default:
      return (
        <g className="bd-walk">
          <Head />
          <path d="M14 8 V17 M14 10 L10.5 14 M14 10 L17.5 14" />
          <path className="bd-leg-a" d="M14 17 V25" />
          <path className="bd-leg-b" d="M14 17 V25" />
        </g>
      );
  }
}

/** A tiny buddy living on top of the day/night switch. */
export default function SwitchBuddy({ dark }: { dark: boolean }) {
  const [step, setStep] = useState(0);
  const [rain, setRain] = useState(false);
  const [surprise, setSurprise] = useState(false);
  const firstDark = useRef(dark);

  useEffect(() => {
    let alive = true;
    const check = () => void isRaining().then((r) => alive && setRain(r));
    check();
    const weather = setInterval(check, 30 * 60 * 1000);
    if (prefersReducedMotion())
      return () => {
        alive = false;
        clearInterval(weather);
      };
    const timer = setInterval(() => setStep((n) => n + 1), STEP_MS);
    return () => {
      alive = false;
      clearInterval(timer);
      clearInterval(weather);
    };
  }, []);

  useEffect(() => {
    if (firstDark.current === dark) return;
    firstDark.current = dark;
    setSurprise(true);
    const t = setTimeout(() => setSurprise(false), 1300);
    return () => clearTimeout(t);
  }, [dark]);

  const list = rain ? RAIN : dark ? NIGHT : DAY;
  const activity: Activity = surprise ? "surprise" : list[step % list.length];

  return (
    <span className={`duo-switch-buddy act-${activity}`} aria-hidden="true">
      {rain && (
        <span className="bd-rain">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      <svg viewBox="0 0 28 28" width="28" height="28" key={activity}>
        <Pose activity={activity} />
      </svg>
    </span>
  );
}
