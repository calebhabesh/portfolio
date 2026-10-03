// Capture data stays independent of rendering so the same recording can later
// drive the footer, including its original timing and pen lifts.
export const SIGNATURE_FORMAT = "caleb-signature";
export const SIGNATURE_CANVAS = { width: 1000, height: 400 };

export function createSignature() {
  return {
    format: SIGNATURE_FORMAT,
    version: 1,
    canvas: { ...SIGNATURE_CANVAS },
    settings: { width: 4, pressure: true },
    strokes: [],
  };
}

export function parseSignature(text) {
  const data = JSON.parse(text);
  const finite = value => typeof value === "number" && Number.isFinite(value);
  if (data?.format !== SIGNATURE_FORMAT || data.version !== 1 ||
      data.canvas?.width !== SIGNATURE_CANVAS.width || data.canvas?.height !== SIGNATURE_CANVAS.height ||
      !finite(data.settings?.width) || data.settings.width < 1 || data.settings.width > 10 ||
      typeof data.settings.pressure !== "boolean" || !Array.isArray(data.strokes) || data.strokes.length > 1000) {
    throw new Error("Choose a signature JSON downloaded from this recorder.");
  }
  let lastTime = 0;
  let pointCount = 0;
  for (const stroke of data.strokes) {
    if (!["pen", "mouse", "touch"].includes(stroke.pointerType) ||
        !finite(stroke.startedAt) || !finite(stroke.endedAt) || stroke.startedAt < lastTime ||
        stroke.endedAt < stroke.startedAt || !Array.isArray(stroke.points) || !stroke.points.length) {
      throw new Error("The recording contains an invalid stroke.");
    }
    lastTime = stroke.startedAt;
    for (const point of stroke.points) {
      if (![point.x, point.y, point.time, point.pressure].every(finite) ||
          point.x < 0 || point.x > data.canvas.width || point.y < 0 || point.y > data.canvas.height ||
          point.pressure < 0 || point.pressure > 1 || point.time < lastTime || point.time > stroke.endedAt) {
        throw new Error("The recording contains invalid pen data.");
      }
      lastTime = point.time;
      if (++pointCount > 100000) throw new Error("This recording is too large.");
    }
    lastTime = stroke.endedAt;
  }
  return data;
}

export function signatureDuration(data) {
  return data.strokes.at(-1)?.endedAt || 0;
}

const mix = (a, b, amount) => ({
  x: a.x + (b.x - a.x) * amount,
  y: a.y + (b.y - a.y) * amount,
  time: a.time + (b.time - a.time) * amount,
  pressure: a.pressure + (b.pressure - a.pressure) * amount,
});

// Midpoint quadratics soften sampling noise without replacing the handwriting.
// Each piece has its own width, keeping pen pressure in Canvas and SVG alike.
export function signatureSegments(data, until = Infinity) {
  const segments = [];
  for (const stroke of data.strokes) {
    const points = stroke.points;
    const first = points[0];
    if (first.time > until) break;
    const widthFor = point => data.settings.width * (
      data.settings.pressure && stroke.pointerType === "pen" ? 0.35 + point.pressure * 1.3 : 1
    );
    segments.push({ start: first, end: first, width: widthFor(first), dot: true });
    let start = first;
    for (let i = 0; i < points.length; i++) {
      const control = points[i];
      const end = i + 1 < points.length ? mix(control, points[i + 1], 0.5) : control;
      if (until < start.time) break;
      const amount = end.time > start.time ? Math.min(1, (until - start.time) / (end.time - start.time)) : 1;
      if (amount <= 0) break;
      // de Casteljau splits the quadratic, giving smooth partial-stroke playback.
      const partialControl = mix(start, control, amount);
      const partialEnd = mix(partialControl, mix(control, end, amount), amount);
      segments.push({ start, control: partialControl, end: partialEnd, width: widthFor(mix(start, end, 0.5)) });
      if (amount < 1) break;
      start = end;
    }
  }
  return segments;
}

export function signatureBounds(data) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const stroke of data.strokes) {
    for (const point of stroke.points) {
      left = Math.min(left, point.x);
      top = Math.min(top, point.y);
      right = Math.max(right, point.x);
      bottom = Math.max(bottom, point.y);
    }
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, ...data.canvas };
  const padding = data.settings.width * 1.65 / 2 + 10;
  return { x: left - padding, y: top - padding, width: right - left + padding * 2, height: bottom - top + padding * 2 };
}

export function drawSignature(canvas, data, { until = Infinity, cropped = false, color = "#161f1b" } = {}) {
  const context = canvas.getContext("2d");
  const bounds = cropped ? signatureBounds(data) : { x: 0, y: 0, ...data.canvas };
  const scale = Math.min(canvas.width / bounds.width, canvas.height / bounds.height);
  context.resetTransform();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate((canvas.width - bounds.width * scale) / 2, (canvas.height - bounds.height * scale) / 2);
  context.scale(scale, scale);
  context.translate(-bounds.x, -bounds.y);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const segment of signatureSegments(data, until)) {
    context.beginPath();
    if (segment.dot) {
      context.arc(segment.start.x, segment.start.y, segment.width / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.moveTo(segment.start.x, segment.start.y);
      context.quadraticCurveTo(segment.control.x, segment.control.y, segment.end.x, segment.end.y);
      context.lineWidth = segment.width;
      context.stroke();
    }
  }
}

export function signatureSVG(data) {
  const bounds = signatureBounds(data);
  const number = value => Number(value.toFixed(3));
  const coords = point => `${number(point.x)} ${number(point.y)}`;
  const paths = signatureSegments(data).map(segment => segment.dot
    ? `  <circle cx="${number(segment.start.x)}" cy="${number(segment.start.y)}" r="${number(segment.width / 2)}" fill="currentColor" stroke="none"/>`
    : `  <path d="M${coords(segment.start)}Q${coords(segment.control)} ${coords(segment.end)}" stroke-width="${number(segment.width)}"/>`
  ).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[bounds.x, bounds.y, bounds.width, bounds.height].map(number).join(" ")}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" role="img" aria-labelledby="signature-title">\n<title id="signature-title">Caleb Habesh’s signature</title>\n${paths}\n</svg>\n`;
}
