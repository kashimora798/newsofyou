import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Tree, TreePreset } from '@dgreenheck/ez-tree';
import { Environment } from './environment';
import { loadPresetWithTextures, applyTreeTextures } from './textures';
import { PRESET_MAIN_TREE } from './treePreset';

interface Props {
  isMobile: boolean;
  totalMessages: number;
}

export default function ForestSimulation({ isMobile, totalMessages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    const clock = new THREE.Clock();

    // 1. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
    renderer.setClearColor(0x0d1b2e); // Deep night-blue
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 2.0;
    container.appendChild(renderer.domElement);

    // 2. Scene & Fog Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0d1b2e, 0.0012); // Deep night fog

    // 3. Environment Setup (Ground, grass, rocks, skybox, clouds, lighting)
    const environment = new Environment();
    scene.add(environment);

    // 4. Camera Setup - far plane at 15000 to prevent clipping
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      15000
    );

    // 5. Dynamic Camera Orbit Controls and Sizing
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = true;
    controls.minPolarAngle = Math.PI / 2 - 0.25;
    controls.maxPolarAngle = Math.PI / 2 + 0.12;

    // 6. Growth System & Main Tree Customization (Small and Dense)
    const mainTree = new Tree();
    mainTree.options.copy(PRESET_MAIN_TREE);
    
    // Scale Main Tree (Reduced scale to look natural and fit the screen completely)
    const growthScale = totalMessages < 50
      ? 0.5
      : totalMessages < 200
      ? 0.75
      : totalMessages < 500
      ? 1.0     // Standard full size
      : totalMessages < 1000
      ? 1.25
      : 1.5;    // Ancient majestic size

    mainTree.scale.set(growthScale, growthScale, growthScale);



    applyTreeTextures(mainTree);
    mainTree.generate();
    mainTree.castShadow = !isMobile;
    mainTree.receiveShadow = !isMobile;
    scene.add(mainTree);

    // 7. Adjust camera framing dynamically based on screen aspect ratio
    const aspect = container.clientWidth / container.clientHeight;
    const isPortrait = aspect < 1.0;
    
    // Camera distance proportional to the smaller tree size
    const baseDistance = 35 * growthScale;
    const zoomMultiplier = isPortrait ? 2.2 : 1.4;
    const camDistance = baseDistance * zoomMultiplier;

    camera.position.set(camDistance, 10 * growthScale + (isPortrait ? 15 : 5), 0);
    
    // Controls zoom limits fit the small tree perfectly
    controls.minDistance = 5 * growthScale; 
    controls.maxDistance = camDistance * 3.0; // Allow zooming out to see the complete tree and forest
    controls.target.set(0, 10 * growthScale, 0); // Focus camera target on the middle canopy of the small tree
    controls.update();

    // 8. Background Forest Setup (Tiled background trees)
    const forest = new THREE.Group();
    forest.name = 'Forest';
    scene.add(forest);

    const treeCount = isMobile ? 25 : 65;
    const minDistance = 180 * (growthScale * 0.4 + 0.6); // Push background trees further out when main tree is huge
    const maxDistance = 500 * (growthScale * 0.4 + 0.6);
    const presets = Object.keys(TreePreset);

    let treesLoadedCount = 0;

    function createBackgroundTree() {
      const r = minDistance + Math.random() * maxDistance;
      const theta = 2 * Math.PI * Math.random();
      const presetName = presets[Math.floor(Math.random() * presets.length)];

      const t = new Tree();
      t.position.set(r * Math.cos(theta), 0, r * Math.sin(theta));
      loadPresetWithTextures(t, presetName);
      t.options.seed = Math.floor(10000 * Math.random());
      t.generate();
      
      const s = 0.8 + Math.random() * 0.6;
      t.scale.set(s, s, s);

      t.castShadow = !isMobile;
      t.receiveShadow = !isMobile;
      forest.add(t);
    }

    const treesPerFrame = isMobile ? 3 : 5;
    function loadMoreTrees() {
      if (treesLoadedCount < treeCount) {
        const limit = Math.min(treeCount, treesLoadedCount + treesPerFrame);
        for (let i = treesLoadedCount; i < limit; i++) {
          createBackgroundTree();
        }
        treesLoadedCount = limit;
        setLoadingProgress(Math.floor((treesLoadedCount / treeCount) * 100));
        requestAnimationFrame(loadMoreTrees);
      } else {
        setIsLoading(false);
      }
    }

    environment.ready
      .catch((err) => {
        console.error("Environment loading failed, rendering fallback:", err);
      })
      .finally(() => {
        requestAnimationFrame(loadMoreTrees);
      });

    // 9. Animation Loop
    function animate() {
      animationFrameId = requestAnimationFrame(animate);

      const t = clock.getElapsedTime();
      
      // Keep skybox centered around the camera so it never clips
      if (environment.skybox) {
        environment.skybox.position.copy(camera.position);
      }

      // Wind animations
      mainTree.update(t);
      forest.children.forEach((o: any) => {
        if (typeof o.update === 'function') {
          o.update(t);
        }
      });
      environment.update(t);

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    // 10. Resize Handling
    function handleResize() {
      if (!container) return;
      
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      // Recalculate zoom framing on orientation change
      const newAspect = width / height;
      const newIsPortrait = newAspect < 1.0;
      const newZoomMultiplier = newIsPortrait ? 2.2 : 1.4;
      controls.maxDistance = baseDistance * newZoomMultiplier * 3.0;
    }
    window.addEventListener('resize', handleResize);

    // 11. Clean Up on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeChild(renderer.domElement);
      renderer.dispose();
      
      scene.traverse((object: any) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [isMobile, totalMessages]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1b2e] z-40 transition-opacity duration-300">
          <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden mb-3">
            <div 
              className="h-full bg-emerald-400 transition-all duration-200 ease-out" 
              style={{ width: `${loadingProgress}%` }} 
            />
          </div>
          <p className="text-emerald-400 font-mono text-xs tracking-widest uppercase animate-pulse">
            Growing forest... {loadingProgress}%
          </p>
        </div>
      )}
    </div>
  );
}
