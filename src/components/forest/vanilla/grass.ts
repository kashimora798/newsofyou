import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { simplex2d } from './noise';

let loaded = false;
let _grassMesh: THREE.Mesh | null = null;
let _blueFlower: THREE.Group | THREE.Mesh | null = null;
let _whiteFlower: THREE.Group | THREE.Mesh | null = null;
let _yellowFlower: THREE.Group | THREE.Mesh | null = null;

export class GrassOptions {
  instanceCount = 5000;
  maxInstanceCount = 25000;
  flowerCount = 50;
  scale = 100;
  patchiness = 0.7;
  size = { x: 5, y: 4, z: 5 };
  sizeVariation = { x: 1, y: 2, z: 1 };
  windStrength = new THREE.Vector3(0.3, 0, 0.3);
  windFrequency = 1.0;
  windScale = 400.0;
}

export class Grass extends THREE.Object3D {
  options: GrassOptions;
  flowers: THREE.Group;
  grassMesh: THREE.InstancedMesh | null = null;
  ready: Promise<void>;

  constructor(options = new GrassOptions()) {
    super();
    this.options = options;

    this.flowers = new THREE.Group();
    this.add(this.flowers);

    this.ready = this.fetchAssets().then(() => {
      this.generateGrass();
      if (_whiteFlower) this.generateFlowers(_whiteFlower);
      if (_blueFlower) this.generateFlowers(_blueFlower);
      if (_yellowFlower) this.generateFlowers(_yellowFlower);
    });
  }

  get instanceCount(): number {
    return this.grassMesh?.count ?? this.options.instanceCount;
  }

  set instanceCount(value: number) {
    if (this.grassMesh) {
      this.grassMesh.count = value;
    }
  }

  async fetchAssets() {
    if (loaded) return;

    const gltfLoader = new GLTFLoader();

    const grassGltf = await gltfLoader.loadAsync('/models/grass.glb');
    _grassMesh = grassGltf.scene.children[0] as THREE.Mesh;

    const whiteFlowerGltf = await gltfLoader.loadAsync('/models/flower_white.glb');
    _whiteFlower = whiteFlowerGltf.scene.children[0] as THREE.Mesh;

    const blueFlowerGltf = await gltfLoader.loadAsync('/models/flower_blue.glb');
    _blueFlower = blueFlowerGltf.scene.children[0] as THREE.Mesh;

    const yellowFlowerGltf = await gltfLoader.loadAsync('/models/flower_yellow.glb');
    _yellowFlower = yellowFlowerGltf.scene.children[0] as THREE.Mesh;

    [_whiteFlower, _blueFlower, _yellowFlower].forEach((mesh) => {
      if (!mesh) return;
      mesh.traverse((o: any) => {
        if (o.isMesh && o.material) {
          if (o.material.map) {
            o.material = new THREE.MeshPhongMaterial({ map: o.material.map });
          }
          this.appendWindShader(o.material);
        }
      });
    });

    loaded = true;
  }

  update(elapsedTime: number) {
    this.traverse((o: any) => {
      if (o.isMesh && o.material?.userData.shader) {
        o.material.userData.shader.uniforms.uTime.value = elapsedTime;
      }
    });
  }

  generateGrass() {
    if (!_grassMesh) return;

    const grassMaterial = new THREE.MeshPhongMaterial({
      map: (_grassMesh.material as THREE.MeshPhongMaterial).map,
      emissive: new THREE.Color(0x308040),
      emissiveIntensity: 0.05,
      transparent: false,
      alphaTest: 0.5,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide
    });

    this.appendWindShader(grassMaterial, true);
    grassMaterial.color.multiplyScalar(0.6);

    this.grassMesh = new THREE.InstancedMesh(
      _grassMesh.geometry,
      grassMaterial,
      this.options.maxInstanceCount
    );

    this.generateGrassInstances();
    this.add(this.grassMesh);
  }

  generateGrassInstances() {
    if (!this.grassMesh) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let count = 0;

    for (let i = 0; i < this.options.maxInstanceCount; i++) {
      const r = 10 + Math.random() * 500;
      const theta = Math.random() * 2.0 * Math.PI;

      const p = new THREE.Vector3(
        r * Math.cos(theta),
        0,
        r * Math.sin(theta)
      );

      const n = 0.5 + 0.5 * simplex2d(new THREE.Vector2(
        p.x / this.options.scale,
        p.z / this.options.scale
      ));

      if (n > this.options.patchiness && Math.random() + 0.6 > this.options.patchiness) {
        continue;
      }

      dummy.position.copy(p);
      dummy.rotation.set(0, 2 * Math.PI * Math.random(), 0);
      dummy.scale.set(
        this.options.sizeVariation.x * Math.random() + this.options.size.x,
        this.options.sizeVariation.y * Math.random() + this.options.size.y,
        this.options.sizeVariation.z * Math.random() + this.options.size.z
      );

      dummy.updateMatrix();

      color.setRGB(
        0.25 + Math.random() * 0.1,
        0.3 + Math.random() * 0.3,
        0.1
      );

      this.grassMesh.setMatrixAt(count, dummy.matrix);
      this.grassMesh.setColorAt(count, color);
      count++;
    }

    this.grassMesh.count = Math.min(count, this.options.instanceCount);
    this.grassMesh.receiveShadow = true;
    this.grassMesh.castShadow = true;
    this.grassMesh.instanceMatrix.needsUpdate = true;
    if (this.grassMesh.instanceColor) this.grassMesh.instanceColor.needsUpdate = true;
  }

  generateFlowers(flowerMesh: THREE.Object3D) {
    for (let i = 0; i < this.options.flowerCount; i++) {
      const r = 10 + Math.random() * 200;
      const theta = Math.random() * 2.0 * Math.PI;

      const p = new THREE.Vector3(
        r * Math.cos(theta),
        0,
        r * Math.sin(theta)
      );

      const n = 0.5 + 0.5 * simplex2d(new THREE.Vector2(
        p.x / this.options.scale,
        p.z / this.options.scale
      ));

      if (n > this.options.patchiness && Math.random() + 0.8 > this.options.patchiness) {
        continue;
      }

      const flower = flowerMesh.clone();
      flower.position.copy(p);
      flower.rotation.set(0, 2 * Math.PI * Math.random(), 0);
      const scale = 0.02 + 0.03 * Math.random();
      flower.scale.set(scale, scale, scale);

      this.flowers.add(flower);
    }
  }

  appendWindShader(material: THREE.Material, instanced = false) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uWindStrength = { value: this.options.windStrength };
      shader.uniforms.uWindFrequency = { value: this.options.windFrequency };
      shader.uniforms.uWindScale = { value: this.options.windScale };

      shader.vertexShader = `
      uniform float uTime;
      uniform vec3 uWindStrength;
      uniform float uWindFrequency;
      uniform float uWindScale;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        `void main() {`,
        `
        vec3 mod289(vec3 x) {
          return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec2 mod289(vec2 x) {
          return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec3 permute(vec3 x) {
          return mod289(((x * 34.0) + 1.0) * x);
        }

        float simplex2d(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;

          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

          vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
          m = m * m;
          m = m * m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        void main() {`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 wPos = modelMatrix * vec4(position, 1.0);
        ` + (instanced ? `
        wPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
        ` : '') + `
        float n = simplex2d(vec2(wPos.x / uWindScale, wPos.z / uWindScale + uTime * uWindFrequency));
        transformed += uWindStrength * n * position.y;
        `
      );

      (material as any).userData.shader = shader;
    };
  }
}
