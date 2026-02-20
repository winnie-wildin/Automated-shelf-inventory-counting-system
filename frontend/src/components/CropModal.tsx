/**
 * CropModal — full-screen modal with two crop modes:
 *  1. Freehand lasso: draw any shape, crops to its bounding box
 *  2. Rectangle: click-drag a box
 * Switching between modes via toggle buttons in the header.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Check, X, RotateCcw, Pen, Square } from "lucide-react";

type Mode = "freehand" | "rect";

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropModalProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export default function CropModal({
  imageSrc,
  onConfirm,
  onCancel,
}: CropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });

  const [mode, setMode] = useState<Mode>("freehand");
  const [drawing, setDrawing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Freehand state
  const [path, setPath] = useState<Point[]>([]);
  const pathRef = useRef<Point[]>([]);

  // Rect state
  const [rectSel, setRectSel] = useState<Rect | null>(null);
  const rectStartRef = useRef<Point>({ x: 0, y: 0 });

  // The final bounding box (computed from either mode)
  const [bbox, setBbox] = useState<Rect | null>(null);

  /** Load image */
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  /** Redraw canvas whenever anything changes */
  useEffect(() => {
    if (!imgRef.current || !loaded) return;
    draw();
  });

  /** Resize handler */
  useEffect(() => {
    const onResize = () => {
      if (imgRef.current) draw();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;
    if (!canvas || !container || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    // Fit image
    const scale = Math.min(cw / img.width, ch / img.height) * 0.95;
    const dw = img.width * scale;
    const dh = img.height * scale;
    const ox = (cw - dw) / 2;
    const oy = (ch - dh) / 2;
    scaleRef.current = scale;
    offsetRef.current = { x: ox, y: oy };

    // Background
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, ox, oy, dw, dh);

    const currentBbox = bbox;
    const currentPath = path;

    const isFreehandDone =
      mode === "freehand" && !drawing && currentPath.length > 2;

    // --- Freehand mode: use the drawn path as the visible mask ---
    if (isFreehandDone && currentBbox) {
      // Dim entire image
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, cw, ch);

      // Clip to the freehand path and redraw image inside
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(
        ox + currentPath[0].x * scale,
        oy + currentPath[0].y * scale
      );
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(
          ox + currentPath[i].x * scale,
          oy + currentPath[i].y * scale
        );
      }
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, ox, oy, dw, dh);
      ctx.restore();

      // Draw the path outline
      ctx.beginPath();
      ctx.moveTo(
        ox + currentPath[0].x * scale,
        oy + currentPath[0].y * scale
      );
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(
          ox + currentPath[i].x * scale,
          oy + currentPath[i].y * scale
        );
      }
      ctx.closePath();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // --- Rectangle mode: show bbox ---
    else if (
      mode === "rect" &&
      currentBbox &&
      currentBbox.w > 0 &&
      currentBbox.h > 0
    ) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, cw, ch);

      const bx = ox + currentBbox.x * scale;
      const by = oy + currentBbox.y * scale;
      const bw = currentBbox.w * scale;
      const bh = currentBbox.h * scale;

      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      ctx.drawImage(img, ox, oy, dw, dh);
      ctx.restore();

      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      // Dimension label
      const label = `${Math.round(currentBbox.w)} × ${Math.round(currentBbox.h)}px`;
      ctx.font = "12px system-ui, sans-serif";
      const metrics = ctx.measureText(label);
      const lx = bx + bw / 2 - metrics.width / 2 - 4;
      const ly = by - 10;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(lx, ly - 12, metrics.width + 8, 18);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, lx + 4, ly + 2);
    }

    // Draw freehand path while still drawing (live feedback)
    if (drawing && currentPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(
        ox + currentPath[0].x * scale,
        oy + currentPath[0].y * scale
      );
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(
          ox + currentPath[i].x * scale,
          oy + currentPath[i].y * scale
        );
      }
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }, [bbox, path, drawing, loaded, mode]);

  /** Convert canvas coords to image coords */
  const toImg = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      return {
        x: (cx - offsetRef.current.x) / scaleRef.current,
        y: (cy - offsetRef.current.y) / scaleRef.current,
      };
    },
    []
  );

  /** Compute bounding box from a list of points */
  const bboxFromPoints = useCallback((pts: Point[]): Rect | null => {
    if (pts.length < 3) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, []);

  // ---- Mouse handlers ----

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const p = toImg(e);
      setDrawing(true);

      if (mode === "freehand") {
        pathRef.current = [p];
        setPath([p]);
        setBbox(null);
      } else {
        rectStartRef.current = p;
        setRectSel(null);
        setBbox(null);
        setPath([]);
      }
    },
    [mode, toImg]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawing) return;
      const p = toImg(e);

      if (mode === "freehand") {
        pathRef.current.push(p);
        setPath([...pathRef.current]);
      } else {
        const s = rectStartRef.current;
        const x = Math.min(s.x, p.x);
        const y = Math.min(s.y, p.y);
        const w = Math.abs(p.x - s.x);
        const h = Math.abs(p.y - s.y);
        setRectSel({ x, y, w, h });
        setBbox({ x, y, w, h });
        setPath([]);
      }
    },
    [drawing, mode, toImg]
  );

  const handleMouseUp = useCallback(() => {
    if (!drawing) return;
    setDrawing(false);

    if (mode === "freehand") {
      const b = bboxFromPoints(pathRef.current);
      setBbox(b);
    }
  }, [drawing, mode, bboxFromPoints]);

  const handleReset = useCallback(() => {
    setPath([]);
    setRectSel(null);
    setBbox(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!bbox || !imgRef.current) return;
    setProcessing(true);

    try {
      const img = imgRef.current;
      const sx = Math.max(0, Math.round(bbox.x));
      const sy = Math.max(0, Math.round(bbox.y));
      const sw = Math.min(Math.round(bbox.w), img.width - sx);
      const sh = Math.min(Math.round(bbox.h), img.height - sy);

      if (sw < 10 || sh < 10) {
        alert("Selection too small. Please draw a larger area.");
        setProcessing(false);
        return;
      }

      const c = document.createElement("canvas");
      c.width = sw;
      c.height = sh;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("no ctx");

      // In freehand mode, use the drawn path as a clip mask
      // so only pixels inside the shape are kept
      if (mode === "freehand" && pathRef.current.length > 2) {
        // Black background for outside
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, sw, sh);

        // Build clip path (shifted by bbox origin)
        ctx.save();
        ctx.beginPath();
        const pts = pathRef.current;
        ctx.moveTo(pts[0].x - sx, pts[0].y - sy);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x - sx, pts[i].y - sy);
        }
        ctx.closePath();
        ctx.clip();

        // Draw image inside the clipped region only
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        ctx.restore();
      } else {
        // Rectangle mode: straight crop
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      }

      const blob = await new Promise<Blob>((resolve, reject) =>
        c.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          0.92
        )
      );
      onConfirm(blob);
    } catch {
      onCancel();
    }
  }, [bbox, mode, onConfirm, onCancel]);

  const hasSel = bbox && bbox.w > 5 && bbox.h > 5;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/90 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Crop Image</h3>

          {/* Mode toggle */}
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => {
                setMode("freehand");
                handleReset();
              }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-colors cursor-pointer ${
                mode === "freehand"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Pen className="w-3 h-3" />
              Freehand
            </button>
            <button
              onClick={() => {
                setMode("rect");
                handleReset();
              }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-md transition-colors cursor-pointer ${
                mode === "rect"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Square className="w-3 h-3" />
              Rectangle
            </button>
          </div>

          <span className="text-xs text-gray-400">
            {mode === "freehand"
              ? "Draw around the area you want to keep"
              : "Click and drag a rectangle"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!hasSel && path.length === 0}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white disabled:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing || !hasSel}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400/50 px-4 py-1.5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            {processing ? "Cropping..." : "Apply Crop"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="absolute inset-0 cursor-crosshair"
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-400">Loading image...</p>
          </div>
        )}
      </div>
    </div>
  );
}
