/** A small library of constellation-map layouts. Every video picks one (and a unique jitter) from its seed,
 * so each new video gets a different map while the style of the stars and lines stays the same. */
export type Constellation = {
  nodes: [number, number][];
  weights: number[];
  edges: [number, number][];
};

export const CONSTELLATION_STYLES = ["web", "mesh", "radial"] as const;
export type ConstellationStyle = "web" | "figures" | "radial" | "river" | "mesh";

const rand = (seed: number, salt: number) => {
  const v = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const weightFor = (seed: number, i: number) => Number((1.1 + Math.pow(rand(seed, 500 + i), 1.7) * 3.4).toFixed(2));

const WEB: Constellation = {
  nodes: [
    [.12, .07], [.30, .10], [.47, .06], [.63, .13], [.82, .09],
    [.18, .21], [.36, .18], [.54, .24], [.73, .20], [.90, .28],
    [.24, .33], [.43, .31], [.61, .37], [.80, .34],
    [.34, .44], [.52, .49], [.72, .46],
    [.16, .57], [.37, .56], [.58, .61], [.84, .58],
    [.26, .69], [.48, .71], [.69, .75], [.90, .71],
    [.14, .83], [.36, .82], [.56, .89], [.77, .85], [.92, .94],
    [.25, .95], [.50, .96],
  ],
  weights: [1.3, 2.5, 1.8, 3.2, 1.4, 2, 3.8, 2.4, 2.9, 1.3, 4.5, 2.2, 3.4, 1.7, 2.6, 4.2, 2.2, 1.4, 3.3, 2.4, 1.5, 3.6, 2, 3.2, 1.1, 1.7, 4, 2.5, 2.2, 1.5, 1.4, 2.8],
  edges: [
    [0, 1], [1, 2], [2, 3], [3, 4], [1, 6], [3, 6], [3, 8], [4, 8],
    [5, 6], [6, 7], [7, 8], [8, 9], [5, 10], [6, 10], [6, 11], [7, 11], [7, 12], [8, 12], [8, 13], [9, 13],
    [10, 11], [11, 12], [12, 13], [10, 14], [11, 14], [11, 15], [12, 15], [12, 16], [13, 16], [14, 15], [15, 16],
    [14, 18], [17, 18], [15, 18], [15, 19], [16, 19], [16, 20], [18, 19], [19, 20],
    [17, 21], [18, 21], [18, 22], [19, 22], [19, 23], [20, 23], [20, 24], [21, 22], [22, 23], [23, 24],
    [21, 25], [21, 26], [22, 26], [22, 27], [23, 27], [23, 28], [24, 28], [25, 26], [26, 27], [27, 28],
    [25, 30], [26, 30], [26, 31], [27, 31], [27, 29], [28, 29], [30, 31],
  ],
};

/** Separate, recognisable star figures (a dipper, a W, a hunter, a scorpion's curve) scattered over the sky. */
const figures = (seed: number): Constellation => {
  const shapes: {at: [number, number]; scale: number; pts: [number, number][]; edges: [number, number][]}[] = [
    {at: [.05, .05], scale: 1, pts: [[0, .04], [.07, .06], [.14, .09], [.2, .13], [.19, .22], [.3, .23], [.31, .13]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]},
    {at: [.62, .05], scale: 1, pts: [[0, .07], [.06, .02], [.13, .08], [.2, .03], [.27, .09]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]]},
    {at: [.06, .56], scale: 1.1, pts: [[.02, 0], [.2, .03], [.07, .17], [.11, .18], [.15, .19], [0, .36], [.22, .38]], edges: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 1]]},
    {at: [.58, .58], scale: 1.05, pts: [[0, 0], [.05, .06], [.07, .13], [.06, .2], [.1, .27], [.17, .32], [.25, .33], [.3, .28], [.31, .21]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]]},
    {at: [.36, .36], scale: .6, pts: [[0, .05], [.08, 0], [.16, .06], [.1, .13]], edges: [[0, 1], [1, 2], [2, 3], [3, 0]]},
  ];
  const nodes: [number, number][] = [];
  const edges: [number, number][] = [];
  shapes.forEach((shape, si) => {
    const base = nodes.length;
    shape.pts.forEach(([x, y], pi) => nodes.push([
      shape.at[0] + x * shape.scale + (rand(seed, si * 20 + pi) - .5) * .018,
      shape.at[1] + y * shape.scale + (rand(seed, si * 20 + pi + 9) - .5) * .018,
    ]));
    shape.edges.forEach(([a, b]) => edges.push([base + a, base + b]));
  });
  // a few loose field stars with no lines
  for (let i = 0; i < 9; i++) nodes.push([.04 + rand(seed, 300 + i) * .92, .04 + rand(seed, 330 + i) * .92]);
  return {nodes, edges, weights: nodes.map((_, i) => weightFor(seed, i))};
};

/** A hub with concentric rings joined by spokes, like an orbital chart. */
const radial = (seed: number): Constellation => {
  const nodes: [number, number][] = [[.5, .5]];
  const edges: [number, number][] = [];
  const turn = rand(seed, 1) * Math.PI;
  const rings = [{n: 6, rx: .2, ry: .2}, {n: 10, rx: .36, ry: .38}, {n: 14, rx: .5, ry: .52}];
  const idx: number[][] = [];
  rings.forEach((ring, ri) => {
    idx[ri] = [];
    for (let k = 0; k < ring.n; k++) {
      const a = turn + (k / ring.n) * Math.PI * 2 + (rand(seed, ri * 40 + k) - .5) * .18;
      const j = 1 + (rand(seed, ri * 40 + k + 17) - .5) * .12;
      idx[ri].push(nodes.length);
      nodes.push([.5 + Math.cos(a) * ring.rx * j, .5 + Math.sin(a) * ring.ry * j]);
    }
    idx[ri].forEach((n, k) => edges.push([n, idx[ri][(k + 1) % ring.n]]));
  });
  idx[0].forEach((n) => edges.push([0, n]));
  idx[1].forEach((n, k) => edges.push([idx[0][Math.round((k / idx[1].length) * idx[0].length) % idx[0].length], n]));
  idx[2].forEach((n, k) => edges.push([idx[1][Math.round((k / idx[2].length) * idx[1].length) % idx[1].length], n]));
  return {nodes, edges, weights: nodes.map((_, i) => (i === 0 ? 5 : weightFor(seed, i)))};
};

/** Three long chains of stars sweeping across the sky, cross-linked like tributaries. */
const river = (seed: number): Constellation => {
  const nodes: [number, number][] = [];
  const edges: [number, number][] = [];
  const chains: number[][] = [];
  const tilt = (rand(seed, 2) - .5) * .18;
  [.18, .5, .82].forEach((row, ci) => {
    const chain: number[] = [];
    const count = 9 + (ci % 2);
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1);
      const x = .04 + t * .92;
      const y = row + Math.sin(t * Math.PI * (1.4 + ci * .3) + rand(seed, ci * 7 + 3) * 6) * .09 + (t - .5) * tilt * 2 + (rand(seed, ci * 30 + k) - .5) * .035;
      chain.push(nodes.length);
      nodes.push([x, Math.max(.04, Math.min(.96, y))]);
    }
    chain.slice(1).forEach((n, k) => edges.push([chain[k], n]));
    chains.push(chain);
  });
  for (let c = 0; c < chains.length - 1; c++) {
    chains[c].forEach((n, k) => {
      if (k % 2 === (c % 2) && chains[c + 1][k]) edges.push([n, chains[c + 1][Math.min(chains[c + 1].length - 1, k)]]);
    });
  }
  return {nodes, edges, weights: nodes.map((_, i) => weightFor(seed, i))};
};

/** A loose triangulated net: a jittered grid with every cell cut by one diagonal. */
const mesh = (seed: number): Constellation => {
  const cols = 7;
  const rows = 6;
  const nodes: [number, number][] = [];
  const edges: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      nodes.push([
        .06 + (c / (cols - 1)) * .88 + (rand(seed, r * 20 + c) - .5) * .07,
        .06 + (r / (rows - 1)) * .88 + (rand(seed, r * 20 + c + 11) - .5) * .07,
      ]);
    }
  }
  const at = (r: number, c: number) => r * cols + c;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) edges.push([at(r, c), at(r, c + 1)]);
      if (r + 1 < rows) edges.push([at(r, c), at(r + 1, c)]);
      if (r + 1 < rows && c + 1 < cols) edges.push(rand(seed, r * 20 + c + 33) > .5 ? [at(r, c), at(r + 1, c + 1)] : [at(r, c + 1), at(r + 1, c)]);
    }
  }
  return {nodes, edges, weights: nodes.map((_, i) => weightFor(seed, i))};
};

export const pickConstellationStyle = (seed: number): ConstellationStyle =>
  CONSTELLATION_STYLES[Math.abs(Math.floor(seed)) % CONSTELLATION_STYLES.length] as ConstellationStyle;

export const getConstellation = (style: ConstellationStyle, seed: number): Constellation => {
  switch (style) {
    case "figures": return figures(seed);
    case "radial": return radial(seed);
    case "river": return river(seed);
    case "mesh": return mesh(seed);
    default: return WEB;
  }
};
