import React, { useState } from 'react';
import { SigmetRecord } from '../types/sigmet';
import { WeatherIcon } from './WeatherIcon';
import { AlertTriangle, XCircle, Clock, Navigation, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface BannerSectionProps {
  activeSigmets: SigmetRecord[];
  cancellationSigmets: SigmetRecord[];
  selectedSigmet: SigmetRecord | null;
  onSelectSigmet: (sigmet: SigmetRecord) => void;
}

export const BannerSection: React.FC<BannerSectionProps> = ({
  activeSigmets,
  cancellationSigmets,
  selectedSigmet,
  onSelectSigmet,
}) => {
  const [expandedTacIds, setExpandedTacIds] = useState<Record<string, boolean>>({});

  const toggleTac = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTacIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatUtcTime = (isoString: string) => {
    const d = new Date(isoString);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const mins = String(d.getUTCMinutes()).padStart(2, '0');
    return `${day}/${hours}:${mins}Z`;
  };

  const totalBanners = activeSigmets.length + cancellationSigmets.length;

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-4 py-3 shadow-xl transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="relative flex h-3 w-3">
            {totalBanners > 0 ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            )}
          </div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active Warning Banners ({totalBanners})
          </h2>
          {cancellationSigmets.length > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {cancellationSigmets.length} Cancellation{cancellationSigmets.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500">
          Auto-updated with simulation timeline
        </span>
      </div>

      {totalBanners === 0 ? (
        <div className="flex items-center justify-center p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400 text-xs space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>No SIGMET warnings currently active in Singapore (WSJC) or Jakarta (WIIF) FIRs.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-1">
          {/* 1. Cancellations First (Highest Priority Awareness) */}
          {cancellationSigmets.map((cnl) => {
            const isSelected = selectedSigmet?.fileName === cnl.fileName;
            const isExpanded = !!expandedTacIds[cnl.fileName];
            const target = cnl.cancelledSigmetRef;

            return (
              <div
                key={`cnl-${cnl.fileName}`}
                onClick={() => onSelectSigmet(cnl)}
                className={`relative rounded-lg p-3 cursor-pointer transition-all duration-200 border ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-400 shadow-lg shadow-amber-950/50 ring-1 ring-amber-400'
                    : 'bg-slate-950/80 border-amber-600/40 hover:border-amber-500 hover:bg-slate-900'
                }`}
              >
                {/* Header tag */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      <XCircle className="w-3 h-3 mr-1" />
                      CNL {cnl.sequenceNumber}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300 font-mono">
                      {cnl.firCode} ({cnl.firName})
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400/90 font-mono">
                    Cancelled until {formatUtcTime(cnl.validEnd)}
                  </span>
                </div>

                {/* Cancelled Content Notice */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 mb-2">
                  <div className="flex items-center justify-between text-[11px] font-medium text-amber-200 mb-1">
                    <span>
                      Cancels: <strong className="text-amber-100 font-mono">SIGMET {cnl.cancelledSeq || target?.sequenceNumber || 'N/A'}</strong>
                    </span>
                    {target && (
                      <span className="text-[10px] text-amber-300/80">
                        Original valid: {formatUtcTime(target.validStart)} - {formatUtcTime(target.validEnd)}
                      </span>
                    )}
                  </div>
                  {target ? (
                    <div className="text-[11px] text-slate-300 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-semibold">{target.phenomenonName}</span>
                        {target.flightLevel && (
                          <span className="text-slate-400 text-[10px] font-mono">[{target.flightLevel}]</span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                        {target.rawTac}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] font-mono text-slate-400 truncate">
                      {cnl.rawTac}
                    </p>
                  )}
                </div>

                {/* Footer details & toggle */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                  <span className="font-mono">Issued: {formatUtcTime(cnl.issueTime)}</span>
                  <button
                    onClick={(e) => toggleTac(cnl.fileName, e)}
                    className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <span>{isExpanded ? 'Hide TAC' : 'View TAC'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-2 p-2 rounded bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-amber-200 whitespace-pre-wrap select-text">
                    <div className="text-slate-400 text-[9px] uppercase tracking-wider mb-1">Cancellation Message:</div>
                    {cnl.rawTac}
                    {target && (
                      <>
                        <div className="text-slate-400 text-[9px] uppercase tracking-wider mt-2 mb-1">Original Cancelled SIGMET:</div>
                        <div className="text-slate-300">{target.rawTac}</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 2. Active Normal SIGMETs */}
          {activeSigmets.map((sig) => {
            const isSelected = selectedSigmet?.fileName === sig.fileName;
            const isExpanded = !!expandedTacIds[sig.fileName];

            return (
              <div
                key={`active-${sig.fileName}`}
                onClick={() => onSelectSigmet(sig)}
                className={`relative rounded-lg p-3 cursor-pointer transition-all duration-200 border ${
                  isSelected
                    ? 'bg-slate-800/90 border-blue-400 shadow-lg shadow-blue-950/50 ring-1 ring-blue-400'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                      <AlertTriangle className="w-3 h-3 mr-1 text-red-400" />
                      SIGMET {sig.sequenceNumber}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-200 font-mono">
                      {sig.firCode}
                    </span>
                  </div>

                  {/* Intensity Pill */}
                  {sig.intensityChange && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                        sig.intensityChange === 'INTENSIFY'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : sig.intensityChange === 'WEAKEN'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : 'bg-slate-700 text-slate-300 border border-slate-600'
                      }`}
                    >
                      {sig.intensityChange === 'INTENSIFY' ? '▲ INTSF' : sig.intensityChange === 'WEAKEN' ? '▼ WKN' : '= NC'}
                    </span>
                  )}
                </div>

                {/* Phenomenon & Flight Level */}
                <div className="flex items-start gap-2.5 my-1.5">
                  <WeatherIcon phenomenon={sig.phenomenonCode} size={28} className="shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {sig.phenomenonName}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
                      {sig.flightLevel && <span>{sig.flightLevel}</span>}
                      {sig.motionDirectionText && (
                        <span className="flex items-center">
                          <Navigation className="w-3 h-3 mr-1 text-sky-400" />
                          {sig.motionDirectionText} {sig.motionSpeedKt !== null ? `${sig.motionSpeedKt}KT` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Validity time */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span className="flex items-center font-mono">
                    <Clock className="w-3 h-3 mr-1 text-slate-500" />
                    {formatUtcTime(sig.validStart)} → {formatUtcTime(sig.validEnd)}
                  </span>
                  <button
                    onClick={(e) => toggleTac(sig.fileName, e)}
                    className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <span>{isExpanded ? 'Hide TAC' : 'View TAC'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-2 p-2 rounded bg-slate-900/95 border border-slate-700 text-[10px] font-mono text-slate-300 whitespace-pre-wrap select-text">
                    <div className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Raw Alphanumeric TAC:</div>
                    {sig.rawTac}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
