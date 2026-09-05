import React, { useState } from 'react';

interface WeatherIconProps {
  phenomenon: string;
  phenomenonHref?: string;
  className?: string;
  size?: number;
  showTextFallbackAlways?: boolean;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({
  phenomenon,
  className = '',
  size = 28,
  showTextFallbackAlways = false,
}) => {
  const [hasError, setHasError] = useState(false);

  // Normalize phenomenon code e.g. "http://codes.wmo.int/49-2/SigWxPhenomena/EMBD_TS" -> "EMBD_TS"
  const rawCode = phenomenon.includes('/') ? phenomenon.split('/').pop() || '' : phenomenon;
  const cleanCode = rawCode.trim().toUpperCase();

  // Determine fallback abbreviation
  const getFallbackText = (code: string) => {
    if (code.includes('TS')) return 'TS';
    if (code.includes('ICE')) return 'ICE';
    if (code.includes('TURB')) return 'TURB';
    if (code.includes('TC')) return 'TC';
    if (code.includes('VA')) return 'VA';
    if (code.includes('SQL')) return 'SQL';
    if (code.includes('GR')) return 'HAIL';
    return code.slice(0, 4) || 'WX';
  };

  // Determine hazard color theme
  const isThunderstorm = cleanCode.includes('TS');
  const isIcing = cleanCode.includes('ICE');

  const bgStyle = isThunderstorm
    ? 'bg-amber-100 border-red-500 text-red-700'
    : isIcing
    ? 'bg-sky-100 border-sky-500 text-sky-800'
    : 'bg-slate-100 border-slate-400 text-slate-800';

  // If already errored or text fallback is requested, show text phenomenon badge
  if (hasError || showTextFallbackAlways) {
    return (
      <div
        className={`inline-flex items-center justify-center font-mono font-black rounded-md border shadow-sm px-1.5 py-0.5 ${bgStyle} ${className}`}
        style={{ minWidth: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
        title={`WMO Phenomenon: ${cleanCode}`}
      >
        <span>{getFallbackText(cleanCode)}</span>
      </div>
    );
  }

  // Attempt to load official WMO/ICAO SVG from /symbols/{cleanCode}.svg
  return (
    <div
      className={`inline-flex items-center justify-center rounded-md border overflow-hidden p-0.5 shadow-sm transition-transform ${bgStyle} ${className}`}
      style={{ width: size, height: size }}
      title={`WMO/ICAO Phenomenon: ${cleanCode}`}
    >
      <img
        src={`/symbols/${cleanCode}.svg`}
        alt={cleanCode}
        className="w-full h-full object-contain filter contrast-125"
        onError={() => setHasError(true)}
      />
    </div>
  );
};
