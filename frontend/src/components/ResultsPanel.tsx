/**
 * ResultsPanel component — displays the product counting results
 * returned by the VLM analysis, including per-shelf breakdowns,
 * product inventory table, confidence indicators, and estimated counts.
 */

"use client";

import {
  Package,
  Eye,
  EyeOff,
  BarChart3,
  ShieldCheck,
  Layers,
  ShoppingCart,
} from "lucide-react";
import type { ShelfAnalysis } from "@/types/analysis";

interface ResultsPanelProps {
  analysis: ShelfAnalysis;
}

/** Maps confidence levels to colors and labels */
const CONFIDENCE_STYLES = {
  high: { bg: "bg-green-100", text: "text-green-700", label: "High" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Medium" },
  low: { bg: "bg-red-100", text: "text-red-700", label: "Low" },
};

export default function ResultsPanel({ analysis }: ResultsPanelProps) {
  const conf = CONFIDENCE_STYLES[analysis.confidence];

  return (
    <div className="space-y-4">
      {/* Main count cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<Eye className="w-5 h-5 text-blue-600" />}
          label="Visible Products"
          value={analysis.total_visible_count}
          accent="blue"
        />
        <StatCard
          icon={<EyeOff className="w-5 h-5 text-amber-600" />}
          label="Est. Hidden"
          value={analysis.estimated_hidden_count}
          accent="amber"
        />
        <StatCard
          icon={<Package className="w-5 h-5 text-indigo-600" />}
          label="Est. Total"
          value={analysis.estimated_total_count}
          accent="indigo"
        />
      </div>

      {/* Confidence badge */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600">Confidence:</span>
        <span
          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${conf.bg} ${conf.text}`}
        >
          {conf.label}
        </span>
      </div>

      {/* Product Inventory table */}
      {analysis.products && analysis.products.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700">
                Product Inventory
              </h3>
            </div>
            <span className="text-xs text-gray-400">
              {analysis.products.length} product{analysis.products.length > 1 ? "s" : ""} identified
            </span>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_60px_100px] px-4 py-2 bg-gray-50/50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <span>Product</span>
            <span className="text-right">Count</span>
            <span className="text-right">Shelves</span>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto">
            {analysis.products.map((product, idx) => (
              <div
                key={`${product.name}-${idx}`}
                className="grid grid-cols-[1fr_60px_100px] px-4 py-2.5 items-center hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm text-gray-800 truncate pr-2" title={product.name}>
                  {product.name}
                </span>
                <span className="text-sm font-bold text-gray-900 text-right">
                  {product.count}
                </span>
                <span className="text-xs text-gray-500 text-right">
                  {product.shelf_numbers.length > 0
                    ? product.shelf_numbers.map((n) => `#${n}`).join(", ")
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-shelf breakdown */}
      {analysis.shelves.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
            <Layers className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">
              Per-Shelf Breakdown
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {analysis.shelves.map((shelf) => (
              <div
                key={shelf.shelf_number}
                className="px-4 py-3 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    Shelf {shelf.shelf_number}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {shelf.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-bold text-gray-800">
                    {shelf.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {analysis.notes && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">AI Notes</p>
          <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
            {analysis.notes}
          </p>
        </div>
      )}
    </div>
  );
}

/** Static style map for stat card accent colors */
const STAT_STYLES: Record<string, string> = {
  blue: "border-blue-200 bg-blue-50/50",
  amber: "border-amber-200 bg-amber-50/50",
  indigo: "border-indigo-200 bg-indigo-50/50",
};

/**
 * StatCard — single metric display card.
 * @param icon - Lucide icon element
 * @param label - Metric label text
 * @param value - Numeric value to display
 * @param accent - Color accent key (blue, amber, indigo)
 */
function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  const style = STAT_STYLES[accent] ?? STAT_STYLES.blue;

  return (
    <div className={`rounded-xl border px-4 py-4 flex flex-col gap-1 ${style}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
