import * as pdfjsLib from "pdfjs-dist";
// Vite-compatible worker URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export { pdfjsLib };
