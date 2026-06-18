import * as THREE from 'three';

const vertexShader = `
varying vec3 vPosition;

void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

varying vec3 vPosition;

uniform float uSunAzimuth; // Sun azimuth angle (in degrees)
uniform float uSunElevation; // Sun elevation angle (in degrees)
uniform vec3 uSunColor;
uniform vec3 uSkyColorLow;
uniform vec3 uSkyColorHigh;
uniform float uSunSize;

void main() {
    // Convert angles from degrees to radians
    float azimuth = radians(uSunAzimuth);
    float elevation = radians(uSunElevation);

    // Calculate the sun direction vector based on azimuth and elevation
    vec3 sunDirection = normalize(vec3(
        cos(elevation) * sin(azimuth),
        sin(elevation),
        cos(elevation) * cos(azimuth)
    ));

    // Normalize the fragment position
    vec3 direction = normalize(vPosition);

    // Gradient for the sky (simple blue gradient)
    float t = direction.y * 0.5 + 0.5;
    vec3 skyColor = mix(uSkyColorLow, uSkyColorHigh, t);

    // Compute sun appearance
    float sunIntensity = pow(max(dot(direction, sunDirection), 0.0), 1000.0 / uSunSize);
    vec3 sunColor = uSunColor * sunIntensity;

    // Combine sun and sky color
    vec3 color = skyColor + sunColor;

    gl_FragColor = vec4(color, 1.0);
}
`;

export class SkyboxOptions {
  sunAzimuth = 90;
  sunElevation = 30;
  // Convert standard hex colors to match the exact sRGB colors of eztree.dev
  sunColor = new THREE.Color(0xffe5b0).convertLinearToSRGB();
  sunSize = 1;
  skyColorLow = new THREE.Color(0x6fa2ef).convertLinearToSRGB();
  skyColorHigh = new THREE.Color(0x2053ff).convertLinearToSRGB();
}

/**
 * Configurable skybox with sun and built-in lighting
 */
export class Skybox extends THREE.Mesh {
  sun: THREE.DirectionalLight;
  private _sunElevation: number;
  private _sunAzimuth: number;

  constructor(options = new SkyboxOptions()) {
    super();

    this.name = 'Skybox';
    this._sunElevation = options.sunElevation;
    this._sunAzimuth = options.sunAzimuth;

    const sunColorLinear = options.sunColor.clone();
    const skyLowLinear = options.skyColorLow.clone();
    const skyHighLinear = options.skyColorHigh.clone();

    // Scale up to 5000 to prevent camera clipping when zooming out
    this.geometry = new THREE.SphereGeometry(5000, 32, 32);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSunAzimuth: { value: options.sunAzimuth },
        uSunElevation: { value: options.sunElevation },
        uSunColor: { value: sunColorLinear },
        uSkyColorLow: { value: skyLowLinear },
        uSkyColorHigh: { value: skyHighLinear },
        uSunSize: { value: options.sunSize }
      },
      side: THREE.BackSide
    });

    this.sun = new THREE.DirectionalLight();
    this.sun.intensity = 5;
    this.sun.color = options.sunColor;
    this.sun.position.set(50, 100, 50);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -100;
    this.sun.shadow.camera.right = 100;
    this.sun.shadow.camera.top = 100;
    this.sun.shadow.camera.bottom = -100;
    this.sun.shadow.mapSize = new THREE.Vector2(512, 512);
    this.sun.shadow.bias = -0.001;
    this.sun.shadow.normalBias = 0.2;
    this.add(this.sun);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.add(ambientLight);

    this.updateSunPosition();
  }

  updateSunPosition() {
    const el = THREE.MathUtils.degToRad(this._sunElevation);
    const az = THREE.MathUtils.degToRad(this._sunAzimuth);

    this.sun.position.set(
      100 * Math.cos(el) * Math.sin(az),
      100 * Math.sin(el),
      100 * Math.cos(el) * Math.cos(az)
    );
  }

  get sunAzimuth(): number {
    return (this.material as THREE.ShaderMaterial).uniforms.uSunAzimuth.value;
  }

  set sunAzimuth(azimuth: number) {
    (this.material as THREE.ShaderMaterial).uniforms.uSunAzimuth.value = azimuth;
    this._sunAzimuth = azimuth;
    this.updateSunPosition();
  }

  get sunElevation(): number {
    return (this.material as THREE.ShaderMaterial).uniforms.uSunElevation.value;
  }

  set sunElevation(elevation: number) {
    (this.material as THREE.ShaderMaterial).uniforms.uSunElevation.value = elevation;
    this._sunElevation = elevation;
    this.updateSunPosition();
  }

  get sunColor(): THREE.Color {
    return (this.material as THREE.ShaderMaterial).uniforms.uSunColor.value;
  }

  set sunColor(color: THREE.Color) {
    (this.material as THREE.ShaderMaterial).uniforms.uSunColor.value = color;
    this.sun.color = color;
  }

  get skyColorLow(): THREE.Color {
    return (this.material as THREE.ShaderMaterial).uniforms.uSkyColorLow.value;
  }

  set skyColorLow(color: THREE.Color) {
    (this.material as THREE.ShaderMaterial).uniforms.uSkyColorLow.value = color;
  }

  get skyColorHigh(): THREE.Color {
    return (this.material as THREE.ShaderMaterial).uniforms.uSkyColorHigh.value;
  }

  set skyColorHigh(color: THREE.Color) {
    (this.material as THREE.ShaderMaterial).uniforms.uSkyColorHigh.value = color;
  }
}
