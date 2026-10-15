import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export interface NotchNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const HEIGHT = 96;
const BAR_TOP = 31;
const CIRCLE_R = 24;
const NOTCH_R = 29.5;
const DURATION = 560;

function easeOutBack(x: number) {
  const c1 = 1.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// Floating bottom bar: the active section sits in a circle that rises above the
// bar, inside a soft U-shaped notch carved into the bar's top edge.
export default function NotchNav({
  items,
  active,
  onSelect,
}: {
  items: NotchNavItem[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(366);
  const target = Math.max(
    0,
    items.findIndex((item) => item.id === active),
  );
  const [pos, setPos] = useState(target);
  const posRef = useRef(target);
  const frame = useRef(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () =>
      setWidth(
        Math.max(
          280,
          Math.min(node.clientWidth, document.documentElement.clientWidth),
        ),
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    cancelAnimationFrame(frame.current);
    const from = posRef.current;
    if (from === target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      posRef.current = target;
      setPos(target);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const x = Math.min(1, (now - start) / DURATION);
      const value = from + (target - from) * easeOutBack(x);
      posRef.current = x < 1 ? value : target;
      setPos(posRef.current);
      if (x < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target]);

  const x0 = 8;
  const x1 = width - 8;
  const barWidth = x1 - x0;
  const margin = barWidth * 0.115;
  const pitch = (barWidth - margin * 2) / Math.max(1, items.length - 1);
  const cx = x0 + margin + pitch * pos;
  const bar = `M${x0 + 8} ${BAR_TOP} H${x1 - 8} A8 8 0 0 1 ${x1} ${BAR_TOP + 8} V${HEIGHT - 18} A18 18 0 0 1 ${x1 - 18} ${HEIGHT} H${x0 + 18} A18 18 0 0 1 ${x0} ${HEIGHT - 18} V${BAR_TOP + 8} A8 8 0 0 1 ${x0 + 8} ${BAR_TOP} Z`;

  return (
    <nav ref={ref} className="bottom-nav notch-nav" aria-label="Secciones">
      <svg
        className="notch-nav-shape"
        aria-hidden="true"
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
      >
        <defs>
          <filter id={`goo${uid}`} x="-5%" y="-60%" width="110%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
            <feColorMatrix
              in="b"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
              result="g"
            />
            <feComposite in="SourceGraphic" in2="g" operator="atop" />
          </filter>
          <mask
            id={`notch${uid}`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={width}
            height={HEIGHT}
          >
            <rect x="0" y="0" width={width} height={HEIGHT} fill="#fff" />
            <circle cx={cx} cy={BAR_TOP} r={NOTCH_R} fill="#000" />
          </mask>
        </defs>
        <g filter={`url(#goo${uid})`} className="notch-nav-bar">
          <g mask={`url(#notch${uid})`}>
            <path d={bar} />
          </g>
        </g>
        <circle className="notch-nav-bar" cx={cx} cy={BAR_TOP} r={CIRCLE_R} />
      </svg>
      <div
        className="notch-nav-circle"
        aria-hidden="true"
        style={{ transform: `translateX(${cx - CIRCLE_R}px)` }}
      >
        {items.map((item) => (
          <item.icon
            key={item.id}
            size={22}
            strokeWidth={1.9}
            className={item.id === active ? "on" : ""}
          />
        ))}
      </div>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={item.id === active ? "active" : ""}
          aria-current={item.id === active ? "page" : undefined}
          style={{
            left: x0 + margin + pitch * index - pitch / 2,
            width: pitch,
          }}
          onClick={() => onSelect(item.id)}
        >
          <span className="notch-nav-icon">
            <item.icon size={20} strokeWidth={1.8} />
          </span>
          <span className="notch-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
