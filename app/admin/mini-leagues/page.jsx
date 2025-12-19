"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/src/lib/supabaseClient";

const API_GETPUT = "/api/admin/mini-leagues";
const API_UPLOAD = "/api/admin/upload";

const STATUS_OPTIONS = ["FULL", "FILLING", "TBD", "DRAFTING"];

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-subtle bg-card-trans px-3 py-1 text-xs text-muted backdrop-blur-sm">
      {children}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          {label}
        </label>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-subtle bg-card-surface px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/40 ${props.className || ""}`}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`w-full min-h-[110px] rounded-xl border border-subtle bg-card-surface px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/40 ${props.className || ""}`}
    />
  );
}

function SmallBtn({ children, variant = "outline", ...props }) {
  const cls =
    variant === "primary"
      ? "btn btn-primary"
      : variant === "danger"
      ? "btn bg-red-600/90 hover:bg-red-600 text-white border border-red-500/40"
      : "btn btn-outline";
  return (
    <button type="button" className={cls} {...props}>
      {children}
    </button>
  );
}

async function getAccessToken() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

async function apiGet() {
  const token = await getAccessToken();
  const res = await fetch(API_GETPUT, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    throw new Error(txt || "Invalid JSON response");
  }
  if (!res.ok) throw new Error(json?.error || "Failed to load");
  return json;
}

async function apiSave(payload) {
  const token = await getAccessToken();
  const res = await fetch(API_GETPUT, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    throw new Error(txt || "Invalid JSON response");
  }
  if (!res.ok) throw new Error(json?.error || "Failed to save");
  return json;
}

async function apiUpload(file) {
  const token = await getAccessToken();
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // base64 encode
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const dataBase64 = btoa(bin);

  const res = await fetch(API_UPLOAD, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      dataBase64,
    }),
  });

  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    throw new Error(txt || "Invalid JSON response");
  }
  if (!res.ok) throw new Error(json?.error || "Upload failed");
  return json; // { ok, key, url }
}

function ListEditor({ title, items, onChange, placeholder = "Add item…" }) {
  const [draft, setDraft] = useState("");

  return (
    <div className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
          {title}
        </h3>
        <div className="flex gap-2">
          <SmallBtn
            onClick={() => {
              const v = draft.trim();
              if (!v) return;
              onChange([...(items || []), v]);
              setDraft("");
            }}
            variant="primary"
          >
            + Add
          </SmallBtn>
        </div>
      </div>

      <div className="flex gap-2">
        <TextInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
        />
      </div>

      <div className="space-y-2">
        {(items || []).map((it, idx) => (
          <div
            key={`${it}-${idx}`}
            className="flex items-start gap-2 rounded-xl border border-subtle bg-card-trans p-3"
          >
            <div className="flex-1 text-sm text-fg">{it}</div>
            <div className="flex gap-2">
              <SmallBtn
                onClick={() => {
                  const next = items.slice();
                  next.splice(idx, 1);
                  onChange(next);
                }}
                variant="danger"
              >
                ✕
              </SmallBtn>
            </div>
          </div>
        ))}
        {!items?.length ? (
          <p className="text-sm text-muted">No items yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function ImagePicker({ label, valueUrl, valueAlt, onChangeUrl, onChangeAlt }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  return (
    <div className="rounded-2xl border border-subtle bg-card-surface p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">
          {label}
        </h3>
        {valueUrl ? <Badge>Image set</Badge> : <Badge>No image</Badge>}
      </div>

      {valueUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={valueUrl}
          alt={valueAlt || ""}
          className="w-full max-w-[520px] rounded-xl border border-subtle"
        />
      ) : (
        <div className="rounded-xl border border-subtle bg-subtle-surface p-6 text-sm text-muted">
          Upload an image to R2 and it will auto-fill the URL.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Image URL">
          <TextInput
            value={valueUrl || ""}
            onChange={(e) => onChangeUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Alt text" hint="Helps SEO + accessibility">
          <TextInput
            value={valueAlt || ""}
            onChange={(e) => onChangeAlt(e.target.value)}
            placeholder="Describe the image"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="btn btn-outline cursor-pointer">
          {busy ? "Uploading…" : "Upload Image"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setErr("");
              setBusy(true);
              try {
                const out = await apiUpload(f);
                // prefer public url if present
                const finalUrl = out.url || "";
                onChangeUrl(finalUrl || valueUrl || "");
                if (!valueAlt) onChangeAlt(f.name.replace(/\.[^.]+$/, ""));
              } catch (ex) {
                setErr(String(ex?.message || ex));
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>

        {err ? <p className="text-sm text-red-300">{err}</p> : null}
      </div>
    </div>
  );
}

function DivisionEditor({ division, onUpdate, onDelete }) {
  const div = division;

  function update(patch) {
    onUpdate({ ...div, ...patch });
  }

  function updateImage(patch) {
    update({ image: { ...(div.image || {}), ...patch } });
  }

  function updateLeague(idx, patch) {
    const next = (div.leagues || []).slice();
    next[idx] = { ...next[idx], ...patch };
    update({ leagues: next });
  }

  function updateLeagueImage(idx, patch) {
    const next = (div.leagues || []).slice();
    next[idx] = {
      ...next[idx],
      image: { ...(next[idx].image || {}), ...patch },
    };
    update({ leagues: next });
  }

  return (
    <div className="rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">
            Division
          </p>
          <h3 className="text-2xl font-semibold text-fg">{div.title}</h3>
        </div>
        <div className="flex gap-2">
          <SmallBtn variant="danger" onClick={onDelete}>
            Delete Division
          </SmallBtn>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title">
          <TextInput
            value={div.title || ""}
            onChange={(e) => update({ title: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <select
            className="w-full rounded-xl border border-subtle bg-card-surface px-3 py-2 text-sm text-fg outline-none"
            value={div.status || "TBD"}
            onChange={(e) => update({ status: e.target.value })}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order" hint="Lower shows first">
          <TextInput
            type="number"
            value={div.order ?? 0}
            onChange={(e) => update({ order: Number(e.target.value || 0) })}
          />
        </Field>
        <Field label="ID" hint="Stable key (don’t change after live)">
          <TextInput
            value={div.id || ""}
            onChange={(e) => update({ id: e.target.value })}
          />
        </Field>
      </div>

      <ImagePicker
        label="Division image"
        valueUrl={div.image?.url || ""}
        valueAlt={div.image?.alt || ""}
        onChangeUrl={(url) => updateImage({ url })}
        onChangeAlt={(alt) => updateImage({ alt })}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
            Leagues (10 per division)
          </h4>
          <SmallBtn
            variant="primary"
            onClick={() => {
              const next = (div.leagues || []).slice();
              const n = next.length + 1;
              next.push({
                id: `${div.id || "div"}-lg-${n}`,
                name: `League ${n}`,
                status: "TBD",
                order: n,
                sleeperUrl: "",
                image: { url: "", alt: "" },
              });
              update({ leagues: next });
            }}
          >
            + Add League
          </SmallBtn>
        </div>

        <div className="space-y-4">
          {(div.leagues || [])
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((lg, idxSorted) => {
              const idx = (div.leagues || []).findIndex((x) => x.id === lg.id);

              return (
                <div
                  key={lg.id}
                  className="rounded-2xl border border-subtle bg-card-trans p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-[0.35em] text-muted">
                        League
                      </div>
                      <div className="text-lg font-semibold">{lg.name}</div>
                    </div>
                    <SmallBtn
                      variant="danger"
                      onClick={() => {
                        const next = (div.leagues || []).slice();
                        next.splice(idx, 1);
                        update({ leagues: next });
                      }}
                    >
                      Delete
                    </SmallBtn>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Name">
                      <TextInput
                        value={lg.name || ""}
                        onChange={(e) => updateLeague(idx, { name: e.target.value })}
                      />
                    </Field>
                    <Field label="Status">
                      <select
                        className="w-full rounded-xl border border-subtle bg-card-surface px-3 py-2 text-sm text-fg outline-none"
                        value={lg.status || "TBD"}
                        onChange={(e) => updateLeague(idx, { status: e.target.value })}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Order" hint="1–10">
                      <TextInput
                        type="number"
                        value={lg.order ?? 0}
                        onChange={(e) =>
                          updateLeague(idx, { order: Number(e.target.value || 0) })
                        }
                      />
                    </Field>
                    <Field label="Sleeper URL" hint="Click target on public page">
                      <TextInput
                        value={lg.sleeperUrl || ""}
                        onChange={(e) =>
                          updateLeague(idx, { sleeperUrl: e.target.value })
                        }
                        placeholder="https://sleeper.com/leagues/..."
                      />
                    </Field>
                  </div>

                  <ImagePicker
                    label="League image"
                    valueUrl={lg.image?.url || ""}
                    valueAlt={lg.image?.alt || ""}
                    onChangeUrl={(url) => updateLeagueImage(idx, { url })}
                    onChangeAlt={(alt) => updateLeagueImage(idx, { alt })}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default function MiniLeaguesAdminPage() {
  const [tab, setTab] = useState("content"); // content | structure
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [model, setModel] = useState(null);

  const dirty = useMemo(() => !!model && !loading, [model, loading]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setError("");
      setLoading(true);
      try {
        const data = await apiGet();
        if (!ignore) setModel(data);
      } catch (e) {
        if (!ignore) setError(String(e?.message || e));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function saveAll() {
    setError("");
    setSaving(true);
    try {
      const out = await apiSave(model || {});
      setSavedAt(out.updatedAt || new Date().toISOString());
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="relative min-h-screen text-fg">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="hero-glow" />
        </div>
        <section className="section">
          <div className="container-site">
            <div className="rounded-3xl border border-subtle bg-card-surface shadow-xl p-8">
              <p className="text-sm text-muted">Loading Mini-Leagues admin…</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!model) {
    return (
      <main className="relative min-h-screen text-fg">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="hero-glow" />
        </div>
        <section className="section">
          <div className="container-site space-y-4">
            <div className="rounded-3xl border border-subtle bg-card-surface shadow-xl p-8">
              <h1 className="text-2xl font-semibold">Mini-Leagues Admin</h1>
              <p className="mt-2 text-sm text-red-300">{error || "No data loaded."}</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen text-fg">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="hero-glow" />
      </div>

      <section className="section">
        <div className="container-site space-y-8">
          <header className="relative overflow-hidden rounded-3xl border border-subtle bg-card-surface shadow-xl p-6 md:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-55 mix-blend-screen">
              <div className="absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--color-accent)]/18 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[color:var(--color-primary)]/14 blur-3xl" />
            </div>

            <div className="relative space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-accent">
                Admin • Mini-Leagues
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                Page Builder <span className="text-primary">+ Divisions</span>
              </h1>
              <p className="text-sm sm:text-base text-muted max-w-prose">
                Edit the public Mini-Leagues page content, manage divisions/leagues, and upload images to R2.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/mini-leagues" className="btn btn-outline">
                  View Public Page
                </Link>
                <Link href="/admin" className="btn btn-outline">
                  Admin Home
                </Link>
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>

              <div className="mt-4 inline-flex flex-wrap gap-2 text-xs sm:text-sm">
                <Badge>Version: {model.version}</Badge>
                <Badge>UpdatedAt: {model.updatedAt || "—"}</Badge>
                {savedAt ? <Badge>Saved: {savedAt}</Badge> : null}
              </div>

              {error ? (
                <p className="text-sm text-red-300 mt-2">{error}</p>
              ) : null}
            </div>
          </header>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("content")}
              className={`btn ${tab === "content" ? "btn-primary" : "btn-outline"}`}
            >
              ✍️ Content
            </button>
            <button
              type="button"
              onClick={() => setTab("structure")}
              className={`btn ${tab === "structure" ? "btn-primary" : "btn-outline"}`}
            >
              🧩 Divisions & Leagues
            </button>
          </div>

          {tab === "content" ? (
            <section className="grid gap-6 lg:grid-cols-2 items-start">
              <div className="space-y-6">
                <div className="rounded-3xl border border-subtle bg-card-surface shadow-sm p-6 space-y-4">
                  <h2 className="text-xl font-semibold text-primary">Hero</h2>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Kicker">
                      <TextInput
                        value={model.hero?.kicker || ""}
                        onChange={(e) =>
                          setModel((m) => ({
                            ...m,
                            hero: { ...(m.hero || {}), kicker: e.target.value },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Title">
                      <TextInput
                        value={model.hero?.title || ""}
                        onChange={(e) =>
                          setModel((m) => ({
                            ...m,
                            hero: { ...(m.hero || {}), title: e.target.value },
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Subtitle">
                    <TextArea
                      value={model.hero?.subtitle || ""}
                      onChange={(e) =>
                        setModel((m) => ({
                          ...m,
                          hero: { ...(m.hero || {}), subtitle: e.target.value },
                        }))
                      }
                    />
                  </Field>
                </div>

                <ImagePicker
                  label="Hero image"
                  valueUrl={model.hero?.image?.url || ""}
                  valueAlt={model.hero?.image?.alt || ""}
                  onChangeUrl={(url) =>
                    setModel((m) => ({
                      ...m,
                      hero: {
                        ...(m.hero || {}),
                        image: { ...(m.hero?.image || {}), url },
                      },
                    }))
                  }
                  onChangeAlt={(alt) =>
                    setModel((m) => ({
                      ...m,
                      hero: {
                        ...(m.hero || {}),
                        image: { ...(m.hero?.image || {}), alt },
                      },
                    }))
                  }
                />

                <ListEditor
                  title="Hero bullets"
                  items={model.hero?.bullets || []}
                  onChange={(bullets) =>
                    setModel((m) => ({
                      ...m,
                      hero: { ...(m.hero || {}), bullets },
                    }))
                  }
                  placeholder="Add a hero bullet…"
                />

                <ListEditor
                  title="Settings bullets"
                  items={model.settings?.bullets || []}
                  onChange={(bullets) =>
                    setModel((m) => ({
                      ...m,
                      settings: { ...(m.settings || {}), bullets },
                    }))
                  }
                  placeholder="Add a setting bullet…"
                />
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-subtle bg-card-surface shadow-sm p-6 space-y-4">
                  <h2 className="text-xl font-semibold text-primary">How it works</h2>

                  <ListEditor
                    title="Paragraphs"
                    items={model.howItWorks?.paragraphs || []}
                    onChange={(paragraphs) =>
                      setModel((m) => ({
                        ...m,
                        howItWorks: { ...(m.howItWorks || {}), paragraphs },
                      }))
                    }
                    placeholder="Add a paragraph…"
                  />
                </div>

                <div className="rounded-3xl border border-subtle bg-card-surface shadow-sm p-6 space-y-6">
                  <h2 className="text-xl font-semibold text-primary">Wager bullets</h2>

                  <ListEditor
                    title="Without a wager"
                    items={model.howItWorks?.wager?.withoutBullets || []}
                    onChange={(withoutBullets) =>
                      setModel((m) => ({
                        ...m,
                        howItWorks: {
                          ...(m.howItWorks || {}),
                          wager: { ...(m.howItWorks?.wager || {}), withoutBullets },
                        },
                      }))
                    }
                  />

                  <ListEditor
                    title="With a wager"
                    items={model.howItWorks?.wager?.withBullets || []}
                    onChange={(withBullets) =>
                      setModel((m) => ({
                        ...m,
                        howItWorks: {
                          ...(m.howItWorks || {}),
                          wager: { ...(m.howItWorks?.wager || {}), withBullets },
                        },
                      }))
                    }
                  />
                </div>

                <ListEditor
                  title="Cash bullets"
                  items={model.cash?.bullets || []}
                  onChange={(bullets) =>
                    setModel((m) => ({
                      ...m,
                      cash: { ...(m.cash || {}), bullets },
                    }))
                  }
                />

                <ListEditor
                  title="Draft etiquette bullets"
                  items={model.etiquette?.bullets || []}
                  onChange={(bullets) =>
                    setModel((m) => ({
                      ...m,
                      etiquette: { ...(m.etiquette || {}), bullets },
                    }))
                  }
                />

                <ImagePicker
                  label="Last year’s winners image"
                  valueUrl={model.lastYear?.image?.url || ""}
                  valueAlt={model.lastYear?.image?.alt || ""}
                  onChangeUrl={(url) =>
                    setModel((m) => ({
                      ...m,
                      lastYear: {
                        ...(m.lastYear || {}),
                        image: { ...(m.lastYear?.image || {}), url },
                      },
                    }))
                  }
                  onChangeAlt={(alt) =>
                    setModel((m) => ({
                      ...m,
                      lastYear: {
                        ...(m.lastYear || {}),
                        image: { ...(m.lastYear?.image || {}), alt },
                      },
                    }))
                  }
                />
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold">Divisions</h2>
                  <p className="text-sm text-muted">
                    Each division has 10 leagues. Each league is 12-team.
                  </p>
                </div>

                <SmallBtn
                  variant="primary"
                  onClick={() => {
                    const next = deepClone(model);
                    const n = (next.divisions?.length || 0) + 1;
                    next.divisions = [
                      ...(next.divisions || []),
                      {
                        id: `div-${Date.now()}`,
                        title: `Division ${n * 100}`,
                        status: "TBD",
                        order: n * 100,
                        image: { url: "", alt: "" },
                        leagues: [],
                      },
                    ];
                    setModel(next);
                  }}
                >
                  + Add Division
                </SmallBtn>
              </div>

              <div className="space-y-6">
                {(model.divisions || [])
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((div) => (
                    <DivisionEditor
                      key={div.id}
                      division={div}
                      onUpdate={(updatedDiv) => {
                        const next = deepClone(model);
                        const idx = (next.divisions || []).findIndex((d) => d.id === div.id);
                        next.divisions[idx] = updatedDiv;
                        setModel(next);
                      }}
                      onDelete={() => {
                        const next = deepClone(model);
                        next.divisions = (next.divisions || []).filter((d) => d.id !== div.id);
                        setModel(next);
                      }}
                    />
                  ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
