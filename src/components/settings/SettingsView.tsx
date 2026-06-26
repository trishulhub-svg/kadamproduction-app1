// src/components/settings/SettingsView.tsx  (Improvement #3: attach logo)
"use client";
import { useState } from "react";
import { Button, Card, Label } from "@/components/ui";
import { setLogo, removeLogo, setScanEnabled } from "@/server/settings-actions";
import { Upload, Trash2, ScanLine } from "lucide-react";

/** Downscale an image file to a square-ish max dimension and return a PNG data URL (preserves transparency). */
function resizeImage(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Cannot process image."));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Could not read image file."));
    img.src = url;
  });
}

export function SettingsView({ logoUrl, scanEnabled }: { logoUrl: string | null; scanEnabled: boolean }) {
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanOn, setScanOn] = useState(scanEnabled);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) { setError("Only image files are allowed."); return; }
    try {
      // Resize client-side so the stored data URL stays small (prevents large-payload render crashes on Vercel)
      const dataUrl = await resizeImage(file, 256);
      setPreview(dataUrl);
      setPending(true);
      try { await setLogo(dataUrl); } catch (err) { setError((err as Error).message); setPreview(logoUrl); } finally { setPending(false); }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!confirm("Remove the logo?")) return;
    setPending(true);
    await removeLogo();
    setPreview(null);
    setPending(false);
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-gray-900">Admin Settings</h1>
      <Card className="max-w-lg p-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Company Logo</h3>
        <p className="mb-4 text-xs text-gray-500">Shown in the sidebar and on invoices. Use a square image under ~220KB.</p>

        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="logo preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-gray-400">No logo</span>
            )}
          </div>
          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-kp-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Upload className="h-4 w-4" /> {pending ? "Uploading…" : "Upload Logo"}
              <input type="file" accept="image/*" onChange={onFile} className="hidden" disabled={pending} />
            </label>
            {preview && (
              <button onClick={remove} disabled={pending} className="flex items-center gap-1 text-sm text-kp-danger hover:underline disabled:opacity-50">
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            )}
          </div>
        </div>
        {error && <p className="text-sm text-kp-danger">{error}</p>}
        <p className="text-xs text-gray-400">Logo is stored securely in the database and used across the app.</p>
      </Card>

      {/* Scan Item toggle */}
      <Card className="mt-4 max-w-lg p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <ScanLine className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Scan Item Visibility</h3>
              <p className="text-xs text-gray-500">Toggle the Scan feature for all employee dashboards.</p>
            </div>
          </div>
          <ToggleSwitch
            checked={scanOn}
            onChange={async (v) => {
              setScanOn(v);
              try { await setScanEnabled(v); } catch (e) { setScanOn(!v); alert((e as Error).message); }
            }}
          />
        </div>
      </Card>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${checked ? "bg-kp-success" : "bg-gray-300"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}
