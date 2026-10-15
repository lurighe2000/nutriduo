import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

const DAY = [
  "walk",
  "jog",
  "read",
  "jumping",
  "rope",
  "curl",
  "pushup",
  "squat",
  "mate",
  "drink",
  "eat",
  "soccer",
  "dance",
  "juggle",
  "stretch",
  "cartwheel",
  "selfie",
  "hula",
  "skate",
  "kite",
  "yoga",
  "meditate",
  "wave",
] as const;
const NIGHT = [
  "walk",
  "read",
  "mate",
  "guitar",
  "telescope",
  "brush",
  "meditate",
  "yoga",
  "stretch",
  "sleep",
  "drink",
  "dance",
] as const;
const RAIN = [
  "umbrella",
  "read",
  "mate",
  "drink",
  "guitar",
  "meditate",
  "umbrella",
] as const;

type Activity =
  | (typeof DAY)[number]
  | (typeof NIGHT)[number]
  | (typeof RAIN)[number]
  | "surprise";

// Random next activity, never the same one twice in a row.
function pickNext(list: readonly Activity[], previous: Activity): Activity {
  const options = list.filter((activity) => activity !== previous);
  return options[Math.floor(Math.random() * options.length)] ?? list[0];
}

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
    case "jog":
      return (
        <g className="bd-walk">
          <g className="bd-bounce">
            <Head x={15} />
            <path d="M15 8 L14 17 M14.7 10 L11 12.5 L10 15.5 M14.7 10 L18 12.5 L19.5 9.5" />
            <path className="bd-leg-a" d="M14 17 V25" />
            <path className="bd-leg-b" d="M14 17 V25" />
          </g>
        </g>
      );
    case "rope":
      return (
        <g className="bd-bounce">
          <Head />
          <path d="M14 8 V17 M14 10 L10 15 M14 10 L18 15 M14 17 L13 25 M14 17 L15 25" />
          <path className="bd-prop bd-frame-a" d="M10 15 Q14 -3 18 15" />
          <path className="bd-prop bd-frame-b" d="M10 15 Q14 33 18 15" />
        </g>
      );
    case "curl":
      return (
        <g>
          <Head />
          <path d="M14 8 V17 M14 17 L12.5 25 M14 17 L15.5 25" />
          <g className="bd-frame-a">
            <path d="M14 10 L11 16 M14 10 L17 16" />
            <rect
              className="bd-fill"
              x="8.5"
              y="15.4"
              width="5"
              height="1.8"
              rx=".6"
            />
            <rect
              className="bd-fill"
              x="14.5"
              y="15.4"
              width="5"
              height="1.8"
              rx=".6"
            />
          </g>
          <g className="bd-frame-b">
            <path d="M14 10 L11 14 L10.5 10 M14 10 L17 14 L17.5 10" />
            <rect
              className="bd-fill"
              x="8"
              y="8.6"
              width="5"
              height="1.8"
              rx=".6"
            />
            <rect
              className="bd-fill"
              x="15"
              y="8.6"
              width="5"
              height="1.8"
              rx=".6"
            />
          </g>
        </g>
      );
    case "pushup":
      return (
        <g>
          <g className="bd-frame-a">
            <Head x={6} y={15} />
            <path d="M8.5 16.5 L24 24 M10.5 17.4 V25" />
          </g>
          <g className="bd-frame-b">
            <Head x={6} y={20.5} />
            <path d="M8.5 21.8 L24 24.6 M10.5 22.2 L7.5 23.5 L9 25" />
          </g>
        </g>
      );
    case "mate":
      return (
        <g>
          <path className="bd-prop" d="M9 18 H16 M10 18 V25 M15 18 V25" />
          <g className="bd-tilt">
            <Head x={12} y={6} />
          </g>
          <path d="M12 9 V18 L18 18 L18 25 M12 11 L16 15 L18 13.4" />
          <path className="bd-prop" d="M18.5 11.5 L15.5 7.5" />
          <rect
            className="bd-fill"
            x="17"
            y="11.2"
            width="3.4"
            height="4"
            rx="1.5"
          />
          <path
            className="bd-steam"
            d="M21.5 10 q1 -1.2 0 -2.4 q-1 -1.2 0 -2.4"
          />
        </g>
      );
    case "eat":
      return (
        <g>
          <Head />
          <path d="M14 8 V17 M14 10 L10 14 M14 17 L13 25 M14 17 L15 25" />
          <path
            className="bd-fill-2"
            d="M6.5 13.5 H12.5 Q12 17 9.5 17 Q7 17 6.5 13.5 Z"
          />
          <circle className="bd-leaf" cx="8.4" cy="13" r=".9" />
          <circle className="bd-leaf" cx="10.6" cy="12.8" r=".8" />
          <path className="bd-frame-a" d="M14 10 L17 14 L13 14.5" />
          <path className="bd-frame-b" d="M14 10 L17.5 11 L15.6 7.2" />
        </g>
      );
    case "soccer":
      return (
        <g>
          <Head />
          <path d="M14 8 V17 M14 10 L10 13 M14 10 L18 13 M14 17 L12.5 25" />
          <path className="bd-frame-a" d="M14 17 L19 20" />
          <path className="bd-frame-b" d="M14 17 L16 25" />
          <circle className="bd-ball bd-juggle" cx="20.5" cy="19" r="1.9" />
        </g>
      );
    case "dance":
      return (
        <g>
          <g className="bd-frame-a">
            <Head x={13} />
            <path d="M13 8 L14 17 M13.4 10 L9 5.5 M13.4 10 L18 13 M14 17 L11 25 M14 17 L17 23.5" />
          </g>
          <g className="bd-frame-b">
            <Head x={15} />
            <path d="M15 8 L14 17 M14.6 10 L19 5.5 M14.6 10 L10 13 M14 17 L17 25 M14 17 L11 23.5" />
          </g>
          <text className="bd-z z1" x="20" y="9">
            ♪
          </text>
          <text className="bd-z z3" x="5" y="7">
            ♫
          </text>
        </g>
      );
    case "juggle":
      return (
        <g>
          <Head y={8} />
          <path d="M14 11 V18 M14 13 L10 14.5 L9.5 11 M14 13 L18 14.5 L18.5 11 M14 18 L13 25 M14 18 L15 25" />
          <g className="bd-orbit">
            <circle className="bd-ball" cx="14" cy="-3" r="1.3" />
            <circle className="bd-ball" cx="10.5" cy="3" r="1.3" />
            <circle className="bd-ball" cx="17.5" cy="3" r="1.3" />
          </g>
        </g>
      );
    case "stretch":
      return (
        <g>
          <g className="bd-frame-a">
            <Head />
            <path d="M14 8 V17 M14 10 L12 1 M14 10 L16 1 M14 17 L13 25 M14 17 L15 25" />
          </g>
          <g className="bd-frame-b">
            <Head x={21.5} y={17} />
            <path d="M13 17 L19 14 M19 14 L19.5 24.5 M13 17 L12 25 M13 17 L14 25" />
          </g>
        </g>
      );
    case "cartwheel":
      return (
        <g className="bd-cartwheel">
          <Head />
          <path d="M14 8 V17 M14 10 L8 7 M14 10 L20 7 M14 17 L9 24 M14 17 L19 24" />
        </g>
      );
    case "selfie":
      return (
        <g>
          <Head />
          <path d="M14 8 V17 M14 10 L18 6 M14 10 L10.5 9.5 L10.5 6 M14 17 L13 25 M14 17 L15 25" />
          <rect
            className="bd-fill"
            x="17.6"
            y="1.6"
            width="2.6"
            height="4.4"
            rx=".6"
          />
          <circle className="bd-flash" cx="19" cy="2" r="3.6" />
        </g>
      );
    case "hula":
      return (
        <g className="bd-sway">
          <Head />
          <path d="M14 8 V17 M14 10 L10 5 M14 10 L18 5 M14 17 L12 25 M14 17 L16 25" />
          <ellipse className="bd-hoop" cx="14" cy="15.5" rx="6.5" ry="1.7" />
        </g>
      );
    case "skate":
      return (
        <g className="bd-walk">
          <g className="bd-bounce">
            <Head />
            <path d="M14 8 V17 M14 10 L9 12.5 M14 10 L19 12.5 M14 17 L11 23 M14 17 L17 23" />
          </g>
          <path
            className="bd-prop"
            d="M7.5 23 Q8 24.3 9.5 24.3 H18.5 Q20 24.3 20.5 23"
          />
          <circle className="bd-ball" cx="10" cy="25.6" r="1" />
          <circle className="bd-ball" cx="18" cy="25.6" r="1" />
        </g>
      );
    case "kite":
      return (
        <g>
          <Head x={11} />
          <path d="M11 8 V17 M11 10 L8 14 M11 10 L15 11 M11 17 L10 25 M11 17 L12 25" />
          <g className="bd-kite">
            <path className="bd-prop" d="M15 11 Q21 9 23.5 4" />
            <path
              className="bd-fill"
              d="M23.5 -1 L26.5 2.5 L23.5 6 L20.5 2.5 Z"
            />
            <path className="bd-prop" d="M23.5 6 q-1 2 0 3 q1 1 0 2.5" />
          </g>
        </g>
      );
    case "meditate":
      return (
        <g>
          <ellipse className="bd-shadow" cx="14" cy="25.5" rx="6" ry="1" />
          <g className="bd-float">
            <Head y={7} />
            <path d="M14 10 V17 M14 12 L10 16 L12 18 M14 12 L18 16 L16 18 M8 20 Q14 16.5 20 20" />
          </g>
        </g>
      );
    case "telescope":
      return (
        <g>
          <circle className="bd-star" cx="25" cy="-1" r=".9" />
          <circle className="bd-star s2" cx="4" cy="1" r=".7" />
          <circle className="bd-star s3" cx="20" cy="-3" r=".6" />
          <Head x={11} y={7} />
          <path d="M11 10 V18 M11 12 L16 13 M11 12 L16.5 10.5 M11 18 L10 25 M11 18 L12 25" />
          <path className="bd-scope" d="M15 12 L23.5 5" />
          <path
            className="bd-prop"
            d="M19.5 9 L17 25 M19.5 9 L22.5 25 M19.5 9 V25"
          />
        </g>
      );
    case "brush":
      return (
        <g>
          <Head />
          <path d="M14 8 V17 M14 10 L10 15 M14 17 L13 25 M14 17 L15 25" />
          <g className="bd-brush">
            <path d="M14 10 L18 11.5 L16.6 7.4" />
            <rect
              className="bd-fill-2"
              x="16"
              y="6"
              width="4.6"
              height="1.3"
              rx=".5"
            />
          </g>
          <circle className="bd-bubble z1" cx="18" cy="4" r=".8" />
          <circle className="bd-bubble z2" cx="20" cy="3" r=".6" />
          <circle className="bd-bubble z3" cx="17" cy="2.5" r=".5" />
        </g>
      );
    case "guitar":
      return (
        <g>
          <path className="bd-prop" d="M8 18 H15 M9 18 V25 M14 18 V25" />
          <Head x={11} y={6} />
          <path d="M11 9 V18 L17 18 L17 25" />
          <path className="bd-scope" d="M17 16.5 L24.5 10.5" />
          <ellipse
            className="bd-fill"
            cx="15.5"
            cy="17"
            rx="3.4"
            ry="2.4"
            transform="rotate(-35 15.5 17)"
          />
          <path d="M11 11 L22 12" />
          <path className="bd-frame-a" d="M11 11 L14 15 L16 16" />
          <path className="bd-frame-b" d="M11 11 L14 16 L15.5 18.5" />
          <text className="bd-z z1" x="20" y="7">
            ♪
          </text>
          <text className="bd-z z2" x="23" y="4">
            ♫
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
  const [current, setCurrent] = useState<Activity>("walk");
  const [rain, setRain] = useState(false);
  const [surprise, setSurprise] = useState(false);
  const firstDark = useRef(dark);
  const list: readonly Activity[] = rain ? RAIN : dark ? NIGHT : DAY;
  const listRef = useRef(list);

  useEffect(() => {
    listRef.current = list;
  }, [list]);

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
    const timer = setInterval(
      () => setCurrent((previous) => pickNext(listRef.current, previous)),
      STEP_MS,
    );
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

  // After switching day/night/rain the current activity may not belong to the
  // new set (no kites at night), so fall back to that set's first activity.
  const activity: Activity = surprise
    ? "surprise"
    : list.includes(current)
      ? current
      : list[0];

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
