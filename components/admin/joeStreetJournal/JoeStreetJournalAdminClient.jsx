"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/admin/AdminNav";
import { getSupabase } from "@/lib/supabaseClient";

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const lines = (value) => (Array.isArray(value) ? value : []).join("\n");
const fromLines = (value) => str(value).split("\n").map((v) => v.trim()).filter(Boolean);

async function token() {
  const { data } = await getSupabase().auth.getSession();
  return data?.session?.access_token || "";
}

function Field({ label, value, onChange, area = false, hint = "" }) {
  const className = "mt-1 w-full rounded-xl border border-subtle bg-card-trans px-3 py-2 text-fg";
  return (
    <label className="block text-sm text-muted">
      {label}
      {area
        ? <textarea className={`${className} min-h-24`} value={str(value)} onChange={(e) => onChange(e.target.value)} />
        : <input className={className} value={str(value)} onChange={(e) => onChange(e.target.value)} />}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-3xl border border-subtle bg-card-surface p-5 shadow-sm md:p-6">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default function JoeStreetJournalAdminClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError(""); setMessage("");
    try {
      const auth = await token();
      if (!auth) throw new Error("No admin session. Please sign in again.");
      const res = await fetch("/api/admin/joe-street-journal", {
        cache: "no-store", headers: { authorization: `Bearer ${auth}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `Load failed (${res.status})`);
      setData(json.data);
      if (json.initialized) setMessage("The complete current Journal page was initialized and saved to R2.");
    } catch (err) {
      setError(err?.message || "Unable to load.");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true); setError(""); setMessage("");
    try {
      const auth = await token();
      const res = await fetch("/api/admin/joe-street-journal", {
        method: "PUT",
        headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `Save failed (${res.status})`);
      setData(json.data);
      setMessage("Saved to R2. The public page is live.");
    } catch (err) {
      setError(err?.message || "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  function setObject(key, field, value) {
    setData((old) => ({ ...old, [key]: { ...(old?.[key] || {}), [field]: value } }));
  }
  function setArrayItem(key, index, patch) {
    setData((old) => ({ ...old, [key]: (old?.[key] || []).map((item, i) => i === index ? { ...item, ...patch } : item) }));
  }
  function removeArrayItem(key, index) {
    setData((old) => ({ ...old, [key]: (old?.[key] || []).filter((_, i) => i !== index) }));
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="section">
      <div className="container-site space-y-6">
        <AdminNav
          eyebrow="Admin · Content"
          title="Joe Street Journal"
          description="Edit the public DFS information page. Every field below is stored in R2."
          publicHref="/joe-street-journal"
          publicLabel="View public page"
        />

        <div className="sticky top-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-subtle bg-[#07152b]/95 p-4 shadow-xl backdrop-blur">
          <button className="btn btn-primary" onClick={save} disabled={loading || saving || !data}>
            {saving ? "Saving…" : "Save and publish"}
          </button>
          <button className="btn btn-outline" onClick={load} disabled={loading || saving}>Reload</button>
          {data?.updatedAt ? <span className="text-xs text-muted">Last saved {new Date(data.updatedAt).toLocaleString()}</span> : null}
          {message ? <span className="text-sm text-emerald-200">{message}</span> : null}
          {error ? <span className="text-sm text-rose-200">{error}</span> : null}
        </div>

        {loading ? <div className="rounded-2xl border border-subtle bg-card-surface p-6 text-muted">Loading and checking R2…</div> : null}

        {!loading && data ? (
          <div className="space-y-6">
            <Panel title="Hero">
              <div className="grid gap-4 md:grid-cols-3">
                {["eyebrow", "title", "accent"].map((field) => (
                  <Field key={field} label={field} value={data.branding?.[field]} onChange={(v) => setObject("branding", field, v)} />
                ))}
              </div>
              <Field label="Description" area value={data.branding?.description} onChange={(v) => setObject("branding", "description", v)} />
            </Panel>

            <Panel title="Links">
              <p className="text-xs text-muted">IDs connect links to page buttons. Keep an ID stable unless you also update section link IDs.</p>
              {(data.links || []).map((link, index) => (
                <div key={`${link.id}-${index}`} className="grid gap-3 rounded-2xl border border-subtle bg-black/10 p-4 md:grid-cols-[180px_1fr_2fr_auto]">
                  <Field label="ID" value={link.id} onChange={(v) => setArrayItem("links", index, { id: v })} />
                  <Field label="Button label" value={link.label} onChange={(v) => setArrayItem("links", index, { label: v })} />
                  <Field label="URL" value={link.url} onChange={(v) => setArrayItem("links", index, { url: v })} />
                  <button className="btn btn-outline self-end" onClick={() => removeArrayItem("links", index)}>Delete</button>
                </div>
              ))}
              <button className="btn btn-outline" onClick={() => setData((old) => ({ ...old, links: [...(old.links || []), { id: `link-${Date.now()}`, label: "New link", url: "" }] }))}>+ Add link</button>
            </Panel>

            <Panel title="Hero stats">
              <div className="grid gap-3 md:grid-cols-2">
                {(data.stats || []).map((stat, index) => (
                  <div key={index} className="grid grid-cols-2 gap-3 rounded-2xl border border-subtle p-4">
                    <Field label="Value" value={stat.value} onChange={(v) => setArrayItem("stats", index, { value: v })} />
                    <Field label="Label" value={stat.label} onChange={(v) => setArrayItem("stats", index, { label: v })} />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="How it works">
              {(data.journey || []).map((item, index) => (
                <div key={index} className="grid gap-3 rounded-2xl border border-subtle p-4 md:grid-cols-[200px_1fr]">
                  <Field label="Title" value={item.title} onChange={(v) => setArrayItem("journey", index, { title: v })} />
                  <Field label="Text" value={item.text} onChange={(v) => setArrayItem("journey", index, { text: v })} />
                </div>
              ))}
            </Panel>

            <Panel title="Information sections">
              {(data.sections || []).map((section, index) => (
                <div key={`${section.id}-${index}`} className="space-y-4 rounded-2xl border border-subtle bg-black/10 p-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Section ID" value={section.id} onChange={(v) => setArrayItem("sections", index, { id: v })} />
                    <Field label="Title" value={section.title} onChange={(v) => setArrayItem("sections", index, { title: v })} />
                    <Field label="Optional link ID" value={section.linkId} onChange={(v) => setArrayItem("sections", index, { linkId: v })} />
                  </div>
                  <Field label="Body" area value={section.body} onChange={(v) => setArrayItem("sections", index, { body: v })} hint="Use a blank line between paragraphs." />
                  <Field label="Bullets — one per line" area value={lines(section.items)} onChange={(v) => setArrayItem("sections", index, { items: fromLines(v) })} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Callout title" value={section.calloutTitle} onChange={(v) => setArrayItem("sections", index, { calloutTitle: v })} />
                    <Field label="Callout text" value={section.calloutText} onChange={(v) => setArrayItem("sections", index, { calloutText: v })} />
                  </div>
                  <button className="btn btn-outline" onClick={() => removeArrayItem("sections", index)}>Delete section</button>
                </div>
              ))}
              <button className="btn btn-outline" onClick={() => setData((old) => ({ ...old, sections: [...(old.sections || []), { id: `section-${Date.now()}`, title: "New section", body: "", items: [], calloutTitle: "", calloutText: "", linkId: "" }] }))}>+ Add section</button>
            </Panel>

            <Panel title="Signup area">
              {["eyebrow", "title", "description", "paymentNote"].map((field) => (
                <Field key={field} label={field} area={field.includes("description") || field === "paymentNote"} value={data.signup?.[field]} onChange={(v) => setObject("signup", field, v)} />
              ))}
            </Panel>

            <Panel title="DraftKings onboarding">
              <Field label="Title" value={data.draftKings?.title} onChange={(v) => setObject("draftKings", "title", v)} />
              <Field label="Description" area value={data.draftKings?.description} onChange={(v) => setObject("draftKings", "description", v)} />
              <Field label="Steps — one per line" area value={lines(data.draftKings?.steps)} onChange={(v) => setObject("draftKings", "steps", fromLines(v))} />
            </Panel>

            <Panel title="Weekly edition callout">
              {["eyebrow", "title", "description"].map((field) => (
                <Field key={field} label={field} area={field === "description"} value={data.weekly?.[field]} onChange={(v) => setObject("weekly", field, v)} />
              ))}
            </Panel>

            <Panel title="Footer">
              <Field label="Disclaimer" area value={data.disclaimer} onChange={(v) => setData((old) => ({ ...old, disclaimer: v }))} />
            </Panel>
          </div>
        ) : null}
      </div>
    </main>
  );
}
