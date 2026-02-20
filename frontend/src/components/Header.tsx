/**
 * Header component — app title bar with branding and description.
 */

import { ScanLine } from "lucide-react";

export default function Header() {
  return (
    <header className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-3">
        <ScanLine className="w-8 h-8 flex-shrink-0" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Shelf Inventory Counter
          </h1>
          <p className="text-blue-100 text-sm mt-0.5">
            Upload a shelf photo → AI counts every product
          </p>
        </div>
      </div>
    </header>
  );
}
