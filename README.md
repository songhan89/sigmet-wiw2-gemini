# APAC SIGMET Operations & Timeline Monitor

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=for-the-badge&logo=github)](https://songhan89.github.io/sigmet-wiw2-gemini/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre%20GL-4.7-3969EC?style=for-the-badge&logo=maplibre&logoColor=white)](https://maplibre.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A modern proof-of-concept aviation meteorological platform for ingesting, validating, and visualizing **Significant Meteorological Information (SIGMET)** in traditional alphanumeric (TAC) and ICAO IWXXM XML formats across the **Singapore (WSJC)** and **Jakarta (WIIF)** Flight Information Regions (FIRs).

🌐 **Live Application**: [https://songhan89.github.io/sigmet-wiw2-gemini/](https://songhan89.github.io/sigmet-wiw2-gemini/)

---

## 📁 Repository Structure & Code Location

```
sigmet-wiw2-gemini/
├── README.md                      # Repository documentation (this file)
├── generate_sigmet_banners.py     # Corrected Python pipeline script
├── data/
│   └── aviation_sigmet/
│       └── 2026/05/               # May 2026 source bulletins & output XMLs
│           ├── 01/ ... 31/        # Daily subfolders containing:
│           │   ├── LSSR*          # IWXXM XML bulletins (source, unmodified)
│           │   ├── WSSR*          # TAC bulletins (source, unmodified)
│           │   └── Sigmetdata_*.xml # Output banner XML files (side-by-side)
├── docs/                          # ICAO APAC reference manuals & guidelines
├── reference-script/              # Legacy script (SIGMET_fnl3_v3.py)
└── sigmet-poc/                    # Frontend React Web Application
    ├── public/
    │   └── symbols/               # Official WMO / ICAO SVG weather symbols
    ├── src/
    │   ├── components/
    │   │   ├── BannerSection.tsx  # Top active & cancellation banners
    │   │   ├── SigmetMap.tsx      # MapLibre GL map powered by MapTiler
    │   │   ├── TimePlayer.tsx     # 30-min simulation timeline scrubber
    │   │   └── WeatherIcon.tsx    # WMO vector glyphs & text fallback
    │   ├── data/
    │   │   └── sigmet_dataset.json# Parsed SIGMET dataset (193 bulletins)
    │   ├── types/
    │   │   └── sigmet.ts          # TypeScript domain models
    │   ├── App.tsx                # Main simulation application layout
    │   ├── main.tsx               # Application entry point
    │   └── index.css              # Custom styling & dark-theme popups
    ├── package.json
    ├── tailwind.config.js
    └── vite.config.ts
```

---

## 🚀 Key Features

### 1. Dynamic Warning Banner Section
- **Active Warnings**: Real-time cards displaying FIR, validity time range, flight level, and movement.
- **Cancellation Pairing**: When a cancellation occurs (e.g. `B03` cancelling `B01`), the banner displays the cancellation notice **together with the complete content and alphanumeric text of the cancelled SIGMET**, persisting until the original scheduled expiry time so operators know exactly what was superseded.

### 2. Geospatial MapLibre Visualization
- **Polygon Hazards**: Active hazard polygons rendered over MapTiler dark/satellite basemaps. Cancelled polygons are removed from the map upon cancellation.
- **Official WMO Weather Symbols**: Embeds official ICAO/WMO Significant Weather symbols (e.g. WMO 17 for `EMBD_TS`, ICAO arc for `SEV_ICE`) with automatic graceful fallback to text phenomenon badges (`TS`, `ICE`, `TURB`).
- **Centroid Intensity Badges**: Adjacent pills indicating intensity trend:
  - `▲ INTSF` (Intensifying - Red)
  - `= NC` (No Change - Neutral)
  - `▼ WKN` (Weakening - Sky Blue)
- **Movement Direction & Speed**: Directional vectors originating from polygon centroids indicating track direction (e.g. `270°`) and speed (e.g. `10 KT`).
- **Tabbed Interactive Popups**: Click any polygon to inspect:
  - **Alphanumeric TAC**: Raw terminal-styled message extracted from the IWXXM comment.
  - **Decoded Breakdown**: Structured view of FIR, validity, phenomenon, flight level, and motion.

### 3. 30-Minute Time Simulation Player
- Scans through May 1, 2026 00:00 UTC to May 31, 2026 23:30 UTC (1,488 steps).
- Play/Pause, speed adjustment (1x, 2x, 5x, 10x), Step ±30m, date quick-jumpers, and **Prev/Next Hazard Jumpers**.

---

## 🛠️ Running Locally

### 1. Run the Web Application
```bash
cd sigmet-poc
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Run the Banner XML Pipeline
To regenerate the `Sigmetdata_YYYYMMDD_HHMM.xml` interface files and refresh the web JSON dataset:
```bash
python3 generate_sigmet_banners.py
```
This processes all 193 bulletins and outputs XML files side-by-side in `data/aviation_sigmet/2026/05/XX/` without modifying source files.
