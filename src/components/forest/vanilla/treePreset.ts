export const PRESET_MAIN_TREE = {
  seed: 57315,
  type: "evergreen",
  bark: {
    type: "willow",
    tint: 13552830,
    flatShading: false,
    textured: true,
    textureScale: {
      x: 0.5,
      y: 2.3
    }
  },
  branch: {
    levels: 3,
    angle: {
      "1": 61,
      "2": 61,
      "3": 0
    },
    children: {
      "0": 40,
      "1": 2,
      "2": 5
    },
    force: {
      direction: {
        x: 0,
        y: 1,
        z: 0
      },
      strength: -0.010869565217391311
    },
    gnarliness: {
      "0": -0.04,
      "1": 0.02,
      "2": 0.12,
      "3": 0.049999999999999996
    },
    length: {
      "0": 58,
      "1": 38.1,
      "2": 12.1,
      "3": 16.1
    },
    radius: {
      "0": 1.96,
      "1": 0.6,
      "2": 1.37,
      "3": 1.86
    },
    sections: {
      "0": 6,
      "1": 15,
      "2": 1,
      "3": 8
    },
    segments: {
      "0": 11,
      "1": 9,
      "2": 6,
      "3": 3
    },
    start: {
      "1": 0.32,
      "2": 0.34,
      "3": 0
    },
    taper: {
      "0": 0.2,
      "1": 0.2,
      "2": 0.3,
      "3": 1
    },
    twist: {
      "0": 0.09,
      "1": -0.07,
      "2": 0,
      "3": 0
    }
  },
  leaves: {
    type: "aspen",
    billboard: "single",
    angle: 51,
    count: 36,
    start: 0.93,
    size: 4.2,
    sizeVariance: 0.42,
    tint: 16711888,
    alphaTest: 0.65,
    roundedNormals: true
  },
  trellis: {
    enabled: true,
    position: {
      x: 1.6,
      y: 1.6,
      z: -20
    },
    width: 32.5,
    height: 8,
    spacing: 3.5,
    force: {
      strength: 0.148,
      maxDistance: 8.7,
      falloff: 1
    },
    cylinderRadius: 0.26,
    visible: true,
    color: 9127187
  }
};
