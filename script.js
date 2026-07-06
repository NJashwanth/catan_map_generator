const MAP_CONFIGS = {
  standard: {
    rowLayout: [3, 4, 5, 4, 3],
    resourceCounts: {
      wood: 4,
      brick: 3,
      sheep: 4,
      wheat: 4,
      ore: 3,
      desert: 1,
    },
    numberTokens: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    ports: ["three", "wood", "three", "brick", "three", "sheep", "three", "wheat", "ore"],
  },
  extended: {
    rowLayout: [3, 4, 5, 6, 5, 4, 3],
    resourceCounts: {
      wood: 6,
      brick: 5,
      sheep: 6,
      wheat: 6,
      ore: 5,
      desert: 2,
    },
    numberTokens: [
      2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6,
      8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12,
    ],
    ports: ["three", "wood", "three", "brick", "sheep", "three", "sheep", "wheat", "three", "ore", "three"],
  },
};

const RESOURCE_LABELS = {
  wood: "Wood",
  brick: "Brick",
  sheep: "Sheep",
  wheat: "Wheat",
  ore: "Ore",
  desert: "Desert",
};

const RESOURCE_ICONS = {
  wood: "\u{1F332}",
  brick: "\u{1F9F1}",
  sheep: "\u{1F411}",
  wheat: "\u{1F33E}",
  ore: "⛏",
};

const PORT_LABELS = {
  three: "3:1 Any",
  wood: "2:1 Wood",
  brick: "2:1 Brick",
  sheep: "2:1 Sheep",
  wheat: "2:1 Wheat",
  ore: "2:1 Ore",
};

const HIGH_PROBABILITY_NUMBERS = new Set([6, 8]);
const NEIGHBOR_DIRS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

const boardEl = document.getElementById("board");
const metaEl = document.getElementById("boardMeta");

const seedInput = document.getElementById("seedInput");
const fairnessToggle = document.getElementById("fairnessToggle");
const resourceBalanceToggle = document.getElementById("resourceBalanceToggle");
const portsToggle = document.getElementById("portsToggle");
const randomPortsToggle = document.getElementById("randomPortsToggle");

const playerCountInput = document.getElementById("playerCount");
const victoryPointsInput = document.getElementById("victoryPoints");
const robberModeInput = document.getElementById("robberMode");

const generateBtn = document.getElementById("generateBtn");
const shuffleBtn = document.getElementById("shuffleBtn");

let currentSeed = null;

function stringToSeed(value) {
  if (!value) {
    return Math.floor(Math.random() * 4294967295);
  }

  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, random) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeResourceDeck(resourceCounts) {
  const deck = [];
  Object.entries(resourceCounts).forEach(([resource, count]) => {
    for (let i = 0; i < count; i += 1) {
      deck.push(resource);
    }
  });
  return deck;
}

function resolveConfig(playerCount) {
  return playerCount >= 5 ? MAP_CONFIGS.extended : MAP_CONFIGS.standard;
}

function makeCoords(rowLayout) {
  const coords = [];
  const centerRow = Math.floor(rowLayout.length / 2);

  for (let rowIndex = 0; rowIndex < rowLayout.length; rowIndex += 1) {
    const len = rowLayout[rowIndex];
    const r = rowIndex - centerRow;
    // Rendered x is q + r/2 hexes, so compensate for the per-row half-hex
    // shift to keep every row visually centered on the same axis.
    const qStart = Math.round(-(len - 1) / 2 - r / 2);

    for (let i = 0; i < len; i += 1) {
      coords.push({ q: qStart + i, r });
    }
  }

  return coords;
}

function sortCoordsForDisplay(coords) {
  return [...coords].sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.q - b.q;
  });
}

function keyOf(q, r) {
  return `${q},${r}`;
}

function buildCells(config, random) {
  const coords = sortCoordsForDisplay(makeCoords(config.rowLayout));
  const resources = shuffleInPlace(makeResourceDeck(config.resourceCounts), random);
  const numbers = shuffleInPlace([...config.numberTokens], random);

  const cells = [];
  let numberIndex = 0;

  const tileCount = Math.min(coords.length, resources.length);

  for (let i = 0; i < tileCount; i += 1) {
    const resource = resources[i];

    if (resource === "desert") {
      cells.push({ ...coords[i], resource, number: null });
      continue;
    }

    cells.push({ ...coords[i], resource, number: numbers[numberIndex] });
    numberIndex += 1;
  }

  return cells;
}

function indexCells(cells) {
  const map = new Map();
  cells.forEach((cell) => {
    map.set(keyOf(cell.q, cell.r), cell);
  });
  return map;
}

function neighborsOf(cell, byCoord) {
  const neighbors = [];
  for (let i = 0; i < NEIGHBOR_DIRS.length; i += 1) {
    const [dq, dr] = NEIGHBOR_DIRS[i];
    const neighbor = byCoord.get(keyOf(cell.q + dq, cell.r + dr));
    if (neighbor) {
      neighbors.push(neighbor);
    }
  }
  return neighbors;
}

function validateNumberFairness(cells) {
  const byCoord = indexCells(cells);

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    if (!HIGH_PROBABILITY_NUMBERS.has(cell.number)) {
      continue;
    }

    const hasHotNeighbor = neighborsOf(cell, byCoord).some((n) => HIGH_PROBABILITY_NUMBERS.has(n.number));
    if (hasHotNeighbor) {
      return false;
    }
  }

  return true;
}

function validateResourceSpread(cells) {
  const byCoord = indexCells(cells);

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    if (cell.resource === "desert") {
      continue;
    }

    const sameResourceNeighbors = neighborsOf(cell, byCoord).reduce((count, n) => {
      if (n.resource === cell.resource) {
        return count + 1;
      }
      return count;
    }, 0);

    if (sameResourceNeighbors > 1) {
      return false;
    }
  }

  return true;
}

function buildPorts(config, random, randomize) {
  const ports = [...config.ports];
  if (randomize) {
    shuffleInPlace(ports, random);
  }
  return ports;
}

function generateMap(options) {
  const { seedText, playerCount, enforceFairness, enforceResourceSpread, randomizePorts } = options;

  const config = resolveConfig(playerCount);
  const baseSeed = stringToSeed(seedText);

  for (let attempt = 0; attempt < 4000; attempt += 1) {
    const attemptSeed = (baseSeed + attempt * 97) >>> 0;
    const random = seededRandom(attemptSeed);
    const cells = buildCells(config, random);

    const fairNumbers = !enforceFairness || validateNumberFairness(cells);
    const fairResources = !enforceResourceSpread || validateResourceSpread(cells);

    if (fairNumbers && fairResources) {
      return {
        cells,
        ports: buildPorts(config, random, randomizePorts),
        attemptSeed,
        attempt,
        config,
      };
    }
  }

  const fallbackRandom = seededRandom(baseSeed);
  return {
    cells: buildCells(config, fallbackRandom),
    ports: buildPorts(config, fallbackRandom, randomizePorts),
    attemptSeed: baseSeed,
    attempt: -1,
    config,
  };
}

/* ------------------------------------------------------------------ */
/* SVG board rendering                                                 */
/* ------------------------------------------------------------------ */

const HEX_SIZE = 46; // center-to-corner radius in SVG units

function axialToPixel(q, r) {
  return {
    x: Math.sqrt(3) * HEX_SIZE * (q + r / 2),
    y: 1.5 * HEX_SIZE * r,
  };
}

function hexPoints(cx, cy, radius) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function seaRing(cells) {
  const land = indexCells(cells);
  const sea = new Map();

  cells.forEach((cell) => {
    NEIGHBOR_DIRS.forEach(([dq, dr]) => {
      const q = cell.q + dq;
      const r = cell.r + dr;
      const key = keyOf(q, r);
      if (!land.has(key) && !sea.has(key)) {
        sea.set(key, { q, r });
      }
    });
  });

  return [...sea.values()];
}

const SVG_DEFS = `
  <defs>
    <radialGradient id="g-wood" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#5d9047" /><stop offset="100%" stop-color="#3f6d34" />
    </radialGradient>
    <radialGradient id="g-sheep" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#b7d977" /><stop offset="100%" stop-color="#93bd52" />
    </radialGradient>
    <radialGradient id="g-wheat" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#f0c752" /><stop offset="100%" stop-color="#d9a52f" />
    </radialGradient>
    <radialGradient id="g-brick" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#c17a3d" /><stop offset="100%" stop-color="#9c5a26" />
    </radialGradient>
    <radialGradient id="g-ore" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#9a9dab" /><stop offset="100%" stop-color="#6d7080" />
    </radialGradient>
    <radialGradient id="g-desert" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#ecdcae" /><stop offset="100%" stop-color="#d6bf85" />
    </radialGradient>
    <radialGradient id="g-sea" cx="50%" cy="42%" r="80%">
      <stop offset="0%" stop-color="#7fb7e2" /><stop offset="100%" stop-color="#5b96c8" />
    </radialGradient>

    <symbol id="s-tree" viewBox="0 0 24 24">
      <rect x="10.6" y="16" width="2.8" height="6" rx="1" fill="#5f3d1e" />
      <polygon points="12,1.5 19.5,11.5 4.5,11.5" fill="#28511f" />
      <polygon points="12,6.5 21,17.5 3,17.5" fill="#2f6126" />
    </symbol>
    <symbol id="s-sheep" viewBox="0 0 24 24">
      <rect x="7" y="15" width="2.2" height="5.5" rx="1" fill="#4c463c" />
      <rect x="14.5" y="15" width="2.2" height="5.5" rx="1" fill="#4c463c" />
      <ellipse cx="11.6" cy="12.4" rx="8" ry="5.6" fill="#f7f3e7" stroke="#d9d0ba" stroke-width="0.8" />
      <circle cx="19" cy="10.4" r="2.8" fill="#4c463c" />
    </symbol>
    <symbol id="s-wheat" viewBox="0 0 24 24">
      <g stroke="#8a6a17" stroke-width="1.7" fill="none" stroke-linecap="round">
        <path d="M12 22 V7" /><path d="M12 13 C9 12 7.6 9.4 7.4 6.6" /><path d="M12 13 C15 12 16.4 9.4 16.6 6.6" />
      </g>
      <ellipse cx="12" cy="5" rx="2.3" ry="3.4" fill="#8a6a17" />
      <ellipse cx="7" cy="4.6" rx="1.9" ry="2.8" fill="#9d7c1f" transform="rotate(-24 7 4.6)" />
      <ellipse cx="17" cy="4.6" rx="1.9" ry="2.8" fill="#9d7c1f" transform="rotate(24 17 4.6)" />
    </symbol>
    <symbol id="s-clay" viewBox="0 0 24 24">
      <rect x="3.5" y="13.5" width="17" height="6.5" rx="2.4" fill="#7e4218" />
      <rect x="6.5" y="7" width="11" height="6.5" rx="2.4" fill="#93531f" />
      <rect x="9" y="1.5" width="6" height="5.5" rx="2" fill="#a5622a" />
    </symbol>
    <symbol id="s-mtn" viewBox="0 0 24 24">
      <polygon points="12,2.5 22,21.5 2,21.5" fill="#565a68" />
      <polygon points="12,2.5 16,10 8,10" fill="#eef1f6" />
      <polygon points="16,9 21,21.5 11,21.5" fill="#474b58" opacity="0.65" />
    </symbol>
    <symbol id="s-dune" viewBox="0 0 24 24">
      <path d="M2 17 Q7.5 10.5 13 17 T24 17" stroke="#b89b5e" stroke-width="2.2" fill="none" stroke-linecap="round" />
    </symbol>
    <symbol id="s-wave" viewBox="0 0 24 24">
      <path d="M2 13 Q6 8.5 10 13 T18 13" stroke="rgba(255,255,255,0.65)" stroke-width="2.1" fill="none" stroke-linecap="round" />
    </symbol>
  </defs>
`;

const TERRAIN_ART = {
  wood: { fill: "url(#g-wood)", symbol: "s-tree", spots: [[-21, -13, 19], [15, -18, 17], [-1, 15, 20]] },
  sheep: { fill: "url(#g-sheep)", symbol: "s-sheep", spots: [[-20, -14, 18], [14, -18, 16], [-2, 15, 18]] },
  wheat: { fill: "url(#g-wheat)", symbol: "s-wheat", spots: [[-21, -14, 18], [15, -17, 17], [-1, 14, 19]] },
  brick: { fill: "url(#g-brick)", symbol: "s-clay", spots: [[-20, -14, 18], [14, -18, 16], [-2, 14, 19]] },
  ore: { fill: "url(#g-ore)", symbol: "s-mtn", spots: [[-21, -13, 19], [15, -17, 17], [-1, 15, 20]] },
  desert: { fill: "url(#g-desert)", symbol: "s-dune", spots: [[-14, -12, 20], [8, -2, 22], [-8, 10, 20]] },
};

function terrainDecorSvg(art, cx, cy) {
  return art.spots
    .map(([dx, dy, size]) => {
      const x = (cx + dx - size / 2).toFixed(2);
      const y = (cy + dy - size / 2).toFixed(2);
      return `<use href="#${art.symbol}" x="${x}" y="${y}" width="${size}" height="${size}" />`;
    })
    .join("");
}

function numberTokenSvg(number, cx, cy) {
  const hot = HIGH_PROBABILITY_NUMBERS.has(number);
  const color = hot ? "#b3262f" : "#2b2317";
  const pipCount = 6 - Math.abs(7 - number);

  let pips = "";
  const pipSpan = (pipCount - 1) * 3.4;
  for (let i = 0; i < pipCount; i += 1) {
    const px = (cx - pipSpan / 2 + i * 3.4).toFixed(2);
    pips += `<circle cx="${px}" cy="${(cy + 8.6).toFixed(2)}" r="1.15" fill="${color}" />`;
  }

  return `
    <circle cx="${cx}" cy="${cy}" r="15.5" fill="#f8efd7" stroke="#a98f55" stroke-width="1.1" />
    <text x="${cx}" y="${(cy + 3.4).toFixed(2)}" text-anchor="middle" font-family="Cinzel, Georgia, serif"
      font-size="14.5" font-weight="700" fill="${color}">${number}</text>
    ${pips}
  `;
}

function landTileSvg(cell) {
  const { x, y } = axialToPixel(cell.q, cell.r);
  const art = TERRAIN_ART[cell.resource];
  const label = RESOURCE_LABELS[cell.resource] || cell.resource;

  let svg = `<g>`;
  svg += `<title>${label}${cell.number ? ` — ${cell.number}` : ""}</title>`;
  svg += `<polygon points="${hexPoints(x, y, HEX_SIZE - 1)}" fill="#ead9ab" stroke="#bfa163" stroke-width="1.4" />`;
  svg += `<polygon points="${hexPoints(x, y, HEX_SIZE - 4.5)}" fill="${art.fill}" />`;
  svg += terrainDecorSvg(art, x, y);
  if (cell.number != null) {
    svg += numberTokenSvg(cell.number, x, y);
  }
  svg += `</g>`;
  return svg;
}

function seaTileSvg(tile) {
  const { x, y } = axialToPixel(tile.q, tile.r);
  let svg = `<g>`;
  svg += `<polygon points="${hexPoints(x, y, HEX_SIZE - 1.5)}" fill="url(#g-sea)" />`;
  svg += `<use href="#s-wave" x="${(x - 20).toFixed(2)}" y="${(y - 16).toFixed(2)}" width="20" height="20" />`;
  svg += `<use href="#s-wave" x="${(x + 1).toFixed(2)}" y="${(y + 2).toFixed(2)}" width="20" height="20" />`;
  svg += `</g>`;
  return svg;
}

function choosePortTiles(seaTiles, landByCoord, count) {
  const withAngle = seaTiles
    .map((tile) => {
      const { x, y } = axialToPixel(tile.q, tile.r);
      return { ...tile, x, y, angle: Math.atan2(y, x) };
    })
    .sort((a, b) => a.angle - b.angle);

  const chosen = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor((i * withAngle.length) / count + withAngle.length / (2 * count)) % withAngle.length;
    const tile = withAngle[index];

    // Pier points at the nearest land neighbor's shared edge.
    let target = null;
    for (const [dq, dr] of NEIGHBOR_DIRS) {
      const land = landByCoord.get(keyOf(tile.q + dq, tile.r + dr));
      if (land) {
        target = axialToPixel(land.q, land.r);
        break;
      }
    }
    chosen.push({ ...tile, target });
  }
  return chosen;
}

function portSvg(portType, tile) {
  const { x, y, target } = tile;

  let pier = "";
  if (target) {
    const ex = (x + target.x) / 2;
    const ey = (y + target.y) / 2;
    pier = `
      <line x1="${x}" y1="${y}" x2="${ex.toFixed(2)}" y2="${ey.toFixed(2)}"
        stroke="#7a5230" stroke-width="4.5" stroke-linecap="round" />
    `;
  }

  const ratio = portType === "three" ? "3:1" : "2:1";
  const icon = portType === "three" ? "?" : RESOURCE_ICONS[portType] || "?";

  return `
    <g>
      <title>${PORT_LABELS[portType] || portType}</title>
      ${pier}
      <rect x="${(x - 19).toFixed(2)}" y="${(y - 15).toFixed(2)}" width="38" height="30" rx="8"
        fill="#fdf6e2" stroke="#b49a63" stroke-width="1.1" />
      <text x="${x}" y="${(y - 1.5).toFixed(2)}" text-anchor="middle" font-size="11.5"
        font-family="Nunito, sans-serif" font-weight="800" fill="#4a3a20">${icon}</text>
      <text x="${x}" y="${(y + 10.5).toFixed(2)}" text-anchor="middle" font-size="8.5"
        font-family="Nunito, sans-serif" font-weight="800" fill="#6b5836">${ratio}</text>
    </g>
  `;
}

function renderBoard(result, setup) {
  const { cells, ports, attempt } = result;
  const { seedText, playerCount, victoryPoints, robberMode, showPorts } = setup;

  const sea = seaRing(cells);
  const allTiles = [...cells, ...sea];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  allTiles.forEach((tile) => {
    const { x, y } = axialToPixel(tile.q, tile.r);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  const hexW = Math.sqrt(3) * HEX_SIZE;
  const margin = 10;
  const viewX = minX - hexW / 2 - margin;
  const viewY = minY - HEX_SIZE - margin;
  const viewW = maxX - minX + hexW + margin * 2;
  const viewH = maxY - minY + HEX_SIZE * 2 + margin * 2;

  let svg = `<svg viewBox="${viewX.toFixed(1)} ${viewY.toFixed(1)} ${viewW.toFixed(1)} ${viewH.toFixed(1)}"
    xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Generated Catan board">`;
  svg += SVG_DEFS;

  sea.forEach((tile) => {
    svg += seaTileSvg(tile);
  });

  cells.forEach((cell) => {
    svg += landTileSvg(cell);
  });

  if (showPorts) {
    const landByCoord = indexCells(cells);
    const portTiles = choosePortTiles(sea, landByCoord, ports.length);
    portTiles.forEach((tile, i) => {
      svg += portSvg(ports[i], tile);
    });
  }

  svg += "</svg>";
  boardEl.innerHTML = svg;

  const fairnessStatus = fairnessToggle.checked
    ? attempt >= 0
      ? "fair numbers"
      : "fairness fallback"
    : "no number fairness";

  const spreadStatus = resourceBalanceToggle.checked ? "spread resources" : "free resource spread";
  const portStatus = showPorts ? `${ports.length} ports visible` : "ports hidden";

  metaEl.textContent = [
    `Seed: ${seedText}`,
    `Players: ${playerCount}`,
    `Victory: ${victoryPoints} VP`,
    `Robber: ${robberMode === "friendly" ? "friendly" : "classic"}`,
    fairnessStatus,
    spreadStatus,
    portStatus,
  ].join(" | ");
}

function createAndRender(options = { bumpSeed: false }) {
  if (options.bumpSeed && currentSeed != null) {
    seedInput.value = `${currentSeed + 1}`;
  }

  const seedText = seedInput.value.trim() || String(Date.now());
  const playerCount = Number(playerCountInput.value) || 4;
  const victoryPoints = Math.min(20, Math.max(6, Number(victoryPointsInput.value) || 10));
  const robberMode = robberModeInput.value;
  const enforceFairness = fairnessToggle.checked;
  const enforceResourceSpread = resourceBalanceToggle.checked;
  const showPorts = portsToggle.checked;
  const randomizePorts = randomPortsToggle.checked;

  const result = generateMap({
    seedText,
    playerCount,
    enforceFairness,
    enforceResourceSpread,
    randomizePorts,
  });

  currentSeed = result.attemptSeed;

  renderBoard(result, {
    seedText,
    playerCount,
    victoryPoints,
    robberMode,
    showPorts,
  });
}

generateBtn.addEventListener("click", () => createAndRender({ bumpSeed: false }));
shuffleBtn.addEventListener("click", () => createAndRender({ bumpSeed: true }));

[playerCountInput, victoryPointsInput, robberModeInput, portsToggle, randomPortsToggle].forEach((el) => {
  el.addEventListener("change", () => createAndRender({ bumpSeed: false }));
});

const urlParams = new URLSearchParams(window.location.search);
const playersParam = urlParams.get("players");
if (playersParam && ["2", "3", "4", "5", "6"].includes(playersParam)) {
  playerCountInput.value = playersParam;
}
const seedParam = urlParams.get("seed");
if (seedParam) {
  seedInput.value = seedParam.slice(0, 40);
}

createAndRender();
