/**
 * Main page — orchestrates the shelf inventory counting flow.
 * Supports two modes: Quick (fast, single image) and Thorough (detailed, multi-angle).
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { Loader2, ScanSearch, RotateCcw, ChevronDown, Zap, SearchCheck } from "lucide-react";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";
import type { ImageEntry } from "@/components/ImageUpload";
import ResultsPanel from "@/components/ResultsPanel";
import type { ShelfAnalysis } from "@/types/analysis";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type AppState = "idle" | "analyzing" | "done" | "error";
type AnalysisMode = "quick" | "thorough";

interface ModelOption {
  id: string;
  name: string;
  speed: string;
}

export default function Home() {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [state, setState] = useState<AppState>("idle");
  const [analysis, setAnalysis] = useState<ShelfAnalysis | null>(null);
  const [error, setError] = useState<string>("");

  // Mode toggle
  const [mode, setMode] = useState<AnalysisMode>("quick");

  // Model selection
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [modelUsed, setModelUsed] = useState<string>("");
  const [modeUsed, setModeUsed] = useState<AnalysisMode | "">("");

  useEffect(() => {
    fetch(`${API_URL}/api/models`)
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models || []);
        setSelectedModel(data.default || "");
      })
      .catch(() => {
        setModels([
          { id: "google/gemini-2.0-flash-001",      name: "Gemini 2.0 Flash",           speed: "fast" },
          { id: "qwen/qwen2.5-vl-3b-instruct",      name: "Qwen2.5-VL 3B Instruct",    speed: "fast" },
          { id: "opengvlab/internvl3-2b",            name: "InternVL3 2B",               speed: "fast" },
          { id: "qwen/qwen2.5-vl-32b-instruct",     name: "Qwen2.5-VL 32B Instruct",   speed: "medium" },
          { id: "qwen/qwen2.5-vl-72b-instruct",     name: "Qwen2.5-VL 72B Instruct",   speed: "medium" },
          { id: "opengvlab/internvl3-14b",           name: "InternVL3 14B",              speed: "medium" },
          { id: "google/gemini-2.5-flash-preview",   name: "Gemini 2.5 Flash Preview",   speed: "medium" },
          { id: "meta-llama/llama-4-maverick",       name: "Llama 4 Maverick",           speed: "medium" },
          { id: "moonshotai/kimi-vl-a3b-thinking",   name: "Kimi VL A3B (Thinking)",     speed: "medium" },
          { id: "qwen/qwen3-vl-30b-a3b-thinking",   name: "Qwen3-VL 30B Thinking (Recommended)", speed: "slow" },
          { id: "qwen/qwen3-vl-235b-a22b-thinking",  name: "Qwen3-VL 235B (Thinking)",  speed: "slow" },
        ]);
        setSelectedModel("qwen/qwen2.5-vl-72b-instruct");
      });
  }, []);

  const handleImagesAdd = useCallback((entries: ImageEntry[]) => {
    setImages((prev) => [...prev, ...entries]);
    setAnalysis(null);
    setError("");
    setState("idle");
  }, []);

  const handleImageRemove = useCallback((index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
    setAnalysis(null);
    setState("idle");
  }, []);

  const handleImageReplace = useCallback(
    (index: number, entry: ImageEntry) => {
      setImages((prev) => prev.map((img, i) => (i === index ? entry : img)));
      setAnalysis(null);
      setState("idle");
    },
    []
  );

  const handleClear = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setAnalysis(null);
    setError("");
    setState("idle");
  }, [images]);

  const handleAnalyze = useCallback(async () => {
    if (images.length === 0) return;

    setState("analyzing");
    setError("");
    setAnalysis(null);
    setModelUsed("");
    setModeUsed(mode);

    try {
      const formData = new FormData();
      images.forEach((entry) => formData.append("images", entry.file));
      if (selectedModel) formData.append("model", selectedModel);
      formData.append("mode", mode);

      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Analysis failed");
      }

      setAnalysis(data.analysis);
      setModelUsed(data.model_used || "");
      setModeUsed(data.mode || mode);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }, [images, selectedModel, mode]);

  const modelLabel = models.find((m) => m.id === modelUsed)?.name || modelUsed;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="mb-5 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700">
          <span className="shrink-0 mt-0.5">💡</span>
          <span>
            <strong>Tip:</strong> Crop your images to just the shelf area for better accuracy.
            For best results, use <strong>Qwen3-VL 30B (Thinking)</strong> in Thorough mode.
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left column: Image upload + controls */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Shelf Images
            </h2>
            <ImageUpload
              images={images}
              onImagesAdd={handleImagesAdd}
              onImageRemove={handleImageRemove}
              onImageReplace={handleImageReplace}
              onClear={handleClear}
              disabled={state === "analyzing"}
            />

            {images.length > 0 && (
              <div className="mt-4 space-y-3">
                {/* Mode toggle */}
                <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                  <ModeButton
                    active={mode === "quick"}
                    onClick={() => setMode("quick")}
                    disabled={state === "analyzing"}
                    icon={<Zap className="w-4 h-4" />}
                    label="Quick"
                    desc="Fast count, single image"
                  />
                  <ModeButton
                    active={mode === "thorough"}
                    onClick={() => setMode("thorough")}
                    disabled={state === "analyzing"}
                    icon={<SearchCheck className="w-4 h-4" />}
                    label="Thorough"
                    desc="Detailed, multi-angle"
                    isLast
                  />
                </div>

                {/* Model selector */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="model-select"
                    className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0"
                  >
                    Model
                  </label>
                  <div className="relative flex-1">
                    <select
                      id="model-select"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={state === "analyzing"}
                      className="w-full appearance-none bg-white border border-gray-200 rounded-lg text-sm text-gray-700 py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.speed === "fast" ? "⚡" : m.speed === "slow" ? "🐢" : "⚙️"} {m.name} — {m.speed}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Analyze button */}
                <div className="flex gap-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={state === "analyzing"}
                    className={`flex-1 flex items-center justify-center gap-2 text-white font-medium py-3 px-5 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed ${
                      mode === "quick"
                        ? "bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300"
                        : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
                    }`}
                  >
                    {state === "analyzing" ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {mode === "quick" ? "Quick scan..." : `Analyzing ${images.length} image${images.length > 1 ? "s" : ""}...`}
                      </>
                    ) : (
                      <>
                        {mode === "quick" ? <Zap className="w-5 h-5" /> : <ScanSearch className="w-5 h-5" />}
                        {mode === "quick" ? "Quick Count" : "Count Products"}
                      </>
                    )}
                  </button>

                  {state === "done" && (
                    <button
                      onClick={handleAnalyze}
                      className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors cursor-pointer"
                      title="Re-analyze"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Right column: Results */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Results
            </h2>

            {state === "idle" && !analysis && (
              <EmptyState message="Upload shelf images and click 'Count Products' to start. Use Quick mode for fast results or Thorough for detailed multi-angle analysis." />
            )}

            {state === "analyzing" && <AnalyzingState count={images.length} mode={mode} />}

            {state === "error" && <ErrorState message={error} />}

            {state === "done" && analysis && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  {modeUsed && (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      modeUsed === "quick"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {modeUsed === "quick" ? <Zap className="w-3 h-3" /> : <SearchCheck className="w-3 h-3" />}
                      {modeUsed === "quick" ? "Quick" : "Thorough"}
                    </span>
                  )}
                  {modelUsed && (
                    <p className="text-xs text-gray-400">
                      via <span className="font-medium text-gray-500">{modelLabel}</span>
                    </p>
                  )}
                </div>
                <ResultsPanel analysis={analysis} />
              </>
            )}
          </section>
        </div>
      </main>

      <footer className="text-center text-xs text-gray-400 py-4">
        Powered by Vision Language Models via OpenRouter · Counts are AI-generated estimates
      </footer>
    </div>
  );
}

/* ── Mode toggle button ─────────────────────────────────────────── */

function ModeButton({
  active,
  onClick,
  disabled,
  icon,
  label,
  desc,
  isLast,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  desc: string;
  isLast?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex items-center gap-2.5 px-4 py-3 transition-colors cursor-pointer disabled:cursor-not-allowed ${
        !isLast ? "border-r border-gray-200" : ""
      } ${
        active
          ? label === "Quick"
            ? "bg-amber-50 text-amber-700"
            : "bg-blue-50 text-blue-700"
          : "bg-white text-gray-500 hover:bg-gray-50"
      }`}
    >
      <div className={`shrink-0 ${active ? "" : "opacity-50"}`}>{icon}</div>
      <div className="text-left">
        <div className="text-sm font-semibold leading-tight">{label}</div>
        <div className="text-[11px] leading-tight opacity-70">{desc}</div>
      </div>
    </button>
  );
}

/* ── Helper states ──────────────────────────────────────────────── */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
      <ScanSearch className="w-10 h-10 text-gray-300 mb-3" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

function AnalyzingState({ count, mode }: { count: number; mode: AnalysisMode }) {
  return (
    <div className={`rounded-xl border p-8 flex flex-col items-center justify-center text-center min-h-[200px] ${
      mode === "quick" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
    }`}>
      <Loader2 className={`w-10 h-10 animate-spin mb-3 ${
        mode === "quick" ? "text-amber-500" : "text-blue-500"
      }`} />
      <p className={`text-sm font-medium ${mode === "quick" ? "text-amber-700" : "text-blue-700"}`}>
        {mode === "quick" ? "Quick scan in progress..." : "Counting products..."}
      </p>
      <p className={`text-xs mt-1 ${mode === "quick" ? "text-amber-500" : "text-blue-500"}`}>
        {mode === "quick"
          ? "Fast analysis — results in a few seconds"
          : `Analyzing ${count} image${count > 1 ? "s" : ""} ${count > 1 ? "(cross-referencing angles)" : ""}. This may take 15–30s.`
        }
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <p className="text-sm font-medium text-red-700">Analysis failed</p>
      <p className="text-sm text-red-600 mt-1">{message}</p>
    </div>
  );
}
