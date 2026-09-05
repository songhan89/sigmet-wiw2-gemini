import React, { useState, useMemo } from 'react';
import sigmetRawData from './data/sigmet_dataset.json';
import { SigmetRecord } from './types/sigmet';
import { BannerSection } from './components/BannerSection';
import { SigmetMap } from './components/SigmetMap';
import { TimePlayer, getTimestampForStep } from './components/TimePlayer';
import { Plane, Filter } from 'lucide-react';

export const App: React.FC = () => {
  const allSigmets = sigmetRawData as SigmetRecord[];

  // 31 days * 48 half-hours = 1488 steps
  const totalSteps = 31 * 48;

  // Default to May 1st 06:30 UTC (Step 13: 13 * 30m = 6.5 hours = 06:30 UTC)
  const [currentStep, setCurrentStep] = useState<number>(13);
  const [selectedSigmet, setSelectedSigmet] = useState<SigmetRecord | null>(null);
  const [firFilter, setFirFilter] = useState<'ALL' | 'WSJC' | 'WIIF'>('ALL');

  const currentTimestamp = getTimestampForStep(currentStep);

  // Compute Active SIGMETs and Active Cancellations for the current simulated timestamp
  const { activeSigmets, cancellationSigmets } = useMemo(() => {
    const activeList: SigmetRecord[] = [];
    const cancelList: SigmetRecord[] = [];

    allSigmets.forEach((sig) => {
      // Apply FIR filter
      if (firFilter !== 'ALL' && sig.firCode !== firFilter) {
        return;
      }

      const validStartMs = new Date(sig.validStart).getTime();
      const validEndMs = new Date(sig.validEnd).getTime();
      const issueTimeMs = new Date(sig.issueTime).getTime();

      if (sig.isCancel) {
        // A cancellation notice is visible starting from its issueTime (or validStart)
        // until the end of its validity window (which equals the original SIGMET's validity end)
        if (currentTimestamp >= issueTimeMs && currentTimestamp <= validEndMs) {
          cancelList.push(sig);
        }
      } else {
        // A normal SIGMET is active if current time is within [validStart, validEnd]
        // UNLESS it was cancelled prior to or at current timestamp
        if (currentTimestamp >= validStartMs && currentTimestamp <= validEndMs) {
          const wasCancelled = sig.cancellationInfo && currentTimestamp >= new Date(sig.cancellationInfo.cancelledAt).getTime();
          if (!wasCancelled) {
            activeList.push(sig);
          }
        }
      }
    });

    return { activeSigmets: activeList, cancellationSigmets: cancelList };
  }, [allSigmets, currentTimestamp, firFilter]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Application Header */}
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-30 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400">
            <Plane className="w-5 h-5 transform -rotate-45" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span>APAC SIGMET Operations & Timeline Monitor</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                PoC
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Singapore (WSJC) & Jakarta (WIIF) Flight Information Regions • May 2026 Simulation
            </p>
          </div>
        </div>

        {/* Quick FIR Filter & Demo Shortcuts */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1 mr-1.5" />
            {(['ALL', 'WSJC', 'WIIF'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFirFilter(f)}
                className={`px-2 py-1 rounded transition-colors ${
                  firFilter === f
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f === 'ALL' ? 'All FIRs' : f}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              // Demo shortcut: Day 01 06:30 UTC (Before B01 & B03 cancellation)
              setCurrentStep(13);
            }}
            className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-mono transition-colors"
            title="Demo Day 01 cancellation flow"
          >
            Demo 01-MAY 06:30Z
          </button>
        </div>
      </header>

      {/* Top Banner Section (displays active SIGMETs & cancellations with cancelled content) */}
      <BannerSection
        activeSigmets={activeSigmets}
        cancellationSigmets={cancellationSigmets}
        selectedSigmet={selectedSigmet}
        onSelectSigmet={setSelectedSigmet}
      />

      {/* Main Map Visualization Section */}
      <main className="flex-1 relative overflow-hidden">
        <SigmetMap
          activeSigmets={activeSigmets}
          selectedSigmet={selectedSigmet}
          onSelectSigmet={setSelectedSigmet}
        />
      </main>

      {/* Bottom 30-min Interval Time Player */}
      <footer className="shrink-0 z-30">
        <TimePlayer
          currentStep={currentStep}
          totalSteps={totalSteps}
          onStepChange={setCurrentStep}
          allSigmets={allSigmets}
        />
      </footer>
    </div>
  );
};
