"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_CANVAS_HEIGHT = 560;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 8;

type PreparedMap = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

type HeightMapViewerProps = {
  scanId: string | null;
  status: string;
  sourceFilename?: string | null;
  minZ?: number | null;
  maxZ?: number | null;
  widthMeters?: number | null;
  heightMeters?: number | null;
  hasHeightmap?: boolean;
  hasBoundary?: boolean;
};

type ViewState = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

const DEFAULT_VIEW: ViewState = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function heightToColor(t: number): [number, number, number] {
  const normalized = clamp(t, 0, 1);
  const stops = [
    { t: 0, color: [30, 64, 175] as const },
    { t: 0.35, color: [16, 185, 129] as const },
    { t: 0.7, color: [234, 179, 8] as const },
    { t: 1, color: [220, 38, 38] as const },
  ];

  for (let index = 0; index < stops.length - 1; index += 1) {
    const start = stops[index];
    const end = stops[index + 1];

    if (normalized <= end.t) {
      const localT = (normalized - start.t) / (end.t - start.t);
      return [
        Math.round(lerp(start.color[0], end.color[0], localT)),
        Math.round(lerp(start.color[1], end.color[1], localT)),
        Math.round(lerp(start.color[2], end.color[2], localT)),
      ];
    }
  }

  return [...stops[stops.length - 1].color];
}

function formatMeters(value?: number | null) {
  if (typeof value !== "number") {
    return null;
  }

  return `${value.toFixed(1)} m`;
}

function formatElevation(value?: number | null) {
  if (typeof value !== "number") {
    return null;
  }

  return `${value.toFixed(2)} m`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${src}`));
    image.src = src;
  });
}

function prepareMap(
  heightmapImage: HTMLImageElement,
  boundaryImage: HTMLImageElement,
): PreparedMap {
  const width = heightmapImage.naturalWidth || heightmapImage.width;
  const height = heightmapImage.naturalHeight || heightmapImage.height;

  const heightmapCanvas = document.createElement("canvas");
  heightmapCanvas.width = width;
  heightmapCanvas.height = height;
  const heightmapContext = heightmapCanvas.getContext("2d");

  const boundaryCanvas = document.createElement("canvas");
  boundaryCanvas.width = width;
  boundaryCanvas.height = height;
  const boundaryContext = boundaryCanvas.getContext("2d");

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputContext = outputCanvas.getContext("2d");

  if (!heightmapContext || !boundaryContext || !outputContext) {
    throw new Error("Unable to prepare map canvas");
  }

  heightmapContext.drawImage(heightmapImage, 0, 0, width, height);
  boundaryContext.drawImage(boundaryImage, 0, 0, width, height);

  const heightmapData = heightmapContext.getImageData(0, 0, width, height);
  const boundaryData = boundaryContext.getImageData(0, 0, width, height);
  const outputData = outputContext.createImageData(width, height);

  for (let index = 0; index < heightmapData.data.length; index += 4) {
    const heightValue = heightmapData.data[index] / 255;
    const [red, green, blue] = heightToColor(heightValue);
    // `boundary.png` is baked as opaque grayscale, so the RGB channels carry the mask.
    const mask = Math.max(
      boundaryData.data[index],
      boundaryData.data[index + 1],
      boundaryData.data[index + 2],
    );

    const insideBoundary = mask > 12;
    const tint = insideBoundary ? 1 : 0.4;

    outputData.data[index] = Math.round(red * tint);
    outputData.data[index + 1] = Math.round(green * tint);
    outputData.data[index + 2] = Math.round(blue * tint);
    outputData.data[index + 3] = insideBoundary ? 255 : 40;
  }

  outputContext.putImageData(outputData, 0, 0);

  return { canvas: outputCanvas, width, height };
}

function getFitScale(map: PreparedMap | null, width: number, height: number) {
  if (!map || width === 0 || height === 0) {
    return 1;
  }

  return Math.min(width / map.width, height / map.height) * 0.92;
}

export function HeightMapViewer({
  scanId,
  status,
  sourceFilename,
  minZ,
  maxZ,
  widthMeters,
  heightMeters,
  hasHeightmap,
  hasBoundary,
}: HeightMapViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(
    null,
  );
  const [frameSize, setFrameSize] = useState({
    width: 0,
    height: DEFAULT_CANVAS_HEIGHT,
  });
  const [map, setMap] = useState<PreparedMap | null>(null);
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const footprint = useMemo(() => {
    const width = formatMeters(widthMeters);
    const height = formatMeters(heightMeters);

    if (!width || !height) {
      return null;
    }

    return `${width} x ${height}`;
  }, [heightMeters, widthMeters]);

  const elevationRange = useMemo(() => {
    const low = formatElevation(minZ);
    const high = formatElevation(maxZ);

    if (!low || !high) {
      return null;
    }

    return `${low} to ${high}`;
  }, [maxZ, minZ]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const updateSize = () => {
      setFrameSize({
        width: frame.clientWidth,
        height: frame.clientHeight || DEFAULT_CANVAS_HEIGHT,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    setMap(null);
    setView(DEFAULT_VIEW);
    setError(null);

    if (
      !scanId ||
      status !== "ready" ||
      !hasHeightmap ||
      !hasBoundary
    ) {
      setLoading(false);
      return;
    }

    setLoading(true);

    void Promise.all([
      loadImage(`/api/scans/${scanId}/assets/heightmap`),
      loadImage(`/api/scans/${scanId}/assets/boundary`),
    ])
      .then(([heightmapImage, boundaryImage]) => {
        if (cancelled) {
          return;
        }

        setMap(prepareMap(heightmapImage, boundaryImage));
      })
      .catch((caughtError: unknown) => {
        if (cancelled) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to load height map assets",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasBoundary, hasHeightmap, scanId, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const width = Math.max(frameSize.width, 1);
    const height = Math.max(frameSize.height, 1);
    const devicePixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * devicePixelRatio);
    canvas.height = Math.floor(height * devicePixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, width, height);

    if (!map) {
      return;
    }

    const fitScale = getFitScale(map, width, height);
    const scale = fitScale * view.zoom;

    context.save();
    context.translate(width / 2 + view.offsetX, height / 2 + view.offsetY);
    context.scale(scale, scale);
    context.imageSmoothingEnabled = true;
    context.drawImage(map.canvas, -map.width / 2, -map.height / 2);
    context.restore();
  }, [frameSize.height, frameSize.width, map, view]);

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!map || frameSize.width === 0 || frameSize.height === 0) {
      return;
    }

    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const fitScale = getFitScale(map, frameSize.width, frameSize.height);

    setView((currentView) => {
      const direction = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextZoom = clamp(currentView.zoom * direction, MIN_ZOOM, MAX_ZOOM);
      const oldScale = fitScale * currentView.zoom;
      const nextScale = fitScale * nextZoom;
      const worldX =
        (cursorX - frameSize.width / 2 - currentView.offsetX) / oldScale;
      const worldY =
        (cursorY - frameSize.height / 2 - currentView.offsetY) / oldScale;

      return {
        zoom: nextZoom,
        offsetX: cursorX - frameSize.width / 2 - worldX * nextScale,
        offsetY: cursorY - frameSize.height / 2 - worldY * nextScale,
      };
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!map) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;

    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };

    setView((currentView) => ({
      ...currentView,
      offsetX: currentView.offsetX + deltaX,
      offsetY: currentView.offsetY + deltaY,
    }));
  }

  function endPointerInteraction(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  let viewerMessage: string | null = null;
  if (!scanId) {
    viewerMessage = "Pick a scan version to view its garden map.";
  } else if (status === "processing") {
    viewerMessage = "This scan is still processing. Check back when it is ready.";
  } else if (status === "failed") {
    viewerMessage = "This scan failed during processing, so a height map is unavailable.";
  } else if (loading) {
    viewerMessage = "Loading height map assets...";
  } else if (error) {
    viewerMessage = error;
  } else if (!hasHeightmap || !hasBoundary) {
    viewerMessage = "This scan is missing one or more map assets.";
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-emerald-700">
            Garden map
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Height map viewer
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Drag to pan and use the mouse wheel to zoom into terrain detail.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView(DEFAULT_VIEW)}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Reset view
        </button>
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="font-medium text-slate-700">Scan file</dt>
          <dd className="mt-1 break-all">{sourceFilename ?? "Unavailable"}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="font-medium text-slate-700">Footprint</dt>
          <dd className="mt-1">{footprint ?? "Unavailable"}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="font-medium text-slate-700">Elevation range</dt>
          <dd className="mt-1">{elevationRange ?? "Unavailable"}</dd>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <dt className="font-medium text-slate-700">Status</dt>
          <dd className="mt-1 capitalize">{status}</dd>
        </div>
      </dl>

      <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
        <div
          ref={frameRef}
          className={`relative h-[560px] w-full touch-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerInteraction}
          onPointerCancel={endPointerInteraction}
          onPointerLeave={endPointerInteraction}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />

          {viewerMessage ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75 px-6 text-center">
              <p className="max-w-md text-sm font-medium leading-6 text-slate-700">
                {viewerMessage}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-slate-700">Elevation legend</p>
          <p className="mt-1">Lower elevations are cooler colors; higher elevations are warmer colors.</p>
        </div>
        <div className="w-full max-w-xs">
          <div
            className="h-3 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, rgb(30, 64, 175) 0%, rgb(16, 185, 129) 35%, rgb(234, 179, 8) 70%, rgb(220, 38, 38) 100%)",
            }}
          />
          <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </section>
  );
}
