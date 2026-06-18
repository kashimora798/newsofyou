/**
 * ForestCanvas.tsx
 * Overhauled to render the vanilla Three.js simulation.
 * This completely resolves WebGL context losses, shader compile bugs,
 * and renders the identical eztree.dev scenery, fog, and cloud layers.
 */

import ForestSimulation from "./vanilla/ForestSimulation";

interface Props {
  totalMessages: number;
  isMobile: boolean;
}

export default function ForestCanvas({ totalMessages, isMobile }: Props) {
  return (
    <div className="w-full h-full">
      <ForestSimulation isMobile={isMobile} totalMessages={totalMessages} />
    </div>
  );
}
