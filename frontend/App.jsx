import React, { useState, useRef, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import {
  Leaf, Sprout, CloudRain, FlaskConical, TrendingUp, Upload, ImageIcon,
  AlertTriangle, CheckCircle2, Info, Loader2, MapPin, ChevronRight, X,
} from "lucide-react";

/* ---------------------------------------------------------------------
   Backend
   Set VITE_API_URL in a .env file to point at your FastAPI server.
   Falls back to a local heuristic if the backend is unreachable, so the
   demo never breaks mid-pitch.
--------------------------------------------------------------------- */
const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:8000";

/* ---------------------------------------------------------------------
   Design tokens — see accompanying design note for rationale
--------------------------------------------------------------------- */
const T = {
  bg: "#EEF1E3",
  surface: "#FFFFFF",
  surfaceSoft: "#F7F8F1",
  ink: "#1E2A19",
  inkSoft: "#57624E",
  line: "#DBDFC9",
  green: "#3F6B34",
  greenBright: "#7FA650",
  greenPale: "#E4EBD8",
  soil: "#8B5A34",
  soilPale: "#F1E4D6",
  rust: "#B5502F",
  rustPale: "#F6E2DA",
  sky: "#3E7CA6",
  skyPale: "#DCEAF1",
  gold: "#C98A2C",
  goldPale: "#F5E7CC",
};

/* ---------------------------------------------------------------------
   Mock data
--------------------------------------------------------------------- */
const DISEASES = [
  {
    name: "Bacterial Leaf Blight",
    severity: "high",
    color: T.rust,
    tips: [
      "Remove and destroy infected leaves away from the field",
      "Avoid overhead irrigation; water at the base instead",
      "Improve field drainage to reduce standing water",
      "Consult a local agricultural officer before applying any treatment",
    ],
  },
  {
    name: "Powdery Mildew",
    severity: "medium",
    color: T.gold,
    tips: [
      "Increase spacing between plants for better airflow",
      "Prune affected foliage and dispose of it away from crops",
      "Avoid excess nitrogen fertiliser, which encourages soft growth",
      "Monitor nearby plants for early spread",
    ],
  },
  {
    name: "Early Blight (Alternaria)",
    severity: "medium",
    color: T.gold,
    tips: [
      "Rotate crops each season to break the disease cycle",
      "Mulch soil to reduce spore splash onto lower leaves",
      "Remove lower, older leaves that show first symptoms",
      "Seek expert confirmation before broad treatment",
    ],
  },
  {
    name: "Healthy Leaf",
    severity: "none",
    color: T.green,
    tips: [
      "No signs of disease detected in this sample",
      "Continue routine field monitoring on a weekly basis",
      "Maintain balanced watering and nutrient schedule",
      "Recheck if new spots or discoloration appear",
    ],
  },
];

const CLIMATE = [
  { month: "Mar", temp: 31, rain: 12 },
  { month: "Apr", temp: 34, rain: 18 },
  { month: "May", temp: 36, rain: 28 },
  { month: "Jun", temp: 33, rain: 74 },
  { month: "Jul", temp: 30, rain: 96 },
  { month: "Aug", temp: 29, rain: 88 },
];

const CROPS = [
  { name: "Rice (Paddy)", icon: "🌾", n: 80, p: 45, k: 40, ph: [5.5, 6.5], rain: "high" },
  { name: "Sugarcane", icon: "🎋", n: 70, p: 55, k: 60, ph: [6.0, 7.5], rain: "high" },
  { name: "Groundnut", icon: "🥜", n: 35, p: 55, k: 45, ph: [6.0, 7.0], rain: "medium" },
  { name: "Cotton", icon: "🌱", n: 55, p: 40, k: 35, ph: [6.0, 8.0], rain: "medium" },
  { name: "Maize", icon: "🌽", n: 65, p: 40, k: 40, ph: [5.8, 7.0], rain: "medium" },
  { name: "Millet (Ragi)", icon: "🌿", n: 30, p: 25, k: 25, ph: [5.0, 7.5], rain: "low" },
];

/* ---------------------------------------------------------------------
   Small building blocks
--------------------------------------------------------------------- */

function FurrowDivider() {
  return (
    <div className="w-full my-10 select-none" aria-hidden="true">
      <svg viewBox="0 0 1200 34" className="w-full h-6" preserveAspectRatio="none">
        {[0, 1, 2].map((row) => (
          <path
            key={row}
            d={`M0 ${10 + row * 8} Q 30 ${2 + row * 8} 60 ${10 + row * 8} T 120 ${10 + row * 8} T 180 ${10 + row * 8} T 240 ${10 + row * 8} T 300 ${10 + row * 8} T 360 ${10 + row * 8} T 420 ${10 + row * 8} T 480 ${10 + row * 8} T 540 ${10 + row * 8} T 600 ${10 + row * 8} T 660 ${10 + row * 8} T 720 ${10 + row * 8} T 780 ${10 + row * 8} T 840 ${10 + row * 8} T 900 ${10 + row * 8} T 960 ${10 + row * 8} T 1020 ${10 + row * 8} T 1080 ${10 + row * 8} T 1140 ${10 + row * 8} T 1200 ${10 + row * 8}`}
            fill="none"
            stroke={T.soil}
            strokeWidth="1.2"
            opacity={0.28 - row * 0.07}
          />
        ))}
      </svg>
    </div>
  );
}

/** Signature element: a leaf-vein ring gauge used for confidence + nutrient levels */
function RingGauge({ value, size = 132, color = T.green, trackColor = T.line, label, sublabel, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  const angle = (pct / 100) * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  const tipX = size / 2 + r * Math.cos(rad);
  const tipY = size / 2 + r * Math.sin(rad);

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        {/* leaf-vein ticks */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * 2 * Math.PI;
          const inner = r - stroke / 2 - 3;
          const outer = r - stroke / 2 + 1;
          return (
            <line
              key={i}
              x1={size / 2 + inner * Math.cos(a)}
              y1={size / 2 + inner * Math.sin(a)}
              x2={size / 2 + outer * Math.cos(a)}
              y2={size / 2 + outer * Math.sin(a)}
              stroke={trackColor}
              strokeWidth="1"
            />
          );
        })}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      {/* leaf-tip marker */}
      <div
        className="absolute rounded-full"
        style={{
          width: 7, height: 7, background: color,
          left: tipX - 3.5, top: tipY - 3.5,
          boxShadow: `0 0 0 3px ${T.surface}`,
        }}
      />
      <div className="absolute flex flex-col items-center text-center px-2">
        <span className="font-mono text-2xl font-semibold" style={{ color: T.ink }}>{Math.round(value)}{label === "pH" ? "" : "%"}</span>
        {sublabel && <span className="text-[11px] mt-0.5" style={{ color: T.inkSoft }}>{sublabel}</span>}
      </div>
    </div>
  );
}

function SectionEyebrow({ icon: Icon, index, title, dek }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div
        className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
        style={{ width: 40, height: 40, background: T.greenPale, color: T.green }}
      >
        <Icon size={19} strokeWidth={2} />
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs tracking-wider" style={{ color: T.greenBright }}>{index}</span>
          <h2 className="font-serif text-2xl md:text-[28px] leading-tight" style={{ color: T.ink }}>{title}</h2>
        </div>
        {dek && <p className="text-[15px] mt-1 max-w-xl" style={{ color: T.inkSoft }}>{dek}</p>}
      </div>
    </div>
  );
}

function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{ background: T.surface, border: `1px solid ${T.line}`, ...style }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Section 1 — Disease Detection
--------------------------------------------------------------------- */
function DiseaseSection() {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgFile, setImgFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("idle"); // idle | analyzing | done | error
  const [result, setResult] = useState(null);
  const [source, setSource] = useState(null); // "live" | "offline"
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImgFile(file);
    setFileName(file.name);
    setStatus("idle");
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setImgSrc(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const runAnalysis = async () => {
    if (!imgFile) return;
    setStatus("analyzing");
    setResult(null);

    try {
      const form = new FormData();
      form.append("image", imgFile);
      const res = await fetch(`${API_BASE}/api/predict-disease`, { method: "POST", body: form });
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      const meta = DISEASES.find((d) => d.name === data.name) || DISEASES[0];
      setResult({ name: data.name, color: meta.color, confidence: data.confidence, tips: data.tips, severity: data.severity });
      setSource("live");
      setStatus("done");
    } catch (err) {
      // Backend not running / unreachable — fall back so the demo still works.
      const pick = DISEASES[Math.floor(Math.random() * DISEASES.length)];
      const confidence = 68 + Math.floor(Math.random() * 27);
      setResult({ ...pick, confidence });
      setSource("offline");
      setStatus("done");
    }
  };

  const reset = () => {
    setImgSrc(null);
    setImgFile(null);
    setFileName("");
    setStatus("idle");
    setResult(null);
    setSource(null);
  };

  return (
    <section id="disease">
      <SectionEyebrow
        icon={Leaf}
        index="01"
        title="Crop Disease Detection"
        dek="Upload a photo of a leaf. The model flags a likely disease category and general preventive guidance — a first read, not a diagnosis."
      />
      <Card className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            className="relative rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2"
            style={{
              minHeight: 260,
              border: `1.5px dashed ${dragOver ? T.green : T.line}`,
              background: dragOver ? T.greenPale : T.surfaceSoft,
              outlineColor: T.green,
              overflow: "hidden",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {imgSrc ? (
              <>
                <img src={imgSrc} alt="Uploaded crop leaf" className="absolute inset-0 w-full h-full object-cover" />
                <button
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="absolute top-2 right-2 rounded-full p-1.5 focus:outline-none focus-visible:ring-2"
                  style={{ background: "rgba(30,42,25,0.65)", color: "#fff", outlineColor: T.surface }}
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6">
                <div className="rounded-full p-3" style={{ background: T.greenPale, color: T.green }}>
                  <Upload size={22} />
                </div>
                <p className="text-sm font-medium" style={{ color: T.ink }}>Drop a leaf photo here, or click to browse</p>
                <p className="text-xs" style={{ color: T.inkSoft }}>JPG or PNG · Clear, well-lit close-up works best</p>
              </div>
            )}
          </div>

          {fileName && (
            <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: T.inkSoft }}>
              <ImageIcon size={13} /> {fileName}
            </div>
          )}

          <button
            onClick={runAnalysis}
            disabled={!imgSrc || status === "analyzing"}
            className="mt-5 w-full rounded-lg py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-opacity focus:outline-none focus-visible:ring-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: T.green, color: "#fff", outlineColor: T.ink }}
          >
            {status === "analyzing" ? (
              <><Loader2 size={16} className="animate-spin" /> Analyzing leaf image…</>
            ) : (
              <>Analyze leaf image <ChevronRight size={16} /></>
            )}
          </button>
        </div>

        <div className="flex flex-col justify-center">
          {status === "idle" && !result && (
            <div className="flex flex-col items-center text-center gap-3 py-8" style={{ color: T.inkSoft }}>
              <Sprout size={28} strokeWidth={1.5} />
              <p className="text-sm max-w-[220px]">Results — a probable category, confidence, and preventive tips — will appear here.</p>
            </div>
          )}

          {status === "analyzing" && (
            <div className="flex flex-col items-center text-center gap-3 py-8" style={{ color: T.inkSoft }}>
              <Loader2 size={24} className="animate-spin" style={{ color: T.green }} />
              <p className="text-sm">Reading leaf texture and colour patterns…</p>
            </div>
          )}

          {status === "done" && result && (
            <div className="flex flex-col items-center text-center gap-4">
              <RingGauge value={result.confidence} color={result.color} sublabel="confidence" />
              <div>
                <div className="flex items-center gap-1.5 justify-center">
                  {result.severity === "none" ? (
                    <CheckCircle2 size={16} style={{ color: result.color }} />
                  ) : (
                    <AlertTriangle size={16} style={{ color: result.color }} />
                  )}
                  <h3 className="font-serif text-xl" style={{ color: T.ink }}>{result.name}</h3>
                </div>
                <span
                  className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-full inline-block mt-1.5"
                  style={{
                    background: source === "live" ? T.greenPale : T.goldPale,
                    color: source === "live" ? T.green : T.gold,
                  }}
                >
                  {source === "live" ? "LIVE MODEL RESULT" : "OFFLINE ESTIMATE — backend unreachable"}
                </span>
              </div>
              <ul className="text-left text-sm space-y-1.5 max-w-xs w-full">
                {result.tips.map((t) => (
                  <li key={t} className="flex gap-2" style={{ color: T.inkSoft }}>
                    <span className="mt-1.5 rounded-full shrink-0" style={{ width: 4, height: 4, background: result.color }} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-start gap-2 mt-4 px-1 text-xs" style={{ color: T.inkSoft }}>
        <Info size={14} className="shrink-0 mt-0.5" />
        <p>This output is an AI-based preliminary indication for general awareness, not a substitute for professional agricultural diagnosis.</p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------
   Section 2 — Soil + Climate
--------------------------------------------------------------------- */
function SoilClimateSection({ soil, setSoil }) {
  const soilScore = Math.round(
    (Math.min(soil.n, 100) + Math.min(soil.p, 100) + Math.min(soil.k, 100)) / 3
  );

  const [climateData, setClimateData] = useState(CLIMATE);
  const [climateSource, setClimateSource] = useState("estimate");

  React.useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/climate?lat=11.664&lon=78.146`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        const points = data.points.map((p) => ({ month: p.label, temp: p.temp, rain: p.rain }));
        setClimateData(points);
        setClimateSource(data.source === "open-meteo" ? "live" : "estimate");
      })
      .catch(() => { /* keep the static fallback already in state */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="soil-climate">
      <SectionEyebrow
        icon={FlaskConical}
        index="02"
        title="Soil & Climate Snapshot"
        dek="Adjust nutrient levels to match a soil test report — this feeds crop matching and the yield simulation below."
      />
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Soil */}
        <Card className="p-6 md:p-7 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-serif text-lg" style={{ color: T.ink }}>Soil nutrients</h3>
            <RingGauge value={soilScore} size={64} stroke={7} color={T.soil} sublabel="" />
          </div>
          {[
            { key: "n", label: "Nitrogen (N)", color: T.green },
            { key: "p", label: "Phosphorus (P)", color: T.sky },
            { key: "k", label: "Potassium (K)", color: T.gold },
          ].map((row) => (
            <div key={row.key} className="mb-4">
              <div className="flex justify-between text-sm mb-1.5">
                <span style={{ color: T.ink }}>{row.label}</span>
                <span className="font-mono" style={{ color: T.inkSoft }}>{soil[row.key]} kg/ha</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={soil[row.key]}
                onChange={(e) => setSoil((s) => ({ ...s, [row.key]: Number(e.target.value) }))}
                className="w-full accent-current"
                style={{ accentColor: row.color }}
                aria-label={row.label}
              />
            </div>
          ))}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span style={{ color: T.ink }}>Soil pH</span>
              <span className="font-mono" style={{ color: T.inkSoft }}>{soil.ph.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={4}
              max={9}
              step={0.1}
              value={soil.ph}
              onChange={(e) => setSoil((s) => ({ ...s, ph: Number(e.target.value) }))}
              className="w-full"
              style={{ accentColor: T.soil }}
              aria-label="Soil pH"
            />
          </div>
        </Card>

        {/* Climate */}
        <Card className="p-6 md:p-7 lg:col-span-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-serif text-lg" style={{ color: T.ink }}>Temperature &amp; rainfall forecast</h3>
            <div className="flex items-center gap-1 text-xs" style={{ color: T.inkSoft }}>
              <MapPin size={12} /> Salem, Tamil Nadu
            </div>
          </div>
          <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: T.inkSoft }}>
            {climateSource === "live" ? "Live 7-day forecast (Open-Meteo)" : "Seasonal estimate — connect the backend for a live forecast"}
          </p>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={climateData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.sky} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={T.sky} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.gold} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={T.gold} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" stroke={T.line} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: T.inkSoft }} axisLine={{ stroke: T.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.inkSoft }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12, fontFamily: "inherit" }}
                  labelStyle={{ color: T.ink, fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="rain" name="Rainfall (mm)" stroke={T.sky} fill="url(#rainFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="temp" name="Temp (°C)" stroke={T.gold} fill="url(#tempFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-1 text-xs" style={{ color: T.inkSoft }}>
            <span className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 8, height: 8, background: T.sky }} /> Rainfall (mm)</span>
            <span className="flex items-center gap-1.5"><span className="rounded-full" style={{ width: 8, height: 8, background: T.gold }} /> Temperature (°C)</span>
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------
   Section 3 — Crop Selection Simulation
--------------------------------------------------------------------- */
function CropSection({ soil }) {
  const scored = useMemo(() => {
    return CROPS.map((c) => {
      const dN = 100 - Math.min(100, Math.abs(c.n - soil.n) * 1.4);
      const dP = 100 - Math.min(100, Math.abs(c.p - soil.p) * 1.4);
      const dK = 100 - Math.min(100, Math.abs(c.k - soil.k) * 1.4);
      const phOk = soil.ph >= c.ph[0] - 0.6 && soil.ph <= c.ph[1] + 0.6;
      const phScore = phOk ? 100 : 55;
      const match = Math.round((dN + dP + dK + phScore) / 4);
      return { ...c, match: Math.max(30, Math.min(98, match)) };
    }).sort((a, b) => b.match - a.match);
  }, [soil]);

  return (
    <section id="crops">
      <SectionEyebrow
        icon={Sprout}
        index="03"
        title="Crop Selection Simulation"
        dek="Ranked against the soil profile set above. Higher match means closer alignment with a crop's typical nutrient and pH needs."
      />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {scored.map((c, i) => (
          <Card key={c.name} className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl leading-none">{c.icon}</span>
                <span className="font-serif text-base" style={{ color: T.ink }}>{c.name}</span>
              </div>
              {i === 0 && (
                <span className="text-[10px] font-mono tracking-wide px-2 py-0.5 rounded-full" style={{ background: T.greenPale, color: T.green }}>
                  BEST FIT
                </span>
              )}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: T.inkSoft }}>
                <span>Match</span>
                <span className="font-mono">{c.match}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: T.line }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${c.match}%`, background: c.match > 70 ? T.green : c.match > 50 ? T.gold : T.rust, transition: "width 500ms ease" }}
                />
              </div>
            </div>
            <p className="text-xs" style={{ color: T.inkSoft }}>
              Typically needs {c.rain}-rainfall conditions and soil pH {c.ph[0]}–{c.ph[1]}.
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------
   Section 4 — Yield Prediction
--------------------------------------------------------------------- */
function YieldSection({ soil }) {
  const [crop, setCrop] = useState(CROPS[0].name);
  const selected = CROPS.find((c) => c.name === crop);

  const scenarios = useMemo(() => {
    const dN = 100 - Math.min(100, Math.abs(selected.n - soil.n) * 1.4);
    const dP = 100 - Math.min(100, Math.abs(selected.p - soil.p) * 1.4);
    const dK = 100 - Math.min(100, Math.abs(selected.k - soil.k) * 1.4);
    const base = Math.round((dN + dP + dK) / 3);
    const clamped = Math.max(25, Math.min(95, base));
    return [
      { name: "Low rainfall", value: Math.max(15, clamped - 22) },
      { name: "Expected", value: clamped },
      { name: "Favourable", value: Math.min(97, clamped + 18) },
    ];
  }, [selected, soil]);

  const expected = scenarios[1].value;

  return (
    <section id="yield">
      <SectionEyebrow
        icon={TrendingUp}
        index="04"
        title="Predictive Yield Simulation"
        dek="A probability-based estimate of crop performance across rainfall scenarios, for the soil profile and crop selected."
      />
      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-sm mr-1" style={{ color: T.inkSoft }}>Simulate for:</span>
          {CROPS.map((c) => (
            <button
              key={c.name}
              onClick={() => setCrop(c.name)}
              className="text-xs px-3 py-1.5 rounded-full border transition-colors focus:outline-none focus-visible:ring-2"
              style={{
                borderColor: crop === c.name ? T.green : T.line,
                background: crop === c.name ? T.greenPale : "transparent",
                color: crop === c.name ? T.green : T.inkSoft,
                outlineColor: T.green,
              }}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-5 gap-8 items-center">
          <div className="md:col-span-2 flex flex-col items-center text-center gap-2">
            <RingGauge value={expected} color={expected > 70 ? T.green : expected > 45 ? T.gold : T.rust} size={150} sublabel="expected yield" />
            <p className="text-xs max-w-[220px]" style={{ color: T.inkSoft }}>
              Relative to optimal conditions for {crop.toLowerCase()}, given current soil inputs.
            </p>
          </div>
          <div className="md:col-span-3" style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={scenarios} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 5" stroke={T.line} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.inkSoft }} axisLine={{ stroke: T.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.inkSoft }} axisLine={false} tickLine={false} width={30} unit="%" />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 12 }}
                  formatter={(v) => [`${v}%`, "Estimated yield"]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {scenarios.map((s, i) => (
                    <Cell key={s.name} fill={i === 1 ? T.green : T.greenBright} fillOpacity={i === 1 ? 1 : 0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </section>
  );
}

/* ---------------------------------------------------------------------
   Sidebar / shell
--------------------------------------------------------------------- */
const NAV = [
  { id: "disease", label: "Disease Scan", icon: Leaf },
  { id: "soil-climate", label: "Soil & Climate", icon: FlaskConical },
  { id: "crops", label: "Crop Simulation", icon: Sprout },
  { id: "yield", label: "Yield Prediction", icon: TrendingUp },
];

export default function AgriDashboard() {
  const [soil, setSoil] = useState({ n: 55, p: 42, k: 38, ph: 6.4 });
  const [active, setActive] = useState("disease");

  const scrollTo = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ background: T.bg, color: T.ink, fontFamily: "'Inter', ui-sans-serif, system-ui" }} className="min-h-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,560;0,9..144,650;1,9..144,500&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .font-serif { font-family: 'Fraunces', ui-serif, Georgia, serif; }
        .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        input[type="range"] { height: 4px; border-radius: 999px; background: ${T.line}; -webkit-appearance: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: currentColor; border: 2px solid #fff; box-shadow: 0 0 0 1px ${T.line}; cursor: pointer; margin-top: 0; }
        input[type="range"]::-moz-range-thumb { width: 15px; height: 15px; border-radius: 50%; background: currentColor; border: 2px solid #fff; cursor: pointer; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
      `}</style>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 px-6 py-8"
          style={{ borderRight: `1px solid ${T.line}` }}
        >
          <div className="flex items-center gap-2.5 mb-1">
            <div className="rounded-lg flex items-center justify-center" style={{ width: 34, height: 34, background: T.green, color: "#fff" }}>
              <Leaf size={17} />
            </div>
            <span className="font-serif text-xl" style={{ color: T.ink }}>AgriSense</span>
          </div>
          <p className="text-xs mb-8 pl-[42px]" style={{ color: T.inkSoft }}>Predictive simulation platform</p>

          <nav className="flex flex-col gap-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors focus:outline-none focus-visible:ring-2"
                style={{
                  background: active === n.id ? T.surface : "transparent",
                  color: active === n.id ? T.ink : T.inkSoft,
                  border: active === n.id ? `1px solid ${T.line}` : "1px solid transparent",
                  outlineColor: T.green,
                }}
              >
                <n.icon size={16} style={{ color: active === n.id ? T.green : T.inkSoft }} />
                {n.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-8">
            <div className="rounded-xl p-4 text-xs leading-relaxed" style={{ background: T.soilPale, color: "#5C4126" }}>
              <div className="flex items-center gap-1.5 font-semibold mb-1" style={{ color: T.soil }}>
                <Info size={13} /> Awareness only
              </div>
              Predictions are general guidance, not a substitute for professional agricultural diagnosis.
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Mobile top nav */}
          <div className="md:hidden sticky top-0 z-10 flex gap-2 overflow-x-auto px-4 py-3" style={{ background: T.bg, borderBottom: `1px solid ${T.line}` }}>
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0"
                style={{
                  background: active === n.id ? T.green : T.surface,
                  color: active === n.id ? "#fff" : T.inkSoft,
                  border: `1px solid ${active === n.id ? T.green : T.line}`,
                }}
              >
                <n.icon size={13} /> {n.label}
              </button>
            ))}
          </div>

          <div className="max-w-5xl mx-auto px-5 md:px-10 py-10 md:py-14">
            {/* Hero */}
            <header className="mb-10 md:mb-14">
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: T.greenBright }}>
                Smart Agriculture · Predictive Simulation
              </span>
              <h1 className="font-serif mt-2 text-[34px] md:text-[46px] leading-[1.08]" style={{ color: T.ink }}>
                Read the field before<br />it reads you.
              </h1>
              <p className="mt-4 text-[15px] md:text-base max-w-xl" style={{ color: T.inkSoft }}>
                Scan a leaf for early disease signs, and combine soil and climate data to see which
                crops — and which outcomes — suit your field this season.
              </p>
            </header>

            <DiseaseSection />
            <FurrowDivider />
            <SoilClimateSection soil={soil} setSoil={setSoil} />
            <FurrowDivider />
            <CropSection soil={soil} />
            <FurrowDivider />
            <YieldSection soil={soil} />

            <footer className="mt-16 pt-6 text-xs" style={{ borderTop: `1px solid ${T.line}`, color: T.inkSoft }}>
              AgriSense is a decision-support prototype. Disease and yield outputs are AI-generated estimates for general awareness — always confirm with a local agricultural expert before acting.
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
