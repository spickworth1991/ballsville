"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/admin/AdminNav";
import { DEFAULT_HOME_PROMOTION } from "@/components/HomePromotion";
import { getSupabase } from "@/lib/supabaseClient";

const toText = (items) => (items || []).join("\n");
const toItems = (text) => text.split("\n").map((item) => item.trim()).filter(Boolean);

export default function HomePromotionAdminPage() {
  return <AdminGuard><Editor /></AdminGuard>;
}

function Editor() {
  const [form, setForm] = useState(DEFAULT_HOME_PROMOTION);
  const [image, setImage] = useState(null);
  const [state, setState] = useState({ loading: true, saving: false, error: "", ok: "" });
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  async function authToken() {
    const { data } = await getSupabase().auth.getSession();
    return data?.session?.access_token || "";
  }

  async function load() {
    setState({ loading: true, saving: false, error: "", ok: "" });
    try {
      const token = await authToken();
      const res = await fetch("/api/admin/home-promotion", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Load failed (${res.status})`);
      setForm({ ...DEFAULT_HOME_PROMOTION, ...(data.data || {}) });
      setState({ loading: false, saving: false, error: "", ok: "" });
    } catch (error) {
      setState({ loading: false, saving: false, error: error.message, ok: "" });
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setState({ loading: false, saving: true, error: "", ok: "" });
    try {
      const token = await authToken();
      let imageKey = form.imageKey;
      if (image) {
        const body = new FormData();
        body.append("file", image);
        body.append("section", "homepage-promotion");
        body.append("season", String(new Date().getFullYear()));
        const res = await fetch("/api/admin/upload", { method: "POST", headers: { authorization: `Bearer ${token}` }, body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || "Image upload failed");
        imageKey = data.key;
      }
      const res = await fetch("/api/admin/home-promotion", { method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ ...form, imageKey }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");
      setForm({ ...DEFAULT_HOME_PROMOTION, ...data.data });
      setImage(null);
      setState({ loading: false, saving: false, error: "", ok: "Homepage promotion saved and published." });
    } catch (error) {
      setState({ loading: false, saving: false, error: error.message, ok: "" });
    }
  }

  const field = (label, name) => <label className="grid gap-2 text-sm">{label}<input className="input" value={form[name]} onChange={(event) => update(name, event.target.value)} /></label>;

  return (
    <main className="section"><div className="container-site max-w-5xl space-y-6">
      <AdminNav eyebrow="Admin · Homepage" title="Homepage Promotion" description="Update the giveaway card between the homepage hero and Games Offered." publicHref="/" publicLabel="View Homepage" rightExtra={<button className="btn btn-primary" onClick={save} disabled={state.saving || state.loading}>{state.saving ? "Saving..." : "Save & Publish"}</button>} />
      {state.error ? <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm">{state.error}</div> : null}
      {state.ok ? <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm">{state.ok}</div> : null}
      {state.loading ? <div className="card p-6">Loading...</div> : <section className="card space-y-5 border border-subtle bg-card-surface p-6">
        <label className="flex items-center gap-3"><input type="checkbox" checked={form.enabled} onChange={(event) => update("enabled", event.target.checked)} /> Show promotion on homepage</label>
        <div className="grid gap-4 md:grid-cols-2">{field("Eyebrow", "eyebrow")}{field("Headline", "title")}</div>
        <label className="grid gap-2 text-sm">Description<textarea className="input min-h-24" value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
        <div className="grid gap-4 md:grid-cols-2">
          {field("Drawing date", "drawingDate")}{field("Drawing time / location", "drawingTime")}
          <label className="grid gap-2 text-sm">Benefits — one per line<textarea className="input min-h-40" value={toText(form.benefits)} onChange={(event) => update("benefits", toItems(event.target.value))} /></label>
          <label className="grid gap-2 text-sm">Entry steps — one per line<textarea className="input min-h-40" value={toText(form.entrySteps)} onChange={(event) => update("entrySteps", toItems(event.target.value))} /></label>
          {field("Button label", "actionLabel")}{field("Button URL", "actionUrl")}
        </div>
        <div className="rounded-xl border border-subtle p-4"><label className="grid gap-2 text-sm">Replace promotion artwork<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={(event) => setImage(event.target.files?.[0] || null)} /></label><p className="mt-2 text-xs text-muted">Leave empty to keep the current artwork.</p></div>
      </section>}
    </div></main>
  );
}
