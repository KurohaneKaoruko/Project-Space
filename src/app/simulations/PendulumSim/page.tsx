'use client';

import Navigation from '../../components/Navigation';
import ControlsPanel from './ui/ControlsPanel';
import SimulationCanvas from './ui/SimulationCanvas';
import { useEffect, useState } from 'react';
import { usePendulumSimController } from './function/usePendulumSimController';
import VisualizationPanel from './ui/VisualizationPanel';

export default function PendulumSimPage() {
  const [isMobile, setIsMobile] = useState(true);
  const [ui, actions] = usePendulumSimController();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <main className="min-h-screen">
      <Navigation title="CHAOS_PENDULUM" />
      
      <div className="flex min-h-screen flex-col justify-center pb-6 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          {/* Header - Hidden but preserved structure if needed, currently removed for minimal look */}
          
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="lg:flex-1 bg-white tech-border border border-zinc-200 p-6 relative">
               {/* Decorative Corners */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-blue-600"></div>
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-blue-600"></div>
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-blue-600"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-blue-600"></div>

              <SimulationCanvas
                simRef={actions.simRef}
                params={ui.params}
                paused={ui.paused}
                showTrail={ui.showTrail}
                trailLength={ui.trailLength}
                showEnergy={ui.showEnergy}
                showPhasePlot={ui.showPhasePlot}
                phaseTrailLength={ui.phaseTrailLength}
                resetToken={ui.resetToken}
              />
            </div>

            <div className="lg:w-80 xl:w-96 flex flex-col gap-6">
              <div className="bg-white tech-border border border-zinc-200 overflow-hidden">
                <ControlsPanel ui={ui} actions={actions} />
              </div>
              <div className="bg-white tech-border border border-zinc-200 overflow-hidden">
                <VisualizationPanel ui={ui} actions={actions} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
