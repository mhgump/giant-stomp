const DEFAULT_CELL_SIZE = 8;
const DEFAULT_HALF_LINES = 4;
const DEFAULT_WALL_RADIUS = 32;

export class RoadGraph {
  constructor(cellSize = DEFAULT_CELL_SIZE, halfLines = DEFAULT_HALF_LINES, wallRadius = DEFAULT_WALL_RADIUS) {
    this.cellSize = cellSize;
    this.halfLines = halfLines;
    this.wallRadius = wallRadius;
    this.nodes = new Map(); // "x,z" -> { x, z, neighbors: ["x,z", ...] }

    this.buildGraph();
  }

  key(x, z) {
    return `${x},${z}`;
  }

  buildGraph() {
    const { cellSize, halfLines, wallRadius } = this;

    // Create nodes at every road intersection inside the wall
    for (let i = -halfLines; i <= halfLines; i++) {
      for (let j = -halfLines; j <= halfLines; j++) {
        const x = i * cellSize;
        const z = j * cellSize;
        if (Math.sqrt(x * x + z * z) <= wallRadius) {
          this.nodes.set(this.key(x, z), { x, z, neighbors: [] });
        }
      }
    }

    // Connect cardinal neighbors
    for (const [k, node] of this.nodes) {
      const dirs = [
        [cellSize, 0], [-cellSize, 0],
        [0, cellSize], [0, -cellSize],
      ];
      for (const [dx, dz] of dirs) {
        const nk = this.key(node.x + dx, node.z + dz);
        if (this.nodes.has(nk)) {
          node.neighbors.push(nk);
        }
      }
    }
  }

  nearestNode(x, z) {
    let best = null;
    let bestDist = Infinity;
    for (const node of this.nodes.values()) {
      const dx = node.x - x;
      const dz = node.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        best = node;
      }
    }
    return best;
  }

  // Returns the up-to-4 corner intersections of the cell containing a house
  houseCornersOf(houseX, houseZ) {
    const cs = this.cellSize;
    // House is at (col+0.5)*cs, (row+0.5)*cs — find col, row
    const col = Math.floor(houseX / cs);
    const row = Math.floor(houseZ / cs);
    const corners = [];
    for (let di = 0; di <= 1; di++) {
      for (let dj = 0; dj <= 1; dj++) {
        const cx = (col + di) * cs;
        const cz = (row + dj) * cs;
        const k = this.key(cx, cz);
        if (this.nodes.has(k)) {
          corners.push(this.nodes.get(k));
        }
      }
    }
    return corners;
  }

  // BFS from a single start node, returns distance map and predecessor map
  bfs(startKey) {
    const dist = new Map();
    const preds = new Map(); // key -> [predecessor keys at dist-1]
    dist.set(startKey, 0);
    preds.set(startKey, []);
    const queue = [startKey];
    let head = 0;

    while (head < queue.length) {
      const ck = queue[head++];
      const cd = dist.get(ck);
      const node = this.nodes.get(ck);
      for (const nk of node.neighbors) {
        if (!dist.has(nk)) {
          dist.set(nk, cd + 1);
          preds.set(nk, [ck]);
          queue.push(nk);
        } else if (dist.get(nk) === cd + 1) {
          preds.get(nk).push(ck);
        }
      }
    }

    return { dist, preds };
  }

  // Extract a random shortest path from start to end using a precomputed BFS from end
  extractPath(startKey, endKey, preds) {
    if (!preds.has(startKey)) return null;
    const path = [];
    let current = startKey;
    while (current !== endKey) {
      const node = this.nodes.get(current);
      path.push({ x: node.x, z: node.z });
      const options = preds.get(current);
      if (!options || options.length === 0) return null;
      // Random tie-breaking
      current = options[Math.floor(Math.random() * options.length)];
    }
    // Don't include the end node — wait, we need BFS from the END
    // Actually let me reconsider: BFS from end, predecessors point toward end
    // So extractPath walks from start toward end using predecessors
    // This is wrong — preds from BFS(end) point AWAY from end (toward start)
    // Let me fix: we need to walk from start, picking neighbors that are closer to end
    return null; // placeholder — use findPath instead
  }

  // Find shortest path between two road nodes with random tie-breaking
  findPathBetweenNodes(startKey, endKey) {
    if (startKey === endKey) return [];

    // BFS from end so we can walk forward from start with random tie-breaking
    const { dist } = this.bfs(endKey);
    if (!dist.has(startKey)) return null;

    const path = [];
    let current = startKey;
    while (current !== endKey) {
      const node = this.nodes.get(current);
      path.push({ x: node.x, z: node.z });

      const cd = dist.get(current);
      // Find neighbors that are 1 step closer to end
      const closer = node.neighbors.filter(nk => dist.get(nk) === cd - 1);
      if (closer.length === 0) return null;
      current = closer[Math.floor(Math.random() * closer.length)];
    }
    // Add the final node
    const endNode = this.nodes.get(endKey);
    path.push({ x: endNode.x, z: endNode.z });

    return path;
  }

  // High-level: find path from arbitrary position to arbitrary position via roads
  findPath(fromX, fromZ, toX, toZ) {
    const startNode = this.nearestNode(fromX, fromZ);
    const endNode = this.nearestNode(toX, toZ);
    if (!startNode || !endNode) return null;

    const startKey = this.key(startNode.x, startNode.z);
    const endKey = this.key(endNode.x, endNode.z);

    const roadPath = this.findPathBetweenNodes(startKey, endKey);
    if (!roadPath) return null;

    // Prepend off-road walk to start node if not already there
    const waypoints = [];
    const dxs = fromX - startNode.x;
    const dzs = fromZ - startNode.z;
    if (dxs * dxs + dzs * dzs > 0.25) {
      waypoints.push({ x: startNode.x, z: startNode.z });
    }

    waypoints.push(...roadPath);
    return waypoints;
  }
}

// Build path from current position to a house center
export function buildPathToHouse(graph, fromX, fromZ, houseX, houseZ) {
  const startNode = graph.nearestNode(fromX, fromZ);
  if (!startNode) return null;
  const startKey = graph.key(startNode.x, startNode.z);

  // Find which corner of the house's cell is closest via BFS
  const corners = graph.houseCornersOf(houseX, houseZ);
  if (corners.length === 0) return null;

  let bestPath = null;
  let bestLen = Infinity;
  const candidates = [];

  for (const corner of corners) {
    const cornerKey = graph.key(corner.x, corner.z);
    const path = graph.findPathBetweenNodes(startKey, cornerKey);
    if (path && path.length < bestLen) {
      bestLen = path.length;
      candidates.length = 0;
      candidates.push(path);
    } else if (path && path.length === bestLen) {
      candidates.push(path);
    }
  }

  if (candidates.length === 0) return null;
  bestPath = candidates[Math.floor(Math.random() * candidates.length)];

  // Prepend off-road walk to nearest node if needed
  const waypoints = [];
  const dxs = fromX - startNode.x;
  const dzs = fromZ - startNode.z;
  if (dxs * dxs + dzs * dzs > 0.25) {
    waypoints.push({ x: startNode.x, z: startNode.z });
  }

  waypoints.push(...bestPath);

  // Append off-road walk to house center
  waypoints.push({ x: houseX, z: houseZ });

  return waypoints;
}

// Build path from current position to a moving target's nearest road node
export function buildPathToPoint(graph, fromX, fromZ, toX, toZ) {
  const path = graph.findPath(fromX, fromZ, toX, toZ);
  if (!path) return null;

  // Append the actual target position as final waypoint
  const lastWp = path[path.length - 1];
  const dxt = toX - lastWp.x;
  const dzt = toZ - lastWp.z;
  if (dxt * dxt + dzt * dzt > 0.25) {
    path.push({ x: toX, z: toZ });
  }

  return path;
}
