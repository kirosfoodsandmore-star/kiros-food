// Multipart parsing. Always memory storage (files never touch the server disk) — buffers go
// straight to StorageService. MIME type and size are enforced before the controller runs.
import type { Request } from "express";
import multer, { type FileFilterCallback } from "multer";
import { AppError } from "../errors/AppError";

const memoryStorage = multer.memoryStorage();

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];

function filterFor(allowed: string[], label: string) {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(`Only ${label} files are allowed`, 422));
  };
}

/** Tags the handler with its multipart field name (lets route tooling see which routes take files). */
const marker = <T extends object>(fn: T, field: string, multiple = false) => Object.assign(fn, { __upload: { field, multiple } });

/** One image (item photo, category image, logo). */
export function uploadImage(field: string, maxMb = 5) {
  return marker(
    multer({
      storage: memoryStorage,
      limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
      fileFilter: filterFor(IMAGE_TYPES, "JPEG, PNG, WebP or GIF image"),
    }).single(field),
    field
  );
}

/** Up to `maxFiles` images in one request (item photo gallery). Each is capped at `maxMb`. */
export function uploadImages(field: string, maxFiles: number, maxMb = 5) {
  return marker(
    multer({
      storage: memoryStorage,
      limits: { fileSize: maxMb * 1024 * 1024, files: maxFiles },
      fileFilter: filterFor(IMAGE_TYPES, "JPEG, PNG, WebP or GIF image"),
    }).array(field, maxFiles),
    field,
    true
  );
}

/** One receipt / proof — image or PDF. */
export function uploadDocument(field: string, maxMb = 10) {
  return marker(
    multer({
      storage: memoryStorage,
      limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
      fileFilter: filterFor(DOCUMENT_TYPES, "image or PDF"),
    }).single(field),
    field
  );
}

export function requireFile(req: Request): Express.Multer.File {
  if (!req.file) throw AppError.unprocessable("A file is required", [{ field: "file", message: "Attach a file" }]);
  return req.file;
}

export function requireFiles(req: Request): Express.Multer.File[] {
  const files = Array.isArray(req.files) ? req.files : [];
  if (files.length === 0) throw AppError.unprocessable("At least one file is required", [{ field: "file", message: "Attach at least one photo" }]);
  return files;
}

export function optionalFile(req: Request): Express.Multer.File | null {
  return req.file ?? null;
}
