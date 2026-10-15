import { useId } from "react";
import type { CompanionMood } from "../../services/mascotState";
import type { Motion } from "./types";
import "./bulldog.css";

export default function BulldogCharacter({
  mood = "neutral",
  motion = "idle",
  running = true,
}: {
  mood?: CompanionMood;
  motion?: Motion;
  running?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const happy = mood === "happy" || mood === "celebrate";
  const sad = mood === "support";
  const label = sad ? "triste" : happy ? "contento" : "neutral";
  return (
    <svg
      className="cartoon-character bulldog-character"
      viewBox="0 0 240 250"
      role="img"
      aria-label={`Bulldog francés negro atigrado, pechito blanco, ${label}`}
      data-motion={motion}
      data-mood={mood}
      data-running={running}
    >
      <defs>
        <linearGradient id={`${id}-fur`} x2="0.8" y2="1">
          <stop stopColor="#41444a" />
          <stop offset=".55" stopColor="#292d33" />
          <stop offset="1" stopColor="#1c2027" />
        </linearGradient>
        <linearGradient id={`${id}-ear`} x2=".7" y2="1">
          <stop stopColor="#76554c" />
          <stop offset="1" stopColor="#3c3032" />
        </linearGradient>
        <clipPath id={`${id}-body`}>
          <path d="M76 137C47 147 40 183 50 217L81 228L156 228L188 216C198 181 185 149 161 137Z" />
        </clipPath>
        <clipPath id={`${id}-head`}>
          <path d="M57 94C59 57 181 57 185 94L194 128C200 158 168 181 121 182C72 182 40 161 47 129Z" />
        </clipPath>
      </defs>
      <ellipse
        cx="120"
        cy="239"
        rx="77"
        ry="7"
        fill="currentColor"
        opacity=".1"
      />
      <g
        className="cartoon-body dog-body"
        stroke="#171c24"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path
          className="dog-tail"
          d="M178 190Q208 184 204 209Q198 221 185 208"
          fill={`url(#${id}-fur)`}
        />
        <path
          d="M76 137C47 147 40 183 50 217L81 228L156 228L188 216C198 181 185 149 161 137Z"
          fill={`url(#${id}-fur)`}
        />
        <g
          clipPath={`url(#${id}-body)`}
          stroke="#94704b"
          strokeWidth="5"
          opacity=".48"
          fill="none"
        >
          <path d="M44 156L81 179M43 176L80 196M40 197L74 217M183 150L158 177M197 165L164 194M199 189L165 215M81 142L93 158" />
        </g>
        <path
          d="M88 159L100 155L105 164L120 159L135 165L144 158L155 163L150 191L137 212L124 218L105 207L91 187Z"
          fill="#f5f4ee"
          stroke="#dddeda"
          strokeWidth="1.5"
        />
        <path
          d="M61 173Q56 194 60 215Q40 214 39 229Q43 240 73 235Q85 231 81 220L85 188"
          fill={`url(#${id}-fur)`}
        />
        <path
          d="M156 188L160 219Q157 232 171 235Q199 239 201 229Q199 216 181 214Q184 193 178 174"
          fill={`url(#${id}-fur)`}
        />
        <path
          d="M91 190L89 220Q76 223 79 235Q88 244 111 237L114 199"
          fill={`url(#${id}-fur)`}
        />
        <g className="dog-paw">
          <path
            d="M128 199L128 233Q143 244 160 236Q165 224 149 220L150 189"
            fill={`url(#${id}-fur)`}
          />
          <path d="M138 231L138 237M148 231L149 238" fill="none" />
        </g>
        <path
          d="M49 227L49 234M59 227L60 235M91 231L91 238M101 230L102 238M179 228L178 236M189 227L189 234"
          fill="none"
        />
        <path
          d="M76 166Q117 181 166 166"
          stroke="var(--dog-accent, #73b8eb)"
          strokeWidth="7"
          fill="none"
        />
        <circle cx="121" cy="176" r="5" fill="#ece9db" strokeWidth="1.5" />
        <g className="dog-head">
          <g className="dog-ear dog-ear-left">
            <path
              d="M64 100C41 92 23 33 38 15C51 2 78 42 83 83Z"
              fill={`url(#${id}-fur)`}
            />
            <path
              d="M59 83C45 67 37 31 42 26C50 23 69 52 70 76Z"
              fill={`url(#${id}-ear)`}
              stroke="#4b3b38"
              strokeWidth="1.5"
            />
            <path
              d="M42 31Q45 52 56 62"
              stroke="#ad7954"
              strokeWidth="3"
              opacity=".35"
              fill="none"
            />
          </g>
          <g className="dog-ear dog-ear-right">
            <path
              d="M156 84C164 43 194 3 205 18C217 38 197 94 178 102Z"
              fill={`url(#${id}-fur)`}
            />
            <path
              d="M168 77C173 51 192 26 198 29C202 41 189 73 179 85Z"
              fill={`url(#${id}-ear)`}
              stroke="#4b3b38"
              strokeWidth="1.5"
            />
            <path
              d="M195 35Q188 58 181 66"
              stroke="#ad7954"
              strokeWidth="3"
              opacity=".35"
              fill="none"
            />
          </g>
          <path
            d="M57 94C59 57 181 57 185 94L194 128C200 158 168 181 121 182C72 182 40 161 47 129Z"
            fill={`url(#${id}-fur)`}
          />
          <g
            clipPath={`url(#${id}-head)`}
            fill="none"
            stroke="#987349"
            strokeWidth="4.5"
            opacity=".48"
          >
            <path d="M50 79L84 93M55 68L94 84M89 61L108 83M140 62L133 85M165 70L149 90M183 86L163 102M47 113L63 121M185 118L196 111M50 144L65 148M175 153L190 145" />
          </g>
          <path
            d="M100 83Q121 73 140 84M103 94Q120 87 137 94"
            stroke="#171b22"
            fill="none"
          />
          <path
            d={
              sad
                ? "M65 103Q78 93 91 91M151 91Q165 94 179 104"
                : "M64 100Q78 88 93 97M149 97Q164 89 179 101"
            }
            stroke="#60636a"
            strokeWidth="4"
            fill="none"
          />
          <g className="dog-open-eyes">
            <ellipse
              cx="79"
              cy="115"
              rx="17"
              ry="19"
              fill="#141920"
              stroke="#515762"
              strokeWidth="3"
            />
            <ellipse
              cx="162"
              cy="115"
              rx="17"
              ry="19"
              fill="#141920"
              stroke="#515762"
              strokeWidth="3"
            />
            <g className="dog-pupils">
              <ellipse
                cx="80"
                cy="117"
                rx="11"
                ry="13"
                fill="#745344"
                stroke="#a47a52"
                strokeWidth="1"
              />
              <ellipse
                cx="161"
                cy="117"
                rx="11"
                ry="13"
                fill="#745344"
                stroke="#a47a52"
                strokeWidth="1"
              />
              <ellipse
                cx="81"
                cy="116"
                rx="7.5"
                ry="10"
                fill="#111821"
                stroke="none"
              />
              <ellipse
                cx="160"
                cy="116"
                rx="7.5"
                ry="10"
                fill="#111821"
                stroke="none"
              />
              <g fill="white" stroke="none">
                <ellipse cx="76" cy="109" rx="4.5" ry="5" />
                <ellipse cx="156" cy="109" rx="4.5" ry="5" />
                <circle cx="85" cy="123" r="2" />
                <circle cx="166" cy="123" r="2" />
              </g>
            </g>
          </g>
          <g
            className="dog-closed-eyes"
            fill="none"
            stroke="#85868b"
            strokeWidth="3"
          >
            <path d="M65 116Q79 124 93 116M148 116Q162 124 176 116" />
          </g>
          <path
            d="M82 137Q83 113 104 110Q121 103 140 112Q158 115 159 139"
            fill="#353940"
            stroke="#171b22"
            strokeWidth="3"
          />
          <path
            d="M92 130Q120 115 149 132M96 124Q120 109 146 126"
            fill="none"
            stroke="#626368"
            strokeWidth="2"
          />
          <path
            d="M87 154Q121 140 155 154L150 168Q121 183 91 168Z"
            fill="#141920"
          />
          {happy && (
            <path
              className="dog-tongue"
              d="M108 163Q121 158 134 163L131 177Q121 189 111 177Z"
              fill="#de8d9c"
              stroke="#a85e70"
              strokeWidth="1.5"
            />
          )}
          <path
            d="M120 143C107 129 83 130 74 145C63 167 85 179 105 166L120 157L135 166C157 178 178 165 166 145C157 130 133 129 120 143Z"
            fill="#3f4247"
            stroke="#20252c"
          />
          <g fill="#8d887e" stroke="none" opacity=".55">
            <circle cx="85" cy="148" r="1.5" />
            <circle cx="94" cy="146" r="1.5" />
            <circle cx="89" cy="156" r="1.5" />
            <circle cx="150" cy="147" r="1.5" />
            <circle cx="158" cy="150" r="1.5" />
            <circle cx="153" cy="156" r="1.5" />
          </g>
          <path
            d="M104 127Q120 119 138 127Q140 137 121 144Q102 138 104 127Z"
            fill="#11171f"
            stroke="#090e15"
          />
          <path
            d="M108 127Q120 122 132 127"
            stroke="#70747b"
            strokeWidth="2"
            fill="none"
          />
          <path d="M120 142V154" stroke="#11171f" strokeWidth="2" />
          <path
            d={
              sad
                ? "M109 168Q121 162 133 168"
                : happy
                  ? "M108 162Q121 170 135 161"
                  : "M111 166Q121 169 131 166"
            }
            fill="none"
            stroke="#171c23"
            strokeWidth="2.5"
          />
          <path
            d="M110 176L115 174L119 177L126 174L132 176L127 181L116 182Z"
            fill="#e1e0d7"
            stroke="none"
          />
        </g>
      </g>
    </svg>
  );
}
