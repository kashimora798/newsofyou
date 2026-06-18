import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

let loaded = false;
let _rock1Mesh: THREE.Mesh | null = null;
let _rock2Mesh: THREE.Mesh | null = null;
let _rock3Mesh: THREE.Mesh | null = null;

async function fetchAssets() {
  if (loaded) return;

  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  gltfLoader.setDRACOLoader(dracoLoader);

  const rock1Gltf = await gltfLoader.loadAsync('/models/rock1.glb');
  _rock1Mesh = rock1Gltf.scene.children[0] as THREE.Mesh;

  const rock2Gltf = await gltfLoader.loadAsync('/models/rock2.glb');
  _rock2Mesh = rock2Gltf.scene.children[0] as THREE.Mesh;

  const rock3Gltf = await gltfLoader.loadAsync('/models/rock3.glb');
  _rock3Mesh = rock3Gltf.scene.children[0] as THREE.Mesh;

  loaded = true;
}

export class RockOptions {
  size = { x: 2, y: 2, z: 2 };
  sizeVariation = { x: 3, y: 3, z: 3 };
}

export class Rocks extends THREE.Group {
  options: RockOptions;
  ready: Promise<void>;

  constructor(options = new RockOptions()) {
    super();
    this.options = options;

    this.ready = fetchAssets().then(() => {
      if (_rock1Mesh) this.add(this.generateInstances(_rock1Mesh));
      if (_rock2Mesh) this.add(this.generateInstances(_rock2Mesh));
      if (_rock3Mesh) this.add(this.generateInstances(_rock3Mesh));
    });
  }

  generateInstances(mesh: THREE.Mesh): THREE.InstancedMesh {
    const instancedMesh = new THREE.InstancedMesh(mesh.geometry, mesh.material, 200);
    const dummy = new THREE.Object3D();
    let count = 0;

    for (let i = 0; i < 50; i++) {
      // Set position randomly
      const p = new THREE.Vector3(
        2 * (Math.random() - 0.5) * 250,
        0.3,
        2 * (Math.random() - 0.5) * 250
      );

      dummy.position.copy(p);

      // Set rotation randomly
      dummy.rotation.set(
        0,
        2 * Math.PI * Math.random(),
        0
      );

      // Set scale randomly
      dummy.scale.set(
        this.options.sizeVariation.x * Math.random() + this.options.size.x,
        this.options.sizeVariation.y * Math.random() + this.options.size.y,
        this.options.sizeVariation.z * Math.random() + this.options.size.z
      );

      dummy.updateMatrix();
      instancedMesh.setMatrixAt(count, dummy.matrix);
      count++;
    }

    instancedMesh.count = count;
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    return instancedMesh;
  }
}
