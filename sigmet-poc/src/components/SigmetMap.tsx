import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SigmetRecord } from '../types/sigmet';
import { Layers, Wind, FileText, BarChart2 } from 'lucide-react';

interface SigmetMapProps {
  activeSigmets: SigmetRecord[];
  selectedSigmet: SigmetRecord | null;
  onSelectSigmet: (sigmet: SigmetRecord) => void;
}

export const SigmetMap: React.FC<SigmetMapProps> = ({
  activeSigmets,
  selectedSigmet,
  onSelectSigmet,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const [activeTab, setActiveTab] = useState<'tac' | 'decoded'>('tac');

  const maptilerKey = import.meta.env.VITE_MAPTILER_API || '';

  // Calculate polygon centroid [lon, lat]
  const calculateCentroid = (coords: number[][][]): [number, number] => {
    if (!coords || !coords[0] || coords[0].length === 0) return [103.8, 1.35];
    const ring = coords[0];
    let sumLon = 0;
    let sumLat = 0;
    const n = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.length - 1
      : ring.length;

    for (let i = 0; i < n; i++) {
      sumLon += ring[i][0];
      sumLat += ring[i][1];
    }
    return [sumLon / n, sumLat / n];
  };

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current) return;

    // Use MapTiler Dataviz Dark or Basic
    const mapStyle = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${maptilerKey}`;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [106.5, 4.0], // Centered over Singapore & South China Sea / Jakarta FIR
      zoom: 4.8,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => {
      // 1. Add Source for Polygons
      map.addSource('sigmet-polygons', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // 2. Add Fill Layer
      map.addLayer({
        id: 'sigmet-fill',
        type: 'fill',
        source: 'sigmet-polygons',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'phenomenonCode'], 'SEV_ICE'],
            '#0284c7', // Cyan / Ice
            '#dc2626', // Red / Thunderstorm
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'isSelected'], true],
            0.45,
            0.28,
          ],
        },
      });

      // 3. Add Outline Layer
      map.addLayer({
        id: 'sigmet-outline',
        type: 'line',
        source: 'sigmet-polygons',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'isSelected'], true],
            '#60a5fa', // Bright blue highlight when selected
            ['==', ['get', 'phenomenonCode'], 'SEV_ICE'],
            '#38bdf8',
            '#ef4444',
          ],
          'line-width': [
            'case',
            ['==', ['get', 'isSelected'], true],
            3.5,
            2.2,
          ],
          'line-dasharray': [
            'case',
            ['==', ['get', 'intensityChange'], 'WEAKEN'],
            ['literal', [2, 2]],
            ['literal', [1]],
          ],
        },
      });

      // Click on polygon opens popup
      map.on('click', 'sigmet-fill', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const fileName = feature.properties?.fileName;
        const match = activeSigmets.find((s) => s.fileName === fileName);
        if (match) {
          onSelectSigmet(match);
        }
      });

      map.on('mouseenter', 'sigmet-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'sigmet-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      mapRef.current = map;
    });

    return () => {
      map.remove();
    };
  }, [maptilerKey]);

  // Update Polygons & Centroid Markers whenever activeSigmets or selectedSigmet changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Construct GeoJSON FeatureCollection
    const features = activeSigmets
      .filter((sig) => sig.geometry && sig.geometry.coordinates && sig.geometry.coordinates.length > 0)
      .map((sig) => {
        const isSelected = selectedSigmet?.fileName === sig.fileName;
        return {
          type: 'Feature' as const,
          properties: {
            fileName: sig.fileName,
            sequenceNumber: sig.sequenceNumber,
            firCode: sig.firCode,
            phenomenonCode: sig.phenomenonCode,
            intensityChange: sig.intensityChange,
            isSelected,
          },
          geometry: sig.geometry,
        };
      });

    const source = map.getSource('sigmet-polygons') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features,
      });
    }

    // Add Custom HTML Markers for each active polygon at centroid
    activeSigmets.forEach((sig) => {
      if (!sig.geometry || !sig.geometry.coordinates || sig.geometry.coordinates.length === 0) return;
      const centroid = calculateCentroid(sig.geometry.coordinates);

      // Create Custom Marker Container
      const el = document.createElement('div');
      el.className = 'group cursor-pointer transform -translate-x-1/2 -translate-y-1/2 select-none';
      
      const isSelected = selectedSigmet?.fileName === sig.fileName;
      const isThunderstorm = sig.phenomenonCode.includes('TS') || sig.phenomenonName.toLowerCase().includes('thunderstorm');
      const rawCode = sig.phenomenonCode || (isThunderstorm ? 'EMBD_TS' : 'SEV_ICE');
      const textFallback = rawCode.includes('TS') ? 'TS' : rawCode.includes('ICE') ? 'ICE' : rawCode.slice(0, 4);
      const badgeBg = isThunderstorm ? 'bg-amber-100 border-red-500' : 'bg-sky-100 border-sky-500';

      // Symbol: WMO SVG with graceful text phenomenon fallback
      const iconSvg = `
        <div class="relative flex items-center justify-center w-[22px] h-[22px] rounded ${badgeBg} border overflow-hidden p-0.5 shadow-sm">
          <img
            src="/symbols/${rawCode}.svg"
            alt="${rawCode}"
            class="w-full h-full object-contain filter contrast-125"
            onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';"
          />
          <span style="display:none;" class="w-full h-full font-mono font-black text-[9px] text-slate-900 items-center justify-center">
            ${textFallback}
          </span>
        </div>
      `;

      // Intensity Badge
      let intensityHtml = '';
      if (sig.intensityChange === 'INTENSIFY') {
        intensityHtml = `<span class="px-1 py-0.2 rounded text-[9px] font-bold bg-rose-500 text-white shadow">▲ INTSF</span>`;
      } else if (sig.intensityChange === 'WEAKEN') {
        intensityHtml = `<span class="px-1 py-0.2 rounded text-[9px] font-bold bg-sky-500 text-white shadow">▼ WKN</span>`;
      } else if (sig.intensityChange === 'NO_CHANGE') {
        intensityHtml = `<span class="px-1 py-0.2 rounded text-[9px] font-bold bg-slate-700 text-slate-200 border border-slate-600 shadow">= NC</span>`;
      }

      // Movement Vector Arrow
      let movementHtml = '';
      if (sig.motionDirectionDeg !== null && sig.motionSpeedKt !== null && sig.motionSpeedKt > 0) {
        movementHtml = `
          <div class="flex items-center space-x-1 mt-0.5 bg-slate-900/90 border border-slate-700/80 px-1.5 py-0.5 rounded shadow text-[9px] font-mono text-slate-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="transform: rotate(${sig.motionDirectionDeg}deg);" class="text-sky-400">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>${sig.motionDirectionText || ''} ${sig.motionSpeedKt}KT</span>
          </div>
        `;
      } else {
        movementHtml = `
          <div class="mt-0.5 bg-slate-900/90 border border-slate-700 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400">
            STNR
          </div>
        `;
      }

      el.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="flex items-center space-x-1 bg-slate-950/90 backdrop-blur-md px-1.5 py-1 rounded-md border ${
            isSelected ? 'border-blue-400 ring-2 ring-blue-400/50 scale-110' : 'border-slate-700 hover:border-slate-500'
          } transition-transform shadow-lg">
            ${iconSvg}
            <span class="text-[10px] font-bold font-mono text-slate-100">${sig.sequenceNumber}</span>
            ${intensityHtml}
          </div>
          ${movementHtml}
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectSigmet(sig);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(centroid)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [activeSigmets, selectedSigmet, onSelectSigmet]);

  // Handle selectedSigmet changes (Popup display & panTo)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (!selectedSigmet) {
      return;
    }

    if (selectedSigmet.geometry && selectedSigmet.geometry.coordinates && selectedSigmet.geometry.coordinates.length > 0) {
      const centroid = calculateCentroid(selectedSigmet.geometry.coordinates);

      const popupNode = document.createElement('div');
      popupNode.id = 'sigmet-popup-container';

      const popup = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 20,
      })
        .setLngLat(centroid)
        .setDOMContent(popupNode)
        .addTo(map);

      popupRef.current = popup;

      map.easeTo({
        center: centroid,
        duration: 800,
      });
    }
  }, [selectedSigmet]);

  const formatUtc = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
  };

  return (
    <div className="relative flex-1 w-full h-full min-h-[400px] overflow-hidden">
      {/* MapLibre DOM container */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Floating Popup Card Overlay when Sigmet is selected */}
      {selectedSigmet && (
        <div className="absolute top-4 left-4 z-20 w-80 sm:w-96 rounded-xl bg-slate-950/95 border border-slate-700/80 shadow-2xl backdrop-blur-md overflow-hidden text-slate-100">
          {/* Popup Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-red-500/20 text-red-300 border border-red-500/40">
                {selectedSigmet.isCancel ? `CNL ${selectedSigmet.sequenceNumber}` : `SIGMET ${selectedSigmet.sequenceNumber}`}
              </span>
              <span className="text-xs font-semibold text-slate-300 font-mono">
                {selectedSigmet.firCode} ({selectedSigmet.firName})
              </span>
            </div>
            <button
              onClick={() => {
                if (popupRef.current) popupRef.current.remove();
                onSelectSigmet(null as any);
              }}
              className="text-slate-400 hover:text-white text-sm px-1.5 py-0.5 rounded hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          {/* Tab navigation: Alphanumeric TAC vs Decoded Breakdown */}
          <div className="flex border-b border-slate-800 bg-slate-900/50">
            <button
              onClick={() => setActiveTab('tac')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'tac'
                  ? 'border-blue-400 text-blue-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Alphanumeric TAC</span>
            </button>
            <button
              onClick={() => setActiveTab('decoded')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'decoded'
                  ? 'border-blue-400 text-blue-400 bg-slate-800/40'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Decoded Breakdown</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3.5 max-h-72 overflow-y-auto">
            {activeTab === 'tac' ? (
              <div className="space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
                  <span>Raw WMO TAC Message</span>
                  <span className="font-mono text-slate-500">From IWXXM</span>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-xs leading-relaxed text-amber-300 select-text whitespace-pre-wrap break-words">
                  {selectedSigmet.rawTac}
                </div>
                {selectedSigmet.cancelledSigmetRef && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800">
                    <div className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold mb-1">
                      Original Cancelled Message:
                    </div>
                    <div className="p-2 rounded bg-slate-900/60 border border-rose-950 font-mono text-[11px] text-slate-300 select-text">
                      {selectedSigmet.cancelledSigmetRef.rawTac}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-medium">Phenomenon</div>
                    <div className="font-semibold text-slate-100 mt-0.5">
                      {selectedSigmet.phenomenonName || (selectedSigmet.isCancel ? 'Cancellation Notice' : 'Thunderstorm')}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-medium">Vertical Extent</div>
                    <div className="font-mono font-semibold text-slate-100 mt-0.5">
                      {selectedSigmet.flightLevel || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-medium">Validity Period</div>
                    <div className="font-mono text-[11px] text-slate-200 mt-0.5">
                      {formatUtc(selectedSigmet.validStart)} → {formatUtc(selectedSigmet.validEnd)}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-medium">Movement & Speed</div>
                    <div className="font-mono font-semibold text-slate-200 mt-0.5 flex items-center">
                      <Wind className="w-3.5 h-3.5 mr-1 text-sky-400" />
                      {selectedSigmet.motionDirectionText || 'STNR'} {selectedSigmet.motionSpeedKt ? `${selectedSigmet.motionSpeedKt} KT` : ''}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-medium">Intensity Trend</div>
                    <div className="font-semibold mt-0.5">
                      {selectedSigmet.intensityChange === 'INTENSIFY' ? (
                        <span className="text-rose-400">▲ Intensifying (INTSF)</span>
                      ) : selectedSigmet.intensityChange === 'WEAKEN' ? (
                        <span className="text-sky-400">▼ Weakening (WKN)</span>
                      ) : (
                        <span className="text-slate-300">= No Change (NC)</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80">
                    <div className="text-[10px] text-slate-400 font-medium">Issue Timestamp</div>
                    <div className="font-mono text-[11px] text-slate-300 mt-0.5">
                      {formatUtc(selectedSigmet.issueTime)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Legend (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-950/90 border border-slate-800 backdrop-blur-md rounded-lg p-2.5 text-[11px] shadow-xl max-w-xs pointer-events-auto">
        <div className="font-semibold text-slate-300 mb-1.5 flex items-center space-x-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>Operational Legend</span>
        </div>
        <div className="space-y-1.5 text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-red-600/40 border border-red-500 inline-block"></span>
            <span className="text-slate-300">EMBD_TS (Embedded Thunderstorm)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-sky-600/40 border border-sky-500 inline-block"></span>
            <span className="text-slate-300">SEV_ICE (Severe Icing)</span>
          </div>
          <div className="flex items-center space-x-2 pt-1 border-t border-slate-800/80">
            <span className="text-[9px] font-bold px-1 rounded bg-rose-500 text-white">▲ INTSF</span>
            <span>Intensifying</span>
            <span className="text-[9px] font-bold px-1 rounded bg-slate-700 text-slate-300">= NC</span>
            <span>No change</span>
            <span className="text-[9px] font-bold px-1 rounded bg-sky-500 text-white">▼ WKN</span>
            <span>Weakening</span>
          </div>
        </div>
      </div>
    </div>
  );
};
