import * as THREE from 'three';
import { TreePreset } from '@dgreenheck/ez-tree';

export const BarkType = {
  Bark001: 'Bark001',
  Bark002: 'Bark002',
  Bark003: 'Bark003',
  Bark004: 'Bark004',
  Bark006: 'Bark006',
  Bark007: 'Bark007',
  Bark008: 'Bark008',
  Bark012: 'Bark012',
  Bark013: 'Bark013',
  Bark014: 'Bark014',
  Bark015: 'Bark015',
} as const;

export type BarkTypeValue = typeof BarkType[keyof typeof BarkType];

export const LeafType = {
  Ash: 'ash',
  Aspen: 'aspen',
  Oak: 'oak',
  Pine: 'pine',
} as const;

export type LeafTypeValue = typeof LeafType[keyof typeof LeafType];

const textureLoader = new THREE.TextureLoader();
const barkCache = new Map<string, any>();
const leafCache = new Map<string, THREE.Texture>();

function loadColor(url: string) {
  const t = textureLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function loadLinear(url: string) {
  return textureLoader.load(url);
}

export function getBarkMaps(type: string) {
  let mappedType = type;
  if (!BarkType[mappedType as keyof typeof BarkType]) {
    mappedType = 'Bark002'; // Fallback to a high-quality realistic bark texture
  }
  if (barkCache.has(mappedType)) return barkCache.get(mappedType);

  const dir = `${mappedType}_1K-JPG`;
  const base = `/textures/bark/${dir}/${dir}`;
  const maps = {
    color: loadColor(`${base}_Color.jpg`),
    ao: loadLinear(`${base}_AmbientOcclusion.jpg`),
    normal: loadLinear(`${base}_NormalGL.jpg`),
    roughness: loadLinear(`${base}_Roughness.jpg`),
  };
  barkCache.set(mappedType, maps);
  return maps;
}

export function getLeafMap(type: LeafTypeValue) {
  if (leafCache.has(type)) return leafCache.get(type);
  const texture = loadColor(`/textures/leaves/${type}.png`);
  texture.premultiplyAlpha = true;
  leafCache.set(type, texture);
  return texture;
}

export function applyTreeTextures(tree: any) {
  if (!tree.options.bark.maps) {
    tree.options.bark.maps = { color: null, ao: null, normal: null, roughness: null };
  }
  const barkMaps = getBarkMaps(tree.options.bark.type);
  if (barkMaps) {
    tree.options.bark.maps.color = barkMaps.color;
    tree.options.bark.maps.ao = barkMaps.ao;
    tree.options.bark.maps.normal = barkMaps.normal;
    tree.options.bark.maps.roughness = barkMaps.roughness;
  }
  tree.options.leaves.map = getLeafMap(tree.options.leaves.type);
}

export function loadPresetWithTextures(tree: any, name: string) {
  const json = structuredClone(TreePreset[name as keyof typeof TreePreset]);
  if (!json) return;
  tree.options.copy(json);
  applyTreeTextures(tree);
}

