import { useEffect, useId, useRef, useState } from "react";

type LatLng = [number, number];
const TILE = 256;
const FALLBACK: LatLng = [-34.6037, -58.3816];

function project([lat, lng]: LatLng, zoom: number) {
  const size = TILE * 2 ** zoom;
  const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function fitZoom(points: LatLng[], width: number, height: number, pad: number) {
  for (let z = 17; z > 3; z--) {
    const xy = points.map((p) => project(p, z));
    const w = Math.max(...xy.map((p) => p.x)) - Math.min(...xy.map((p) => p.x));
    const h = Math.max(...xy.map((p) => p.y)) - Math.min(...xy.map((p) => p.y));
    if (w <= width - pad * 2 && h <= height - pad * 2) return z;
  }
  return 3;
}

/**
 * Free OpenStreetMap street map, recolored to the app theme, with the route drawn
 * on top. `follow` keeps the runner centered; otherwise the route is fitted.
 */
export default function RouteMap({
  segments,
  current,
  follow = false,
  colors,
  dark,
  className = "",
  label,
}: {
  segments: LatLng[][];
  current?: LatLng;
  follow?: boolean;
  /** One color per point of each segment, for pace-colored routes. */
  colors?: string[][];
  dark: boolean;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gradient = useId();
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () =>
      setSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const all = segments.flat();
  const { width, height } = size;
  let zoom = 16;
  let center: LatLng = current ?? all.at(-1) ?? FALLBACK;
  if (!follow && all.length > 1 && width && height) {
    zoom = fitZoom(all, width, height, 28);
    const lats = all.map((p) => p[0]);
    const lngs = all.map((p) => p[1]);
    center = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];
  } else if (!current && !all.length) zoom = 12;
  const mid = project(center, zoom);
  const left = mid.x - width / 2;
  const top = mid.y - height / 2;
  const tiles: { key: string; x: number; y: number; url: string }[] = [];
  const count = 2 ** zoom;
  if (width && height)
    for (
      let ty = Math.floor(top / TILE);
      ty <= Math.floor((top + height) / TILE);
      ty++
    )
      for (
        let tx = Math.floor(left / TILE);
        tx <= Math.floor((left + width) / TILE);
        tx++
      ) {
        if (ty < 0 || ty >= count) continue;
        const wx = ((tx % count) + count) % count;
        tiles.push({
          key: `${zoom}-${tx}-${ty}`,
          x: tx * TILE - left,
          y: ty * TILE - top,
          url: `https://tile.openstreetmap.org/${zoom}/${wx}/${ty}.png`,
        });
      }
  const toXY = (p: LatLng) => {
    const xy = project(p, zoom);
    return [xy.x - left, xy.y - top] as const;
  };
  const here = current ? toXY(current) : undefined;
  const start = all.length ? toXY(all[0]) : undefined;

  return (
    <div
      ref={ref}
      className={`route-map ${dark ? "dark" : ""} ${className}`}
      role="img"
      aria-label={label}
    >
      {tiles.map((t) => (
        <img
          key={t.key}
          className="route-map-tile"
          src={t.url}
          alt=""
          draggable={false}
          style={{ left: t.x, top: t.y }}
          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
        />
      ))}
      <span className="route-map-tint" aria-hidden="true" />
      {width > 0 && (
        <svg
          className="route-map-route"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={gradient}
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={height}
              x2={width}
              y2={0}
            >
              <stop offset="0" style={{ stopColor: "var(--duo-3, #8fd3ff)" }} />
              <stop offset="1" style={{ stopColor: "var(--duo-1, #2f7bff)" }} />
            </linearGradient>
          </defs>
          {segments.map((segment, s) =>
            colors
              ? segment.slice(1).map((p, i) => {
                  const [x1, y1] = toXY(segment[i]);
                  const [x2, y2] = toXY(p);
                  return (
                    <line
                      key={`${s}-${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      style={{ stroke: colors[s]?.[i + 1] ?? "var(--duo-1)" }}
                      strokeWidth={6}
                      strokeLinecap="round"
                    />
                  );
                })
              : segment.length > 1 && (
                  <polyline
                    key={s}
                    points={segment.map((p) => toXY(p).join(",")).join(" ")}
                    fill="none"
                    stroke={`url(#${gradient})`}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ),
          )}
          {start && !follow && (
            <circle
              cx={start[0]}
              cy={start[1]}
              r={7}
              className="route-map-start"
            />
          )}
          {here && (
            <>
              <circle
                cx={here[0]}
                cy={here[1]}
                r={9}
                className="route-map-halo"
              />
              <circle
                cx={here[0]}
                cy={here[1]}
                r={7}
                className="route-map-here"
              />
            </>
          )}
        </svg>
      )}
      <span className="route-map-credit">© OpenStreetMap</span>
    </div>
  );
}
