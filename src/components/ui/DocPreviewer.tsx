import { useState } from "react";
import { Eye, FileText, Maximize2, X, Download } from "lucide-react";

export function DocPreviewer({
  title,
  docNumber,
  fileName,
  fileUrl,
  allowed,
}: {
  title: string;
  docNumber?: string | undefined;
  fileName?: string | undefined;
  fileUrl?: string | undefined;
  allowed?: boolean | undefined;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const isPdf =
    fileUrl?.startsWith("data:application/pdf") ||
    fileUrl?.endsWith(".pdf") ||
    fileName?.toLowerCase().endsWith(".pdf");

  const isImage =
    fileUrl?.startsWith("data:image") ||
    fileUrl?.match(/\.(png|jpe?g|webp|gif|svg)$/i) ||
    (fileName && !isPdf);

  return (
    <div className="w-full rounded-2xl border border-border bg-card/90 p-5 shadow-sm space-y-4">
      {/* Header with Document Title & Status */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <h4 className="text-base font-bold text-foreground">{title}</h4>
          {docNumber ? (
            <p className="mt-1 font-mono text-sm font-bold text-primary">
              <span className="text-xs font-semibold text-muted-foreground font-sans">No: </span>
              {docNumber}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">No Document Number Entered</p>
          )}
        </div>

        {allowed !== undefined && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              allowed ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {allowed ? "Unlocked & Permitted ✓" : "Restricted 🔒"}
          </span>
        )}
      </div>

      {/* File Details & Inline Preview */}
      {fileUrl ? (
        <div className="space-y-3">
          {fileName && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 truncate max-w-[240px]">
                <FileText className="size-3.5 text-primary shrink-0" />
                <span className="truncate font-medium text-foreground">{fileName}</span>
              </span>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              >
                <Maximize2 className="size-3" /> Expand
              </button>
            </div>
          )}

          {/* Inline Preview Container */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-950/80 p-2 shadow-inner">
            {isPdf ? (
              <div className="flex flex-col items-center">
                <iframe
                  src={fileUrl}
                  title={`${title} PDF Preview`}
                  className="h-64 w-full rounded-xl border border-slate-800 bg-white"
                />
              </div>
            ) : isImage ? (
              <div
                onClick={() => setModalOpen(true)}
                className="group relative flex max-h-64 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-900 cursor-pointer"
              >
                <img
                  src={fileUrl}
                  alt={`${title} copy`}
                  className="max-h-60 w-auto rounded-lg object-contain transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/90 px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-lg">
                    <Eye className="size-4" /> Click to Expand
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 text-xs">
                <span className="font-mono text-muted-foreground">{fileName || "Attached Document Copy"}</span>
                <a
                  href={fileUrl}
                  download={fileName || "document"}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-bold text-primary"
                >
                  <Download className="size-3.5" /> Download File
                </a>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          No copy attached for this document yet.
        </div>
      )}

      {/* Expand Modal Lightbox */}
      {modalOpen && fileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur-md">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold">{title}</h3>
                {docNumber && <p className="font-mono text-xs text-primary font-bold">{docNumber}</p>}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex size-10 items-center justify-center rounded-xl bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-auto rounded-2xl bg-slate-950/90 p-4 flex items-center justify-center">
              {isPdf ? (
                <iframe
                  src={fileUrl}
                  title={`${title} Full PDF`}
                  className="h-[65vh] w-full rounded-xl border border-slate-800 bg-white"
                />
              ) : (
                <img
                  src={fileUrl}
                  alt={title}
                  className="max-h-[65vh] w-auto rounded-xl object-contain shadow-2xl"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
