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
    ports: ["three", "wood", "three", "brick", "three", "sheep", "three", "wheat", "three", "ore", "three"],
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
const boardShellEl = document.querySelector(".board-shell");
const portRingEl = document.getElementById("portRing");
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
    const qStart = -Math.floor(len / 2);

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

function toPixel(q, r, hexW, hexH, radius) {
  const x = hexW * (q + r / 2);
  const y = hexH * 0.75 * r;

  return {
    x: x + radius,
    y: y + radius,
  };
}

function perimeterEdges(cells) {
  const byCoord = indexCells(cells);

  const edges = [];
  cells.forEach((cell) => {
    for (let i = 0; i < NEIGHBOR_DIRS.length; i += 1) {
      const [dq, dr] = NEIGHBOR_DIRS[i];
      if (!byCoord.has(keyOf(cell.q + dq, cell.r + dr))) {
        edges.push({
          q: cell.q,
          r: cell.r,
          dq,
          dr,
        });
      }
    }
  });

  return edges;
}

function directionToPixel(dq, dr, hexW, hexH) {
  const x = hexW * (dq + dr / 2);
  const y = hexH * 0.75 * dr;
  return { x, y };
}

function choosePortAnchors(cells, count, geometry) {
  const boundary = perimeterEdges(cells)
    .map((edge) => {
      const center = toPixel(edge.q, edge.r, geometry.hexW, geometry.hexH, geometry.radiusPx);
      const dir = directionToPixel(edge.dq, edge.dr, geometry.hexW, geometry.hexH);

      const edgeX = center.x + dir.x / 2 - geometry.minX + geometry.padding;
      const edgeY = center.y + dir.y / 2 - geometry.minY + geometry.padding;

      return {
        edgeX,
        edgeY,
        outwardX: dir.x,
        outwardY: dir.y,
        angle: Math.atan2(edgeY - geometry.height / 2, edgeX - geometry.width / 2),
      };
    })
    .sort((a, b) => a.angle - b.angle);

  const anchors = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor((i * boundary.length) / count) % boundary.length;
    anchors.push(boundary[index]);
  }

  return anchors;
}

function renderPorts(ports, cells, geometry, showPorts) {
  portRingEl.innerHTML = "";
  if (!showPorts) {
    return;
  }

  const anchors = choosePortAnchors(cells, ports.length, geometry);

  anchors.forEach((anchor, i) => {
    const magnitude = Math.hypot(anchor.outwardX, anchor.outwardY) || 1;
    const ux = anchor.outwardX / magnitude;
    const uy = anchor.outwardY / magnitude;

    const outwardDistance = geometry.radiusPx * 0.95;
    const x = anchor.edgeX + ux * outwardDistance;
    const y = anchor.edgeY + uy * outwardDistance;

    const portType = ports[i];
    const tag = document.createElement("div");
    tag.className = `port-tag ${portType}`;
    tag.textContent = PORT_LABELS[portType] || portType;
    tag.style.left = `${x}px`;
    tag.style.top = `${y}px`;

    portRingEl.appendChild(tag);
  });
}

function renderBoard(result, setup) {
  const { cells, ports, config, attempt } = result;
  const { seedText, playerCount, victoryPoints, robberMode, showPorts } = setup;

  boardEl.innerHTML = "";

  const isLarge = config.rowLayout.length > 5;
  boardShellEl.classList.toggle("large", isLarge);

  const hexW = isLarge ? 78 : 84;
  const hexH = isLarge ? 90 : 96;
  const radiusPx = hexW / 2;
  const padding = isLarge ? 78 : 66;

  const points = cells.map((cell) => toPixel(cell.q, cell.r, hexW, hexH, radiusPx));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;

  boardEl.style.width = `${width}px`;
  boardEl.style.height = `${height}px`;
  portRingEl.style.width = `${width}px`;
  portRingEl.style.height = `${height}px`;

  cells.forEach((cell) => {
    const center = toPixel(cell.q, cell.r, hexW, hexH, radiusPx);
    const left = center.x - minX + padding - hexW / 2;
    const top = center.y - minY + padding - hexH / 2;

    const hex = document.createElement("div");
    hex.className = `hex ${cell.resource}`;
    hex.dataset.resource = RESOURCE_LABELS[cell.resource] || cell.resource;
    hex.style.left = `${left}px`;
    hex.style.top = `${top}px`;
    hex.style.width = `${hexW}px`;
    hex.style.height = `${hexH}px`;

    const token = document.createElement("span");
    token.className = "token";
    token.textContent = cell.number == null ? "" : String(cell.number);

    hex.appendChild(token);
    boardEl.appendChild(hex);
  });

  renderPorts(ports, cells, { hexW, hexH, radiusPx, minX, minY, padding, width, height }, showPorts);

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

createAndRender();
