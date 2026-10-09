import assert from "node:assert/strict";
import { createServer } from "vite";

// Load the same TS modules as the app without requiring Node's type stripping.
const { projects, matchTechnologyTags, matchTechnologyText, technologySearchTerms } = await (async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    return {
      ...await server.ssrLoadModule("/src/data/projects.ts"),
      ...await server.ssrLoadModule("/src/lib/technology-search.ts"),
    };
  } finally {
    await server.close();
  }
})();

const results = query => projects.filter(project => matchTechnologyTags(
  [...project.tags, ...(project.additionalTags || [])], technologySearchTerms(query),
) !== null).map(project => project.id);

for (const [query, ids] of [
  ["", ["doorlink", "linewatch", "orbit", "courtlens", "medical-imaging", "systemc-noc", "fpga-pong", "portfolio-site"]],
  ["J", ["doorlink", "linewatch", "portfolio-site"]],
  ["j", ["doorlink", "linewatch", "portfolio-site"]],
  ["P", ["doorlink", "linewatch", "courtlens", "portfolio-site"]],
  ["Ja", ["doorlink", "linewatch", "portfolio-site"]],
  ["jA", ["doorlink", "linewatch", "portfolio-site"]],
  ["Jav", ["doorlink", "linewatch", "portfolio-site"]],
  ["Java", ["doorlink", "linewatch", "portfolio-site"]],
  ["Py", ["courtlens"]],
  ["React", ["doorlink", "linewatch", "orbit", "courtlens", "portfolio-site"]],
  ["React, PostgreSQL", ["doorlink", "linewatch", "courtlens"]],
  ["React, SQLite", ["orbit"]],
  ["Spring Boot", ["doorlink", "linewatch"]],
  ["nextjs", ["doorlink", "linewatch", "courtlens"]],
  ["postgres", ["doorlink", "linewatch", "courtlens"]],
  ["OCI", ["linewatch"]],
  ["TS", ["doorlink", "linewatch", "orbit", "courtlens", "portfolio-site"]],
  ["golang", ["orbit"]],
  ["Pyhton", ["courtlens"]],
  ["postgress", ["doorlink", "linewatch", "courtlens"]],
  ["C", ["doorlink"]],
  ["C++", ["doorlink", "medical-imaging", "systemc-noc"]],
  ["SQL", ["courtlens"]],
  ["SystemC", ["systemc-noc"]],
  ["VHDL", ["fpga-pong"]],
  ["FPGA", ["fpga-pong"]],
  ["RTL, GHDL", ["fpga-pong"]],
  ["go", ["orbit"]],
  ["Lab", []],
  ["doorlink", []],
  ["recruitment", []],
  ["_", []],
]) assert.deepEqual(results(query), ids, `Unexpected technology matches for ${query}`);

const highlighted = (tag, query) => (matchTechnologyTags([tag], technologySearchTerms(query))?.get(tag) || [])
  .map(({ start, end }) => tag.slice(start, end));
assert.deepEqual(highlighted("Java · Spring Boot", "Ja"), ["Ja"]);
assert.deepEqual(highlighted("Java · Spring Boot", "J"), ["J"]);
assert.deepEqual(highlighted("Java · Spring Boot", "v"), []);
assert.deepEqual(highlighted("Django", "go"), []);
assert.deepEqual(highlighted("SQLAlchemy", "SQL"), []);
assert.deepEqual(highlighted("PostgreSQL", "ql"), []);
assert.deepEqual(highlighted("PostgreSQL · PostGIS", "post"), ["Post", "Post"]);
assert.deepEqual(highlighted("Python · FastAPI", "pyhton"), ["Python"]);
assert.deepEqual(highlighted("Oracle Cloud Infrastructure", "oci"), ["Oracle Cloud Infrastructure"]);
assert.deepEqual(highlighted("AWS (Lab)", "aws"), ["AWS"]);
assert.deepEqual(highlighted("TypeScript · Next.js", "nextjs"), ["Next.js"]);
assert.deepEqual(highlighted("C/C++ · ESP-IDF", "C"), ["C"]);
assert.deepEqual(highlighted("C/C++ · ESP-IDF", "C++"), ["C++"]);
assert.deepEqual(highlighted("PostgreSQL", "post, postgres"), ["PostgreS"]);
assert.deepEqual(technologySearchTerms(" React, , REACT, Spring Boot, "), ["react", "spring boot"]);
const proseMatches = (text, tags, query) => matchTechnologyText(text, tags, technologySearchTerms(query))
  .map(({ start, end }) => text.slice(start, end));
assert.deepEqual(proseMatches("Mosquitto handles MQTT commands; Mosquitto also sends events.", ["Mosquitto", "MQTT"], "Mos"), ["Mos", "Mos"]);
assert.deepEqual(proseMatches("Just use Java, not JavaScript.", ["Java"], "J"), ["J"]);
assert.deepEqual(proseMatches("Oracle Cloud Infrastructure (OCI) hosts the service on OCI.", ["Oracle Cloud Infrastructure"], "oci"), ["Oracle Cloud Infrastructure", "OCI", "OCI"]);
assert.deepEqual(proseMatches("Python runs the pipeline.", ["Python · FastAPI"], "pyhton"), ["Python"]);
assert.deepEqual(proseMatches("PostgreSQL stores records.", ["PostgreSQL", "React"], "React, postgres"), ["PostgreS"]);
assert.deepEqual(proseMatches("C++ processes images; C++17 is the build standard.", ["C++17"], "cpp"), ["C++", "C++17"]);
assert.deepEqual(proseMatches("The gateway sends event records.", ["Java"], "J"), []);
assert.deepEqual(proseMatches("Next.js and Nextjs dashboards.", ["Next.js"], "nextjs"), ["Next.js", "Nextjs"]);
assert.deepEqual(proseMatches("Mosquitto handles commands.", ["Mosquitto"], ""), []);
console.log("Technology search passed: stack conjunction, aliases, typos, short names, qualifiers and highlight ranges.");
