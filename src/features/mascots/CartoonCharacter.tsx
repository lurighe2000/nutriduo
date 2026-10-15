import type { CSSProperties } from "react";
import { motionDuration, type Character, type Motion } from "./types";
import "./cartoon.css";

/** Original vector drawings, with independently animated inked parts. No WebGL. */
export default function CartoonCharacter({
  character,
  motion,
  running,
}: {
  character: Character;
  motion: Motion;
  running: boolean;
}) {
  const angel = character === "angel";
  const colors = angel
    ? {
        "--fur": "#ee8ab5",
        "--fur-shade": "#d8649a",
        "--patch": "#ffccdf",
        "--ear": "#f8bfd9",
        "--ink": "#71344e",
        "--nose": "#a56eac",
      }
    : {
        "--fur": "#5799d2",
        "--fur-shade": "#357db8",
        "--patch": "#9cdeed",
        "--ear": "#be8fb8",
        "--ink": "#173d62",
        "--nose": "#124574",
      };
  return (
    <svg
      className={`cartoon-character ${character}`}
      viewBox="0 0 340 300"
      role="img"
      aria-label={`${angel ? "Angel" : "Stitch"}, dibujo animado en 2D`}
      data-motion={motion}
      data-running={running}
      style={
        {
          ...colors,
          "--gesture-duration": `${motionDuration[motion]}ms`,
        } as CSSProperties
      }
    >
      <g
        className="cartoon-body"
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {angel && (
          <g
            className="antennae"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="12"
          >
            <path
              className="antenna-left"
              d="M136 84 C124 14 98 12 97 53 C103 111 86 193 67 234 C57 255 42 261 34 246"
            />
            <path
              className="antenna-right"
              d="M204 83 C220 13 245 14 243 55 C237 116 254 195 270 237 C279 257 295 261 305 244"
            />
            <g stroke="var(--fur)" strokeWidth="7">
              <path
                className="antenna-left"
                d="M136 84 C124 14 98 12 97 53 C103 111 86 193 67 234 C57 255 42 261 34 246"
              />
              <path
                className="antenna-right"
                d="M204 83 C220 13 245 14 243 55 C237 116 254 195 270 237 C279 257 295 261 305 244"
              />
            </g>
          </g>
        )}
        <path
          className="cartoon-tail"
          d="M207 245 C243 230 250 247 235 254 C229 257 219 255 209 253"
          fill="var(--fur-shade)"
        />
        <g className="feet" fill="var(--fur)">
          <path d="M135 237 C115 239 102 251 105 267 C108 279 132 282 150 274 L158 252Z" />
          <path d="M205 237 C225 239 238 251 235 267 C232 279 208 282 190 274 L182 252Z" />
          <path
            d="M111 269 l-4 7 10-2 M124 274 l-2 7 9-5 M138 275 l1 6 7-7 M229 269 l4 7-10-2 M216 274 l2 7-9-5 M202 275 l-1 6-7-7"
            fill="var(--ink)"
            strokeWidth="1.5"
          />
          <path
            d="M119 256 C116 265 124 269 132 264 M221 256 C224 265 216 269 208 264"
            fill="none"
            stroke="var(--fur-shade)"
          />
        </g>
        <g className="cartoon-torso">
          <path
            d="M140 167 C121 178 120 197 118 218 C112 251 136 266 170 267 C204 266 228 251 222 218 C220 197 219 178 200 167Z"
            fill="var(--fur)"
          />
          <path
            d="M151 178 C137 190 139 205 133 224 C126 247 146 258 170 258 C194 258 214 247 207 224 C201 205 203 190 189 178Z"
            fill="var(--patch)"
            stroke="none"
          />
          {angel ? (
            <path
              d="M150 181 L170 198 L190 181 L179 205 L170 212 L160 205Z"
              fill="#fff9fc"
              stroke="none"
            />
          ) : (
            <path
              d="M155 180 L153 192 L160 187 L159 202 L166 195 L171 207 L176 194 L183 199 L182 183Z"
              fill="var(--patch)"
              stroke="var(--fur-shade)"
              strokeWidth="1.5"
            />
          )}
        </g>
        <g className="cartoon-head">
          <g className="cartoon-ear ear-left" fill="var(--fur)">
            <path
              d={
                angel
                  ? "M117 96 C97 75 90 30 61 17 C37 7 38 54 54 93 C65 124 88 144 114 143Z"
                  : "M115 98 C87 81 69 33 30 21 C11 17 17 58 24 79 L40 83 L26 94 C47 126 78 144 112 144Z"
              }
            />
            <path
              d={
                angel
                  ? "M105 105 C86 78 77 35 60 31 C49 28 52 69 65 97 C76 119 90 130 105 132Z"
                  : "M104 110 C77 89 57 44 31 35 C25 38 27 56 33 70 L53 82 L39 96 C57 115 80 130 103 133Z"
              }
              fill="var(--ear)"
              stroke="none"
            />
          </g>
          <g className="cartoon-ear ear-right" fill="var(--fur)">
            <path
              d={
                angel
                  ? "M223 96 C243 75 250 30 279 17 C303 7 302 54 286 93 C275 124 252 144 226 143Z"
                  : "M225 98 C253 81 271 33 310 21 C329 17 323 58 316 79 L300 83 L314 94 C293 126 262 144 228 144Z"
              }
            />
            <path
              d={
                angel
                  ? "M235 105 C254 78 263 35 280 31 C291 28 288 69 275 97 C264 119 250 130 235 132Z"
                  : "M236 110 C263 89 283 44 309 35 C315 38 313 56 307 70 L287 82 L301 96 C283 115 260 130 237 133Z"
              }
              fill="var(--ear)"
              stroke="none"
            />
          </g>
          <path
            d="M98 112 C97 77 127 57 170 59 C213 57 243 77 242 112 L238 145 C232 167 204 181 170 181 C136 181 108 167 102 145Z"
            fill="var(--fur)"
          />
          {!angel && (
            <path
              d="M145 62 L154 50 L159 57 L170 45 L171 56 L185 51 L180 61"
              fill="var(--fur)"
            />
          )}
          <path
            d="M106 143 C125 150 143 154 170 154 C197 154 215 150 234 143 C234 164 208 178 170 178 C132 178 106 164 106 143Z"
            fill="var(--patch)"
            stroke="none"
          />
          <path
            d="M109 117 C108 92 120 79 134 80 C148 82 151 111 154 137 C142 148 119 148 108 137Z M231 117 C232 92 220 79 206 80 C192 82 189 111 186 137 C198 148 221 148 232 137Z"
            fill="var(--patch)"
            stroke="none"
          />
          <g className="cartoon-eyes">
            <path
              d="M118 119 C114 106 120 91 129 91 C141 92 147 111 145 129 C136 139 123 135 118 119Z M222 119 C226 106 220 91 211 91 C199 92 193 111 195 129 C204 139 217 135 222 119Z"
              fill="#081624"
              stroke="#081624"
              strokeWidth="2"
            />
            <path
              d="M122 125 Q133 137 142 126 M218 125 Q207 137 198 126"
              fill="none"
              stroke="#244962"
              strokeWidth="4"
            />
            <ellipse
              cx="127"
              cy="101"
              rx="4.5"
              ry="6.5"
              fill="white"
              stroke="none"
            />
            <ellipse
              cx="210"
              cy="101"
              rx="4.5"
              ry="6.5"
              fill="white"
              stroke="none"
            />
          </g>
          <g className="cartoon-blink" fill="none" strokeWidth="3.5">
            <path d="M117 119 Q130 130 145 121 M195 121 Q210 130 223 119" />
          </g>
          {angel && (
            <g
              className="cartoon-lashes"
              fill="none"
              stroke="#331e34"
              strokeWidth="3.5"
            >
              <path d="M121 97 Q110 99 104 88 M120 100 Q110 105 102 96 M219 97 Q230 99 236 88 M220 100 Q230 105 238 96" />
            </g>
          )}
          <g className="cartoon-brows" fill="none" strokeWidth="2.5">
            <path d="M119 80 Q132 72 143 81 M197 81 Q208 72 221 80" />
          </g>
          <path
            className="cartoon-nose"
            d="M148 121 C146 107 194 107 192 121 C190 131 179 144 170 145 C161 144 150 131 148 121Z"
            fill="var(--nose)"
          />
          <path
            d="M155 117 Q170 111 182 117"
            stroke="white"
            strokeOpacity=".28"
            strokeWidth="2.5"
            fill="none"
          />
          <g className="cartoon-smile" fill="none" strokeWidth="2.5">
            <path d="M124 151 Q170 172 216 151 M124 148 Q120 149 120 154 M216 148 Q220 149 220 154" />
          </g>
          <g className="cartoon-grin">
            <path
              d="M124 150 Q170 163 216 150 Q202 174 170 174 Q138 174 124 150Z"
              fill="#182c49"
            />
            <path
              d="M134 154 Q170 163 206 154 L202 159 Q170 166 138 159Z"
              fill="#fffdf7"
              stroke="none"
            />
            <path
              d="M155 171 Q170 160 185 171 Q170 177 155 171Z"
              fill={angel ? "#76d1ec" : "#ed97aa"}
              stroke="none"
            />
          </g>
          {angel && (
            <g
              className="cartoon-flower"
              transform="translate(208 59)"
              stroke="#a92468"
              strokeWidth="2"
              fill="#f34c9b"
            >
              <path d="M0 1 C-28-4-27-24-12-24 C-6-24-2-15 0-9 C0-30 19-32 23-18 C26-9 12-2 5 1 C30-6 39 11 28 20 C19 28 9 14 3 8 C15 32-4 39-12 26 C-16 20-7 11-3 6 C-27 21-41 5-26-4 C-17-9-7-2 0 1Z" />
              <path
                d="M0 3 Q3-7 11-13 M0 3 Q14 4 22 13 M0 3 Q-6 17-6 24 M0 3 Q-15 4-24 2"
                fill="none"
                stroke="#ff9dcc"
              />
              <path
                d="M0 3 Q3-11 0-21"
                fill="none"
                stroke="#ffd66b"
                strokeWidth="3"
              />
              <circle cx="0" cy="-22" r="3" fill="#ffdf68" stroke="none" />
            </g>
          )}
        </g>
        <g className="cartoon-arm arm-left" fill="var(--fur)">
          <path d="M132 181 C118 177 109 188 105 206 L101 227 C96 237 104 246 113 242 C127 233 130 209 138 195Z" />
          <g className="cartoon-hand hand-left">
            <path d="M102 228 C95 224 92 228 96 235 C86 229 83 235 91 242 C83 239 82 245 91 249 C86 249 90 257 101 253 L115 240Z" />
            <path
              d="M91 241 l-4-4 M92 248 l-5-2 M98 254 l-3 3"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="3.5"
            />
          </g>
        </g>
        <g className="cartoon-arm arm-right" fill="var(--fur)">
          <path d="M208 181 C222 177 231 188 235 206 L239 227 C244 237 236 246 227 242 C213 233 210 209 202 195Z" />
          <g className="cartoon-hand hand-right">
            <path d="M238 228 C245 224 248 228 244 235 C254 229 257 235 249 242 C257 239 258 245 249 249 C254 249 250 257 239 253 L225 240Z" />
            <path
              d="M249 241 l4-4 M248 248 l5-2 M242 254 l3 3"
              fill="none"
              stroke="var(--ink)"
              strokeWidth="3.5"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}
