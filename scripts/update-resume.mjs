// Builds the site's resume from the Typst master, then updates the resume
// link's cache version to match:
//   npm run update:resume -- <master.typ> [YYYY-MM-DD]
// Requires typst and pdftotext (poppler).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./build-cache.mjs";

const [source, day = new Date().toLocaleDateString("en-CA")] = process.argv.slice(2);
if (!source || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.error("Usage: npm run update:resume -- <master.typ> [YYYY-MM-DD]");
  process.exit(1);
}
const format = month => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month, day: "numeric" });

const work = await mkdtemp(join(tmpdir(), "resume-"));
try {
  const output = join(work, "resume.pdf");
  execFileSync("typst", ["compile", "--input", `updated=${format("short")}`, source, output], { stdio: "inherit" });
  const text = execFileSync("pdftotext", ["-layout", output, "-"], { encoding: "utf8" });
  const pdf = await readFile(output);
  if (!text.includes(`Updated ${format("short")}`)) throw new Error("The resume is missing its updated date.");
  if (text.replace(/\f$/, "").includes("\f")) throw new Error("The resume must stay on one page.");

  const indexPath = join(ROOT, "index.html");
  const html = await readFile(indexPath, "utf8");
  const version = createHash("sha256").update(pdf).digest("hex").slice(0, 12);
  const link = /href="\/Caleb_Habesh_Resume\.pdf\?v=[^"]*"/;
  if (!link.test(html)) throw new Error("The resume link is missing from index.html.");
  await copyFile(output, join(ROOT, "public/Caleb_Habesh_Resume.pdf"));
  await writeFile(indexPath, html.replace(link, `href="/Caleb_Habesh_Resume.pdf?v=${version}"`));
  console.log(`Updated public/Caleb_Habesh_Resume.pdf and the resume link (${format("short")}, v=${version}).`);
} finally {
  await rm(work, { recursive: true, force: true });
}
