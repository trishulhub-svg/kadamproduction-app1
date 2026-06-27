// src/components/settings/SettingsView.tsx
"use client";
import { useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { setLogo, removeLogo, setScanEnabled, saveSmtpSettings, testSmtpSettings } from "@/server/settings-actions";
import { Upload, Trash2, ScanLine, Mail, Send } from "lucide-react";

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

type SmtpData = { host: string; port: string; user: string; pass: string; from: string };

export function SettingsView({ logoUrl, scanEnabled, smtp }: { logoUrl: string | null; scanEnabled: boolean; smtp: SmtpData }) {
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanOn, setScanOn] = useState(scanEnabled);

  const [smtpData, setSmtpData] = useState<SmtpData>(smtp);
  const [smtpPending, setSmtpPending] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testPending, setTestPending] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) { setError("Only image files are allowed."); return; }
    try {
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

  async function saveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setSmtpPending(true);
    setSmtpMsg(null);
    try {
      await saveSmtpSettings(smtpData);
      setSmtpMsg("SMTP settings saved.");
    } catch (err) {
      setSmtpMsg(`Error: ${(err as Error).message}`);
    }
    setSmtpPending(false);
  }

  async function sendTest() {
    if (!testEmail.trim()) return;
    setTestPending(true);
    try {
      await testSmtpSettings(testEmail.trim());
      setSmtpMsg("Test email sent!");
    } catch (err) {
      setSmtpMsg(`Error: ${(err as Error).message}`);
    }
    setTestPending(false);
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-gray-900">Admin Settings</h1>

      <Card className="max-w-lg p-5">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Company Logo</h3>
        <p className="mb-4 text-xs text-gray-500">Shown in sidebar, invoices, PWA. Use a square image under ~220KB.</p>
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {preview ? (
              <img src={preview} alt="logo preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-gray-400">No logo</span>
            )}
          </div>
          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-kp-primary px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
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
      </Card>

      <Card className="mt-4 max-w-lg p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <ScanLine className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Scan Item Visibility</h3>
              <p className="text-xs text-gray-500">Toggle Scan for all employee dashboards.</p>
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

      <Card className="mt-4 max-w-lg p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/20">
            <Mail className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700">SMTP / Email Settings</h3>
            <p className="text-xs text-gray-500">Configure outgoing email for notifications, welcome emails, etc.</p>
          </div>
        </div>
        <form onSubmit={saveSmtp} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>SMTP Host</Label><Input placeholder="smtp.gmail.com" value={smtpData.host} onChange={(e) => setSmtpData((s) => ({ ...s, host: e.target.value }))} /></div>
            <div><Label>Port</Label><Input placeholder="587" value={smtpData.port} onChange={(e) => setSmtpData((s) => ({ ...s, port: e.target.value }))} /></div>
          </div>
          <div><Label>SMTP Username</Label><Input placeholder="user@example.com" value={smtpData.user} onChange={(e) => setSmtpData((s) => ({ ...s, user: e.target.value }))} /></div>
          <div><Label>SMTP Password</Label><Input type="password" placeholder="••••••••" value={smtpData.pass} onChange={(e) => setSmtpData((s) => ({ ...s, pass: e.target.value }))} /></div>
          <div><Label>From Email</Label><Input placeholder="noreply@kadamproduction.in" value={smtpData.from} onChange={(e) => setSmtpData((s) => ({ ...s, from: e.target.value }))} /></div>
          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={smtpPending}>{smtpPending ? "Saving…" : "Save SMTP"}</Button>
          </div>
        </form>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <Label>Send Test Email</Label>
          <div className="mt-1 flex gap-2">
            <Input placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="flex-1" />
            <Button variant="success" onClick={sendTest} disabled={testPending}><Send className="h-4 w-4" /> {testPending ? "Sending…" : "Test"}</Button>
          </div>
        </div>
        {smtpMsg && <p className={`mt-2 text-sm ${smtpMsg.startsWith("Error") ? "text-kp-danger" : "text-kp-success"}`}>{smtpMsg}</p>}
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
