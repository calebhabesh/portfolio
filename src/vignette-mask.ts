// Stochastic alpha rounding breaks up the bands in an 8-bit gradient mask.
// Generate once per viewport size; the noise stays still during ripple animation.
export function installVignetteMask(host: HTMLElement) {
  let objectUrl: string | undefined;
  let timer: ReturnType<typeof setTimeout>;
  let generation = 0;
  let disposed = false;

  const render = () => {
    const currentGeneration = ++generation;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    // Bound memory and resize work on large or high-density displays.
    const scale = Math.min(devicePixelRatio || 1, 2, Math.sqrt(2_000_000 / (width * height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return;
    const pixels = context.createImageData(canvas.width, canvas.height);
    let seed = 123456789;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const radius = Math.SQRT2 * Math.hypot(
          (x + 0.5) / canvas.width - 0.5,
          (y + 0.5) / canvas.height - 0.5,
        );
        const alpha = Math.max(0, Math.min(1, (1 - radius) / 0.7));
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const noise = (seed >>> 0) / 4294967296;
        pixels.data[(y * canvas.width + x) * 4 + 3] = Math.floor(alpha * 255 + noise);
      }
    }
    context.putImageData(pixels, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob || disposed || currentGeneration !== generation) return;
      const previousUrl = objectUrl;
      objectUrl = URL.createObjectURL(blob);
      host.style.maskImage = `url("${objectUrl}")`;
      if (previousUrl) URL.revokeObjectURL(previousUrl);
    });
  };
  const observer = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  });
  observer.observe(host);
  render();
  return () => {
    disposed = true;
    clearTimeout(timer);
    observer.disconnect();
    host.style.removeProperty("mask-image");
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
}
