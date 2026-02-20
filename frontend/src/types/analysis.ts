/**
 * TypeScript types matching the FastAPI backend response shape.
 */

export interface ProductEntry {
  name: string;
  count: number;
  shelf_numbers: number[];
}

export interface ShelfAnalysis {
  total_visible_count: number;
  shelves: {
    shelf_number: number;
    count: number;
    description: string;
  }[];
  products: ProductEntry[];
  estimated_hidden_count: number;
  estimated_total_count: number;
  confidence: "low" | "medium" | "high";
  notes: string;
}
