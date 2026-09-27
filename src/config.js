// Delte konstanter for verden og fysikk.
export const HALF = 8; // sandkassa innvendig: x,z ∈ [-HALF, HALF]
export const GRID = 160; // høydekart-oppløsning (celler per side)
export const CELL = (2 * HALF) / GRID;
export const WALL_H = 1.6; // kant-høyde over bunnplankene
export const WALL_T = 0.45;
export const SAND_START = 1.0;
export const GRAVITY = 14;

export const REPOSE = Math.tan((34 * Math.PI) / 180); // rasvinkel for tørr sand

export const COLORS = {
  sky: 0xbfe3ff,
  horizon: 0xfff1e0,
  grass: 0xa8e6b8,
  grassDark: 0x8fd6a4,
  sand: 0xf7d9a8,
  sandPacked: 0xe8bf88,
  frame: 0xcdb8f0,
  frameTop: 0xfff3e2,
  planks: 0xf2c9a0,
  yellow: 0xffe08a,
  yellowDeep: 0xffcf5c,
  lilac: 0x8c86b0,
  lilacDark: 0x6f6a93,
  cream: 0xfff6e8,
  glass: 0xbfe6ff,
  pink: 0xffb8c9,
  mint: 0x9ee6cf,
  blue: 0xa9d6f5,
  peach: 0xffcfae,
  lavender: 0xd9c9ff,
};
