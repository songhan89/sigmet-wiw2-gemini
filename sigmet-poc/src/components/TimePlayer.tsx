import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, FastForward, Calendar, Sparkles, Rewind } from 'lucide-react';
import { SigmetRecord } from '../types/sigmet';

interface TimePlayerProps {
  currentStep: number;
  totalSteps: number;
  onStepChange: (step: number) => void;
  allSigmets: SigmetRecord[];
}

export const START_TIME_MS = new Date('2026-05-01T00:00:00Z').getTime();
export const STEP_MS = 30 * 60 * 1000; // 30 minutes in ms

export const getTimestampForStep = (step: number): number => {
  return START_TIME_MS + step * STEP_MS;
};

export const TimePlayer: React.FC<TimePlayerProps> = ({
  currentStep,
  totalSteps,
  onStepChange,
  allSigmets,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 5x, 10x

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  // Timer playback
  useEffect(() => {
    if (!isPlaying) return;

    const intervalDelay = Math.max(100, 1000 / playbackSpeed);
    const interval = setInterval(() => {
      const nextStep = currentStepRef.current + 1;
      if (nextStep >= totalSteps) {
        setIsPlaying(false);
      } else {
        onStepChange(nextStep);
      }
    }, intervalDelay);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, totalSteps, onStepChange]);

  const currentTimestamp = getTimestampForStep(currentStep);
  const currentDate = new Date(currentTimestamp);

  const formatDisplayTime = (d: Date) => {
    const year = d.getUTCFullYear();
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[d.getUTCMonth()];
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const mins = String(d.getUTCMinutes()).padStart(2, '0');
    return {
      date: `${day} ${month} ${year}`,
      time: `${hours}:${mins} UTC`,
      dayNum: d.getUTCDate(),
    };
  };

  const { date, time, dayNum } = formatDisplayTime(currentDate);

  // Jump to Next Event (active or cancellation)
  const jumpToNextEvent = () => {
    for (let step = currentStep + 1; step < totalSteps; step++) {
      const t = getTimestampForStep(step);
      const hasEvent = allSigmets.some((s) => {
        const start = new Date(s.validStart).getTime();
        const end = new Date(s.validEnd).getTime();
        return t >= start && t <= end;
      });
      if (hasEvent) {
        onStepChange(step);
        return;
      }
    }
  };

  // Jump to Previous Event
  const jumpToPrevEvent = () => {
    for (let step = currentStep - 1; step >= 0; step--) {
      const t = getTimestampForStep(step);
      const hasEvent = allSigmets.some((s) => {
        const start = new Date(s.validStart).getTime();
        const end = new Date(s.validEnd).getTime();
        return t >= start && t <= end;
      });
      if (hasEvent) {
        onStepChange(step);
        return;
      }
    }
  };

  return (
    <div className="bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-4 py-3 shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Playback Controls & Simulated UTC Clock */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => onStepChange(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Step -30m"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-600/30 transition-colors"
              title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <button
              onClick={() => onStepChange(Math.min(totalSteps - 1, currentStep + 1))}
              disabled={currentStep >= totalSteps - 1}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Step +30m"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs font-mono">
            <FastForward className="w-3 h-3 text-slate-500 mr-1" />
            {[1, 2, 5, 10].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-1.5 py-0.5 rounded ${
                  playbackSpeed === speed
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Current UTC Simulation Timestamp Display */}
          <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-800/90 font-mono">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-200">{date}</span>
            <span className="text-xs font-black text-amber-400 pl-1 border-l border-slate-800">{time}</span>
          </div>

          {/* Jump Prev / Next Hazard Buttons */}
          <div className="hidden xl:flex items-center space-x-1">
            <button
              onClick={jumpToPrevEvent}
              className="flex items-center space-x-1 text-xs px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Jump to previous active SIGMET or cancellation"
            >
              <Rewind className="w-3 h-3 text-slate-400" />
              <span>Prev Hazard</span>
            </button>
            <button
              onClick={jumpToNextEvent}
              className="flex items-center space-x-1 text-xs px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Jump to next active SIGMET or cancellation"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Next Hazard</span>
            </button>
          </div>
        </div>

        {/* Timeline Slider with 30-min precision */}
        <div className="flex-1 w-full flex items-center space-x-3">
          <span className="text-[11px] font-mono text-slate-400">01 MAY</span>
          <div className="relative flex-1 flex items-center">
            <input
              type="range"
              min={0}
              max={totalSteps - 1}
              value={currentStep}
              onChange={(e) => onStepChange(Number(e.target.value))}
              className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <span className="text-[11px] font-mono text-slate-400">31 MAY</span>
        </div>

        {/* Quick Day Jumper Pills */}
        <div className="hidden lg:flex items-center space-x-1 text-[10px] font-mono text-slate-400">
          <span className="text-slate-500 mr-1">Day:</span>
          {[1, 6, 10, 15, 20, 27, 28, 30, 31].map((d) => {
            const isCurrent = dayNum === d;
            return (
              <button
                key={d}
                onClick={() => {
                  const dayStep = (d - 1) * 48;
                  onStepChange(dayStep);
                }}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  isCurrent
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {d < 10 ? `0${d}` : d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
