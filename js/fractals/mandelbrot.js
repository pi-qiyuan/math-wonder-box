(function registerMandelbrotSet(global) {
  const DEFAULT_VIEW = { centerX: -0.62, centerY: 0, scale: 3.05,
  };

  let activeWorkers = [];
  let workerUrl = null;

  function cleanup() {
    activeWorkers.forEach(w => w.terminate());
    activeWorkers = [];
    if (workerUrl) {
      URL.revokeObjectURL(workerUrl);
      workerUrl = null;
    }
  }

  function fitCanvasToDisplay(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = global.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width * ratio));
    const height = Math.max(320, Math.floor(rect.height * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  const WORKER_CODE = `
    const PALETTE = [
      [0, 7, 100],      // Dark Blue
      [32, 107, 203],   // Blue
      [237, 255, 255],  // White
      [255, 170, 0],    // Gold
      [0, 2, 0],        // Black
      [0, 7, 100],      // Seamless cycle back to Dark Blue
    ];
    function interpolate(c1, c2, t) {
      return [
        Math.floor(c1[0] + (c2[0] - c1[0]) * t),
        Math.floor(c1[1] + (c2[1] - c1[1]) * t),
        Math.floor(c1[2] + (c2[2] - c1[2]) * t),
      ];
    }

    function colorFor(iteration, maxIterations, escapedMagnitude) {
      if (iteration >= maxIterations) return [2, 3, 5];

      const smooth = iteration + 1 - Math.log(Math.log(Math.max(escapedMagnitude, 2))) / Math.log(2);
      const colorSpeed = 0.06;
      const t = (smooth * colorSpeed) % 1;

      const paletteScale = t * (PALETTE.length - 1);
      const index = Math.floor(paletteScale);
      const fraction = paletteScale - index;

      return interpolate(PALETTE[index], PALETTE[index + 1], fraction);
    }

    self.onmessage = function(e) {
      const { startY, endY, width, height, view, maxIterations } = e.data;

      const aspect = width / height;
      const scaleX = view.scale * aspect;
      const scaleY = view.scale;
      const buf = new Uint8ClampedArray((endY - startY) * width * 4);

      for (let y = startY; y < endY; y++) {
        const cY = view.centerY + (y / height - 0.5) * scaleY;
        for (let x = 0; x < width; x++) {
          const cX = view.centerX + (x / width - 0.5) * scaleX;
          let zX = 0, zY = 0, iteration = 0;

          while (zX * zX + zY * zY <= 4 && iteration < maxIterations) {
            const nextX = zX * zX - zY * zY + cX;
            zY = 2 * zX * zY + cY;
            zX = nextX;
            iteration += 1;
          }
          const magnitude = Math.sqrt(zX * zX + zY * zY);
          const [red, green, blue] = colorFor(iteration, maxIterations, magnitude);

          const offset = ((y - startY) * width + x) * 4;
          buf[offset]     = red;
          buf[offset + 1] = green;
          buf[offset + 2] = blue;
          buf[offset + 3] = 255;
        }
      }

      self.postMessage({ startY, buf }, [buf.buffer]);
    };
  `;

  function draw(canvas, view, subsampling = 1) {
    cleanup(); // Clear previous workers
    
    fitCanvasToDisplay(canvas);
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    const zoomLevel = Math.max(1, -Math.log10(view.scale / 3.05));
    const maxIterations = Math.floor(150 + zoomLevel * 180);

    const numWorkers = navigator.hardwareConcurrency || 4;
    const rowsPerWorker = Math.ceil(height / numWorkers);
    const image = ctx.createImageData(width, height);

    const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
    workerUrl = URL.createObjectURL(blob);

    let completed = 0;

    for (let i = 0; i < numWorkers; i++) {
      const startY = i * rowsPerWorker;
      const endY = Math.min(startY + rowsPerWorker, height);
      if (startY >= height) break;

      const worker = new Worker(workerUrl);
      activeWorkers.push(worker);

      worker.postMessage({ startY, endY, width, height, view, maxIterations });

      worker.onmessage = function(e) {
        const { startY, buf } = e.data;
        image.data.set(buf, startY * width * 4);

        completed += 1;
        if (completed === numWorkers) {
          URL.revokeObjectURL(workerUrl);
          workerUrl = null;
          ctx.putImageData(image, 0, 0);
          activeWorkers = []; // All done
        }
      };
    }
  }

  function pointToComplex(canvas, view, event) {
    const rect = canvas.getBoundingClientRect();
    const aspect = canvas.width / canvas.height;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    return {
      x: view.centerX + (x - 0.5) * view.scale * aspect,
      y: view.centerY + (y - 0.5) * view.scale,
    };
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Mandelbrot: {
      defaultView: DEFAULT_VIEW,
      draw,
      cleanup,
      pointToComplex,
      formula: "zₙ₊₁ = zₙ² + c",
      // explanationUrl: "explanations/mandelbrot.html",
    },
  };
})(window);
