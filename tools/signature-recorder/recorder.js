import {
  createSignature, parseSignature, signatureDuration, drawSignature, signatureSVG,
} from "../../src/lib/signature.js";

const byId = id => document.getElementById(id);
const drawing = byId("drawing");
const preview = byId("preview");
const status = byId("status");
const draftKey = "caleb-signature-recorder-v1";
let data = createSignature();
let activePointer = null;
let origin = null;
let timeOffset = 0;
let replayFrame = 0;
let renderFrame = 0;
let saveTimer = 0;
let replayUntil = Infinity;
let draftAvailable = true;
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");

function announce(message) { status.textContent = message; }

function saveDraft() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  try {
    localStorage.setItem(draftKey, JSON.stringify(data));
  } catch {
    draftAvailable = false;
    announce("This browser couldn’t save your draft. Download both files to keep this take.");
  }
}

function syncControls() {
  const empty = data.strokes.length === 0;
  const recording = activePointer !== null;
  for (const id of ["undo", "clear", "download-json", "download-svg"]) byId(id).disabled = empty || recording;
  byId("replay").disabled = empty || recording;
  byId("replay").textContent = replayFrame ? "Stop replay" : "Replay signature";
  for (const id of ["ink-width", "use-pressure", "timing", "load"]) byId(id).disabled = recording;
  byId("ink-width").value = data.settings.width;
  byId("ink-width-value").value = data.settings.width;
  byId("use-pressure").checked = data.settings.pressure;
  byId("empty-hint").hidden = !empty;
  byId("preview-placeholder").hidden = !empty;
  const duration = (signatureDuration(data) / 1000).toFixed(1);
  byId("recording-stats").textContent = empty ? "No strokes yet" : `${data.strokes.length} ${data.strokes.length === 1 ? "stroke" : "strokes"} · ${duration}s recorded`;
  updatePressure();
}

function updatePressure() {
  let minimum = Infinity, maximum = -Infinity;
  let penFound = false;
  for (const stroke of data.strokes) {
    if (stroke.pointerType !== "pen") continue;
    penFound = true;
    for (const point of stroke.points) {
      minimum = Math.min(minimum, point.pressure);
      maximum = Math.max(maximum, point.pressure);
    }
  }
  byId("pressure-status").textContent = !penFound
    ? "Pressure: waiting for pen input"
    : maximum - minimum > 0.02
      ? `Pressure detected: ${Math.round(minimum * 100)}–${Math.round(maximum * 100)}%`
      : "Pen detected · vary pressure to test sensitivity";
}

function render() {
  renderFrame = 0;
  drawSignature(drawing, data, { until: replayUntil });
  const color = getComputedStyle(byId("footer-preview")).getPropertyValue("--preview-ink").trim();
  drawSignature(preview, data, { until: replayUntil, cropped: true, color });
}

function requestRender() {
  if (!renderFrame) renderFrame = requestAnimationFrame(render);
}

function resizeCanvases() {
  for (const canvas of [drawing, preview]) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * devicePixelRatio));
    canvas.height = Math.max(1, Math.round(rect.height * devicePixelRatio));
  }
  requestRender();
}
new ResizeObserver(resizeCanvases).observe(drawing);
new ResizeObserver(resizeCanvases).observe(preview);
window.addEventListener("resize", resizeCanvases);

function stopReplay() {
  cancelAnimationFrame(replayFrame);
  replayFrame = 0;
  replayUntil = Infinity;
  syncControls();
  requestRender();
}

function timeFor(event) {
  return Math.max(data.strokes.at(-1)?.points.at(-1)?.time || 0, event.timeStamp - origin + timeOffset);
}

function addPoint(event, releasing = false) {
  const stroke = data.strokes.at(-1);
  const rect = drawing.getBoundingClientRect();
  const previous = stroke.points.at(-1);
  const round = value => Math.round(value * 1000) / 1000;
  const point = {
    x: round(Math.max(0, Math.min(data.canvas.width, (event.clientX - rect.left) / rect.width * data.canvas.width))),
    y: round(Math.max(0, Math.min(data.canvas.height, (event.clientY - rect.top) / rect.height * data.canvas.height))),
    time: round(timeFor(event)),
    pressure: round(releasing ? (previous?.pressure ?? 0.5) : Math.max(0, Math.min(1, event.pressure))),
  };
  if (previous && point.x === previous.x && point.y === previous.y && point.pressure === previous.pressure) return;
  stroke.points.push(point);
  stroke.endedAt = point.time;
  if (!saveTimer) saveTimer = setTimeout(saveDraft, 250);
  requestRender();
}

drawing.addEventListener("pointerdown", event => {
  if (activePointer !== null || event.button !== 0) return;
  event.preventDefault();
  stopReplay();
  if (origin === null) {
    origin = event.timeStamp;
    timeOffset = data.strokes.length ? signatureDuration(data) + 180 : 0;
  }
  const startedAt = Math.round(Math.max(signatureDuration(data), event.timeStamp - origin + timeOffset) * 1000) / 1000;
  data.strokes.push({
    pointerType: ["pen", "touch"].includes(event.pointerType) ? event.pointerType : "mouse",
    startedAt,
    endedAt: startedAt,
    points: [],
  });
  activePointer = event.pointerId;
  drawing.setPointerCapture(event.pointerId);
  addPoint(event);
  byId("input-status").textContent = `Recording ${event.pointerType || "mouse"} input`;
  syncControls();
});

drawing.addEventListener("pointermove", event => {
  if (event.pointerId !== activePointer) return;
  event.preventDefault();
  const samples = event.getCoalescedEvents?.() || [];
  for (const sample of samples.length ? samples : [event]) addPoint(sample);
  updatePressure();
});

function finishStroke(event) {
  if (activePointer === null || (event?.pointerId !== undefined && event.pointerId !== activePointer)) return;
  const pointer = activePointer;
  if (event?.type === "pointerup") addPoint(event, true);
  const stroke = data.strokes.at(-1);
  const endTime = event?.timeStamp ?? performance.now();
  stroke.endedAt = Math.round(Math.max(stroke.points.at(-1).time, endTime - origin + timeOffset) * 1000) / 1000;
  activePointer = null;
  if (drawing.hasPointerCapture(pointer)) drawing.releasePointerCapture(pointer);
  byId("input-status").textContent = `Captured ${stroke.pointerType} input`;
  saveDraft();
  syncControls();
  requestRender();
  if (draftAvailable) announce("Stroke captured. Replay your signature, or keep writing.");
}
for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) drawing.addEventListener(name, finishStroke);
window.addEventListener("blur", () => { finishStroke(); stopReplay(); });
window.addEventListener("pagehide", () => { finishStroke(); saveDraft(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { finishStroke(); stopReplay(); }
});

byId("undo").addEventListener("click", () => {
  stopReplay();
  data.strokes.pop();
  origin = null;
  saveDraft();
  syncControls();
  requestRender();
  if (draftAvailable) announce("Last stroke removed.");
});

byId("clear").addEventListener("click", () => {
  stopReplay();
  data.strokes = [];
  origin = null;
  byId("input-status").textContent = "Ready for your pen, mouse, or touch";
  saveDraft();
  syncControls();
  requestRender();
  if (draftAvailable) announce("Fresh page. Draw your next take.");
});

byId("replay").addEventListener("click", () => {
  if (replayFrame) { stopReplay(); announce("Replay stopped."); return; }
  if (motionPreference.matches) {
    announce("Showing the finished signature because reduced motion is enabled.");
    return;
  }
  const recordedDuration = Math.max(1, signatureDuration(data));
  const duration = byId("timing").value === "original" ? recordedDuration : Number(byId("timing").value);
  const start = performance.now();
  replayUntil = -1;
  render();
  const frame = now => {
    const progress = Math.min(1, (now - start) / duration);
    replayUntil = progress * recordedDuration;
    render();
    if (progress < 1) replayFrame = requestAnimationFrame(frame);
    else { stopReplay(); announce("Replay complete. Download both files when you like this take."); }
  };
  replayFrame = requestAnimationFrame(frame);
  syncControls();
  announce("Replaying your handwriting in the drawing area and footer preview.");
});
motionPreference.addEventListener("change", () => {
  if (motionPreference.matches && replayFrame) { stopReplay(); announce("Showing the finished signature because reduced motion is enabled."); }
});
byId("timing").addEventListener("change", stopReplay);

// Store the changed value before stopReplay synchronizes the form controls.
byId("ink-width").addEventListener("input", event => {
  data.settings.width = Number(event.target.value);
  stopReplay();
  saveDraft();
  syncControls();
  requestRender();
});
byId("use-pressure").addEventListener("change", event => {
  data.settings.pressure = event.target.checked;
  stopReplay();
  saveDraft();
});

byId("theme").addEventListener("click", () => {
  const dark = byId("footer-preview").classList.toggle("dark");
  byId("theme").setAttribute("aria-pressed", String(dark));
  byId("theme").textContent = dark ? "Light preview" : "Dark preview";
  requestRender();
});

function download(content, extension, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `signature-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce(`${extension.toUpperCase()} downloaded. Keep both JSON and SVG for this take.`);
}
byId("download-json").addEventListener("click", () => download(`${JSON.stringify(data, null, 2)}\n`, "json", "application/json"));
byId("download-svg").addEventListener("click", () => download(signatureSVG(data), "svg", "image/svg+xml"));

byId("load").addEventListener("click", () => byId("import").click());
byId("import").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 10_000_000) throw new Error("Choose a recording smaller than 10 MB.");
    const imported = parseSignature(await file.text());
    finishStroke();
    stopReplay();
    data = imported;
    origin = null;
    saveDraft();
    syncControls();
    requestRender();
    byId("input-status").textContent = "Loaded saved recording";
    if (draftAvailable) announce("Recording loaded. Replay it or adjust the ink weight.");
  } catch (error) {
    announce(error instanceof SyntaxError ? "This file isn’t valid JSON. Choose a downloaded signature recording." : error.message);
  } finally {
    event.target.value = "";
  }
});

try {
  const saved = localStorage.getItem(draftKey);
  if (saved) {
    data = parseSignature(saved);
    if (data.strokes.length) announce("Your previous draft is restored. Replay it, keep writing, or download both files.");
  }
} catch {
  announce("Your previous draft couldn’t be restored. Draw a new take or load a downloaded JSON.");
}
syncControls();
resizeCanvases();
