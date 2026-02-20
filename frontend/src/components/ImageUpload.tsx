/**
 * ImageUpload component — drag-and-drop / click-to-upload area for shelf images.
 * Supports multiple images (multi-angle) with previews, cropping, and individual removal.
 */

"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, ImageIcon, X, Plus, Crop } from "lucide-react";
import CropModal from "./CropModal";

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface ImageEntry {
  file: File;
  preview: string;
}

interface ImageUploadProps {
  images: ImageEntry[];
  onImagesAdd: (entries: ImageEntry[]) => void;
  onImageRemove: (index: number) => void;
  /** Replaces the image at `index` with a new entry (used after cropping) */
  onImageReplace: (index: number, entry: ImageEntry) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function ImageUpload({
  images,
  onImagesAdd,
  onImageRemove,
  onImageReplace,
  onClear,
  disabled = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Validates files and creates preview URLs. */
  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) {
        alert(`Maximum ${MAX_IMAGES} images allowed.`);
        return;
      }

      const files = Array.from(fileList).slice(0, remaining);
      const entries: ImageEntry[] = [];

      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          alert(`"${file.name}" is not an image. Skipped.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          alert(`"${file.name}" exceeds 10MB. Skipped.`);
          continue;
        }
        entries.push({ file, preview: URL.createObjectURL(file) });
      }

      if (entries.length > 0) onImagesAdd(entries);
    },
    [images.length, onImagesAdd]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      processFiles(e.dataTransfer.files);
    },
    [processFiles, disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(e.target.files);
      e.target.value = "";
    },
    [processFiles]
  );

  /** Called when user confirms crop — replaces the image at cropIndex. */
  const handleCropConfirm = useCallback(
    (croppedBlob: Blob) => {
      if (cropIndex === null) return;
      const original = images[cropIndex];
      const croppedFile = new File(
        [croppedBlob],
        original?.file.name ?? "cropped.jpg",
        { type: "image/jpeg" }
      );
      // Revoke old preview URL
      if (original) URL.revokeObjectURL(original.preview);
      const newPreview = URL.createObjectURL(croppedBlob);
      onImageReplace(cropIndex, { file: croppedFile, preview: newPreview });
      setCropIndex(null);
    },
    [cropIndex, images, onImageReplace]
  );

  // Show uploaded image previews as a grid
  if (images.length > 0) {
    return (
      <>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {images.map((entry, idx) => (
              <div
                key={entry.preview}
                className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
              >
                <img
                  src={entry.preview}
                  alt={`Shelf angle ${idx + 1}`}
                  className="w-full h-40 object-cover"
                />
                {/* Angle label */}
                <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                  Angle {idx + 1}
                </span>

                {/* Action buttons (top-right) */}
                {!disabled && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button
                      onClick={() => setCropIndex(idx)}
                      className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors cursor-pointer"
                      aria-label={`Crop image ${idx + 1}`}
                      title="Crop"
                    >
                      <Crop className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onImageRemove(idx)}
                      className="bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors cursor-pointer"
                      aria-label={`Remove image ${idx + 1}`}
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Add more button */}
            {images.length < MAX_IMAGES && !disabled && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50/50 h-40 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-500">Add angle</span>
              </button>
            )}
          </div>

          {/* Info bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {images.length} image{images.length > 1 ? "s" : ""} ·{" "}
              {images.length > 1 ? "Multi-angle mode" : "Single image mode"}
            </p>
            {!disabled && (
              <button
                onClick={onClear}
                className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {/* Crop modal */}
        {cropIndex !== null && images[cropIndex] && (
          <CropModal
            imageSrc={images[cropIndex].preview}
            onConfirm={handleCropConfirm}
            onCancel={() => setCropIndex(null)}
          />
        )}
      </>
    );
  }

  // Show the upload drop zone (no images yet)
  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`
        relative rounded-xl border-2 border-dashed p-12
        flex flex-col items-center justify-center gap-4
        transition-all duration-200 cursor-pointer min-h-[300px]
        ${
          isDragging
            ? "border-blue-500 bg-blue-50 scale-[1.01]"
            : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"
        }
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
        {isDragging ? (
          <ImageIcon className="w-8 h-8 text-blue-600" />
        ) : (
          <Upload className="w-8 h-8 text-blue-600" />
        )}
      </div>

      <div className="text-center">
        <p className="text-lg font-medium text-gray-700">
          {isDragging ? "Drop your images here" : "Upload shelf images"}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Drag & drop or click · Up to {MAX_IMAGES} images · JPEG, PNG, WebP
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Upload multiple angles of the same shelf for better accuracy
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}
