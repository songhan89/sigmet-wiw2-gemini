import React, { useState } from 'react';

interface WeatherIconProps {
  phenomenon: string;
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

  const rawCode = phenomenon.includes('/') ? phenomenon.split('/').pop() || '' : phenomenon;
  const cleanCode = rawCode.trim().toUpperCase();

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

  const isThunderstorm = cleanCode.includes('TS');
  const isIcing = cleanCode.includes('ICE');

  const bgStyle = isThunderstorm
    ? 'bg-amber-100 border-red-500 text-red-800'
    : isIcing
    ? 'bg-sky-100 border-sky-500 text-sky-800'
    : 'bg-slate-100 border-slate-400 text-slate-800';

  if (showTextFallbackAlways || hasError) {
    return (
      <div
        className={`inline-flex items-center justify-center font-mono font-black rounded-md border shadow-sm px-1 py-0.5 ${bgStyle} ${className}`}
        style={{ minWidth: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
        title={`Phenomenon: ${cleanCode}`}
      >
        <span>{getFallbackText(cleanCode)}</span>
      </div>
    );
  }

  // Official WMO 17 / ICAO Thunderstorm Vector
  if (isThunderstorm) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-md border overflow-hidden p-0.5 shadow-sm ${bgStyle} ${className}`}
        style={{ width: size, height: size }}
        title="WMO 17 / ICAO Significant Weather: Thunderstorm (EMBD_TS)"
      >
        <svg
          viewBox="-27.5 -27.5 55 55"
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g style={{ stroke: '#991b1b', strokeWidth: 3.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M -14.5,-17.5 H 9.5 L -4.5,2 L 10,16.5" />
            <path d="M -10.5,-17.5 V 19.5" />
            <path d="M 9,16.5 H 10 V 15.5 Z" />
          </g>
        </svg>
      </div>
    );
  }

  // Official ICAO Severe Aircraft Icing Vector
  if (isIcing) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-md border overflow-hidden p-0.5 shadow-sm ${bgStyle} ${className}`}
        style={{ width: size, height: size }}
        title="ICAO Significant Weather: Severe Aircraft Icing (SEV_ICE)"
      >
        <svg
          viewBox="10 15 35 25"
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g style={{ stroke: '#0369a1', strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round' }}>
            <path d="M 16,22 A 12,12 0 0 0 39,22" />
            <path d="M 24,36 V 26" />
            <path d="M 28,36 V 26" />
            <path d="M 31,36 V 26" />
          </g>
        </svg>
      </div>
    );
  }

  // Generic loader with base-relative path for other downloaded SVGs
  const baseUrl = import.meta.env.BASE_URL || './';
  const symbolUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}symbols/${cleanCode}.svg`;

  return (
    <div
      className={`inline-flex items-center justify-center rounded-md border overflow-hidden p-0.5 shadow-sm ${bgStyle} ${className}`}
      style={{ width: size, height: size }}
      title={`Phenomenon: ${cleanCode}`}
    >
      <img
        src={symbolUrl}
        alt={cleanCode}
        className="w-full h-full object-contain filter contrast-125"
        onError={() => setHasError(true)}
      />
    </div>
  );
};
