import assert from "node:assert/strict";
import { DIRECTIONS, CELL_STATE, generateMaze, createMazeSearch, findMazePath } from "../src/maze-pathfinding.js";

// An independent breadth-first search is the oracle for shortest routes.
function shortestDistance(maze) {
  const distances = new Int32Array(maze.walls.length).fill(-1);
  const queue = [maze.start];
  distances[maze.start] = 0;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === maze.goal) return distances[index];
    for (const { dx, dy, wall } of DIRECTIONS) {
      const x = index % maze.columns + dx, y = Math.floor(index / maze.columns) + dy;
      if (x < 0 || x >= maze.columns || y < 0 || y >= maze.rows || maze.walls[index] & wall) continue;
      const next = y * maze.columns + x;
      if (distances[next] !== -1) continue;
      distances[next] = distances[index] + 1;
      queue.push(next);
    }
  }
  return -1;
}

function checkPath(maze, path) {
  assert.equal(path[0], maze.start);
  assert.equal(path.at(-1), maze.goal);
  assert.equal(path.length - 1, shortestDistance(maze), "A* must return a shortest route.");
  for (let index = 1; index < path.length; index++) {
    const from = path[index - 1], to = path[index];
    const dx = to % maze.columns - from % maze.columns;
    const dy = Math.floor(to / maze.columns) - Math.floor(from / maze.columns);
    const direction = DIRECTIONS.find(direction => direction.dx === dx && direction.dy === dy);
    assert.ok(direction, "Routes must connect adjacent cells.");
    assert.equal(maze.walls[from] & direction.wall, 0, "A route must never cross a wall.");
  }
}

for (const [columns, rows] of [[3, 20], [8, 23], [12, 30], [24, 42]]) {
  for (let seed = 1; seed <= 500; seed++) {
    const maze = generateMaze(columns, rows, seed, seed % columns, (seed * 3) % columns);
    const search = createMazeSearch(maze);
    assert.deepEqual(search.path, [], "The visualization must begin without a solution.");
    assert.equal(search.expanded, 0);
    let steps = 0;
    while (search.status === "searching") {
      const candidates = Array.from(search.states, (state, index) => state === CELL_STATE.frontier ? index : -1)
        .filter(index => index !== -1);
      const minPriority = Math.min(...candidates.map(index => search.costs[index] + search.heuristic(index)));
      const expanded = search.expanded;
      search.step();
      assert.equal(search.expanded, expanded + 1, "Each step must expand exactly one node.");
      assert.equal(search.costs[search.current] + search.heuristic(search.current), minPriority,
        "A* must select the lowest f score among queued cells.");
      assert.equal(search.frontierCount, search.states.filter(state => state === CELL_STATE.frontier).length,
        "The frontier count must count live nodes, including when their costs improve.");
      if (search.status === "searching") assert.deepEqual(search.path, [], "Never reveal a solution before selecting the goal.");
      assert.ok(++steps <= maze.walls.length, "A search must terminate within one expansion per cell.");
    }
    assert.equal(search.status, "found");
    checkPath(maze, search.path);
    assert.deepEqual(findMazePath(maze), search.path, "Playback and synchronous search must use the same algorithm.");
    search.step();
    assert.equal(search.expanded, steps, "Completed searches must stop expanding.");
  }
}

// The east branch initially looks closer to the goal, but ends at a wall.
// A* must leave that explored branch visible and return to its queued option.
const detour = { columns: 4, rows: 4, walls: new Uint8Array(16).fill(15), start: 0, goal: 15 };
for (const [from, to] of [[0, 1], [1, 2], [2, 3], [3, 7], [7, 11], [0, 4], [4, 8], [8, 12], [12, 13], [13, 14], [14, 15]]) {
  const direction = DIRECTIONS.find(({ dx, dy }) => from + dx + dy * 4 === to);
  detour.walls[from] &= ~direction.wall;
  detour.walls[to] &= ~direction.opposite;
}
const search = createMazeSearch(detour);
const selected = [];
while (search.status === "searching") {
  search.step();
  selected.push(search.current);
}
checkPath(detour, search.path);
assert.ok(selected.includes(11), "Explore the misleading dead end.");
assert.ok(!search.path.includes(11), "The explored dead end must not belong to the solution.");
assert.equal(search.states[11], CELL_STATE.explored, "Discarded branches remain in the search history.");
assert.ok(selected.some((cell, index) => index > 0 &&
  Math.abs(cell % 4 - selected[index - 1] % 4) + Math.abs(Math.floor(cell / 4) - Math.floor(selected[index - 1] / 4)) > 1),
  "Selecting a different branch is a queue operation, not a runner walking between cells.");
assert.deepEqual(generateMaze(8, 23, 42, 2, 5), generateMaze(8, 23, 42, 2, 5), "Seeds must reproduce the maze exactly.");
assert.deepEqual(findMazePath({ columns: 2, rows: 2, walls: new Uint8Array(4).fill(15), start: 0, goal: 3 }), [],
  "An unreachable goal must not produce a route.");
const trivial = createMazeSearch({ columns: 1, rows: 1, walls: new Uint8Array([15]), start: 0, goal: 0 });
trivial.step();
assert.deepEqual(trivial.path, [0]);
console.log("A* passed against BFS across 2,000 mazes: one real expansion per step, lowest-cost selection, accurate queues, shortest routes, and persistent dead-end exploration.");
