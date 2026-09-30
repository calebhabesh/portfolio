// Wall bits run clockwise: north, east, south, west.
export const DIRECTIONS = [
  { dx: 0, dy: -1, wall: 1, opposite: 4 },
  { dx: 1, dy: 0, wall: 2, opposite: 8 },
  { dx: 0, dy: 1, wall: 4, opposite: 1 },
  { dx: -1, dy: 0, wall: 8, opposite: 2 },
];

export function seededRandom(seed) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

// Small binary heap: A* should stay cheap even on tall desktop windows.
class Frontier {
  entries = [];
  before(a, b) { return a.f < b.f || (a.f === b.f && a.h < b.h); }
  push(entry) {
    let index = this.entries.length;
    this.entries.push(entry);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(entry, this.entries[parent])) break;
      this.entries[index] = this.entries[parent];
      index = parent;
    }
    this.entries[index] = entry;
  }
  pop() {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (!this.entries.length) return first;
    let index = 0;
    while (index * 2 + 1 < this.entries.length) {
      let child = index * 2 + 1;
      if (child + 1 < this.entries.length && this.before(this.entries[child + 1], this.entries[child])) child++;
      if (!this.before(this.entries[child], last)) break;
      this.entries[index] = this.entries[child];
      index = child;
    }
    this.entries[index] = last;
    return first;
  }
}

export const CELL_STATE = { unseen: 0, frontier: 1, explored: 2 };

// One step selects the lowest f = g + h candidate and expands its neighbors.
// Exposing the live state lets the visualization show the actual search,
// including branches that never become part of the final route.
export function createMazeSearch(maze) {
  const { columns, rows, walls, start, goal } = maze;
  const costs = new Float64Array(columns * rows).fill(Infinity);
  const previous = new Int32Array(columns * rows).fill(-1);
  const states = new Uint8Array(columns * rows);
  const heuristic = index => Math.abs(index % columns - goal % columns)
    + Math.abs(Math.floor(index / columns) - Math.floor(goal / columns));
  const frontier = new Frontier();
  costs[start] = 0;
  states[start] = CELL_STATE.frontier;
  frontier.push({ index: start, g: 0, h: heuristic(start), f: heuristic(start) });
  const search = {
    costs, previous, states, heuristic,
    status: "searching", current: -1, expanded: 0, frontierCount: 1, path: [],
    step() {
      if (search.status !== "searching") return;
      let current;
      // Improved routes can leave stale entries in the heap. They are not
      // additional expansions and must not create phantom animation steps.
      while (frontier.entries.length) {
        const candidate = frontier.pop();
        if (states[candidate.index] === CELL_STATE.explored || candidate.g !== costs[candidate.index]) continue;
        current = candidate;
        break;
      }
      if (!current) { search.status = "unreachable"; return; }
      search.current = current.index;
      states[current.index] = CELL_STATE.explored;
      search.frontierCount--;
      search.expanded++;
      if (current.index === goal) {
        for (let index = goal; index !== -1; index = previous[index]) search.path.push(index);
        search.path.reverse();
        search.status = "found";
        return;
      }
      const x = current.index % columns, y = Math.floor(current.index / columns);
      for (const direction of DIRECTIONS) {
        const nx = x + direction.dx, ny = y + direction.dy;
        // Entrance/exit wall openings never create nodes outside the maze.
        if (nx < 0 || nx >= columns || ny < 0 || ny >= rows || walls[current.index] & direction.wall) continue;
        const next = ny * columns + nx, g = current.g + 1;
        if (states[next] === CELL_STATE.explored || g >= costs[next]) continue;
        if (states[next] === CELL_STATE.unseen) search.frontierCount++;
        states[next] = CELL_STATE.frontier;
        costs[next] = g;
        previous[next] = current.index;
        const h = heuristic(next);
        frontier.push({ index: next, g, h, f: g + h });
      }
    },
  };
  return search;
}

export function findMazePath(maze) {
  const search = createMazeSearch(maze);
  while (search.status === "searching") search.step();
  return search.path;
}

export function generateMaze(columns, rows, seed, startColumn, goalColumn) {
  const random = seededRandom(seed);
  const walls = new Uint8Array(columns * rows).fill(15);
  const visited = new Uint8Array(walls.length);
  const stack = [startColumn];
  visited[startColumn] = 1;
  while (stack.length) {
    const current = stack.at(-1), x = current % columns, y = Math.floor(current / columns);
    const neighbors = DIRECTIONS.filter(direction => {
      const nx = x + direction.dx, ny = y + direction.dy;
      return nx >= 0 && nx < columns && ny >= 0 && ny < rows && !visited[ny * columns + nx];
    });
    if (!neighbors.length) { stack.pop(); continue; }
    const direction = neighbors[Math.floor(random() * neighbors.length)];
    const next = current + direction.dy * columns + direction.dx;
    walls[current] &= ~direction.wall;
    walls[next] &= ~direction.opposite;
    visited[next] = 1;
    stack.push(next);
  }
  // Open a few extra passages so A* has alternative routes to choose from.
  for (let index = 0; index < walls.length; index++) {
    for (const direction of [DIRECTIONS[1], DIRECTIONS[2]]) {
      const nx = index % columns + direction.dx, ny = Math.floor(index / columns) + direction.dy;
      if (nx >= columns || ny >= rows || !(walls[index] & direction.wall) || random() > 0.08) continue;
      walls[index] &= ~direction.wall;
      walls[ny * columns + nx] &= ~direction.opposite;
    }
  }
  const goal = (rows - 1) * columns + goalColumn;
  walls[startColumn] &= ~1;
  walls[goal] &= ~4;
  return { columns, rows, walls, seed, start: startColumn, goal };
}

