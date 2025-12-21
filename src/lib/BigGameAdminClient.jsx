"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

const DEFAULT_SEASON = 2025;
const R2_KEY_FOR = (season) => `data/biggame/leagues_${season}.json`;

const DIVISION_STATUS_OPTIONS = ["FULL", "FILLING", "TBD", "DRAFTING"];
const LEAGUE_STATUS_OPTIONS = ["FULL", "FILLING", "TBD", "DRAFTING"];

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeNum(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function slugify(input) {
  return safeStr(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function newId(prefix = "bg") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function safeRevoke(url) {
  try {
    if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
  } catch {}
}

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

function normalizeRow(r, idx = 0, season = DEFAULT_SEASON) {
  const year = safeNum(r?.year, season);
  const isHeader = !!r?.is_division_header;

  // Division
  const division_name = safeStr(r?.division_name).trim();
  const division_slug = safeStr(r?.division_slug).trim() || slugify(division_name) || `division-${idx + 1}`;
  const division_status = DIVISION_STATUS_OPTIONS.includes(safeStr(r?.division_status)) ? safeStr(r?.division_status) : "FULL";
  const division_order = safeNum(r?.division_order, null);

  const division_image_key = safeStr(r?.division_image_key || "").trim();
  const division_image_path = safeStr(r?.division_image_path || "").trim();

  // League
  const display_order = safeNum(r?.display_order, null);
  const league_name = safeStr(r?.league_name || "").trim();
  const league_url = safeStr(r?.league_url || "").trim();
  const league_status = LEAGUE_STATUS_OPTIONS.includes(safeStr(r?.league_status)) ? safeStr(r?.league_status) : "FULL";
  const spots_available = safeNum(r?.spots_available, null);

  const league_image_key = safeStr(r?.league_image_key || "").trim();
  const league_image_path = safeStr(r?.league_image_path || "").trim();

  return {
    id: safeStr(r?.id) || newId("bg"),
    year,

    division_name,
    division_slug,
    division_status,
    division_order,
    division_blurb: safeStr(r?.division_blurb || "").trim(),

    division_image_key: division_image_key || "",
    division_image_path: division_image_path || "",

    league_name,
    league_url,
    league_status,
    league_image_key: league_image_key || "",
    league_image_path: league_image_path || "",

    display_order,
    spots_available,

    is_active: r?.is_active !== false,
    is_division_header: isHeader,

    // local-only
    _pending_division_file: null,
    _pending_division_preview: "",
    _pending_league_file: null,
    _pending_league_preview: "",
  };
}

function groupByDivision(rows) {
  const map = new Map();

  for (const r of rows) {
    const year = Number(r.year) || DEFAULT_SEASON;
    const div = safeStr(r.division_slug || slugify(r.division_name) || "").trim();
    if (!div) continue;
    const key = `${year}::${div}`;
    if (!map.has(key)) map.set(key, { key, year, division_slug: div, rows: [] });
    map.get(key).rows.push(r);
  }

  const groups = Array.from(map.values());
  for (const g of groups) {
    // ensure header first
    g.rows.sort((a, b) => {
      if (!!a.is_division_header !== !!b.is_division_header) return a.is_division_header ? -1 : 1;
      const ao = a.display_order ?? 999;
      const bo = b.display_order ?? 999;
      if (ao !== bo) return ao - bo;
      return safeStr(a.league_name).localeCompare(safeStr(b.league_name));
    });

    const header = g.rows.find((x) => x.is_division_header) || null;
    g.header = header;
    g.leagues = g.rows.filter((x) => !x.is_division_header);

    // division order/name for sorting
    g.division_name = safeStr(header?.division_name || g.rows[0]?.division_name || g.division_slug);
    g.division_order = safeNum(header?.division_order, null);
  }

  groups.sort((a, b) => {
    // year desc
    if (a.year !== b.year) return b.year - a.year;

    // division_order asc if present
    const ao = a.division_order;
    const bo = b.division_order;
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    if (Number.isFinite(ao) && !Number.isFinite(bo)) return -1;
    if (!Number.isFinite(ao) && Number.isFinite(bo)) return 1;

    return safeStr(a.division_name).localeCompare(safeStr(b.division_name));
  });

  return groups;
}

async function uploadBigGameImage({ file, section, season, divisionSlug, leagueOrder, token }) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("section", section);
  fd.append("season", String(season));
  fd.append("divisionSlug", String(divisionSlug));
  if (leagueOrder != null) fd.append("leagueOrder", String(leagueOrder));

  const res = await fetch(`/api/admin/upload`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: fd,
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out?.ok) throw new Error(out?.error || `Upload failed (${res.status})`);
  return out;
}

export default function BigGameAdminClient() {
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [open, setOpen] = useState(() => new Set());

  const groups = useMemo(() => groupByDivision(rows.filter((r) => Number(r.year) === Number(season))), [rows, season]);

  async function loadFromR2(nextSeason = season) {
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);
    try {
      const bust = `v=${Date.now()}`;
      const res = await fetch(`/r2/${R2_KEY_FOR(nextSeason)}?${bust}`, { cache: "no-store" });
      if (!res.ok) {
        setRows([]);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
      setRows(list.map((r, idx) => normalizeRow(r, idx, nextSeason)));
    } catch (e) {
      setErrorMsg(e?.message || "Failed to load Big Game data from R2.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFromR2(season);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  async function saveAllToR2(nextRows = rows, nextSeason = season) {
    setErrorMsg("");
    setInfoMsg("");
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session token. Please sign in again.");

      // Upload pending images first
      const updated = [];
      for (const r of nextRows) {
        if (Number(r.year) !== Number(nextSeason)) {
          updated.push(r);
          continue;
        }

        const divSlug = safeStr(r.division_slug || slugify(r.division_name) || "").trim();
        let next = { ...r, division_slug: divSlug };

        if (r.is_division_header && r._pending_division_file && divSlug) {
          const out = await uploadBigGameImage({
            file: r._pending_division_file,
            section: "biggame-division",
            season: nextSeason,
            divisionSlug: divSlug,
            token,
          });
          safeRevoke(next._pending_division_preview);
          next = {
            ...next,
            division_image_key: out.key,
            _pending_division_file: null,
            _pending_division_preview: "",
          };
        }

        if (!r.is_division_header && r._pending_league_file && divSlug && Number.isFinite(Number(r.display_order))) {
          const out = await uploadBigGameImage({
            file: r._pending_league_file,
            section: "biggame-league",
            season: nextSeason,
            divisionSlug: divSlug,
            leagueOrder: Number(r.display_order),
            token,
          });
          safeRevoke(next._pending_league_preview);
          next = {
            ...next,
            league_image_key: out.key,
            _pending_league_file: null,
            _pending_league_preview: "",
          };
        }

        updated.push(next);
      }

      // Normalize & stable sort
      const clean = updated
        .map((r, idx) => normalizeRow(r, idx, nextSeason))
        .filter((r) => Number(r.year) === Number(nextSeason));

      clean.sort((a, b) => {
        // division order/name
        const ao = a.division_order ?? 9999;
        const bo = b.division_order ?? 9999;
        if (ao !== bo) return ao - bo;
        const an = safeStr(a.division_name).toLowerCase();
        const bn = safeStr(b.division_name).toLowerCase();
        if (an !== bn) return an.localeCompare(bn);
        if (!!a.is_division_header !== !!b.is_division_header) return a.is_division_header ? -1 : 1;
        return (a.display_order ?? 999) - (b.display_order ?? 999);
      });

      const payload = { updatedAt: nowIso(), rows: clean };

      const res = await fetch(`/api/admin/biggame?season=${encodeURIComponent(String(nextSeason))}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out?.ok) throw new Error(out?.error || `Save failed (${res.status})`);

      setRows(clean);
      setInfoMsg(`Saved Big Game divisions to R2 (season ${nextSeason}).`);
    } catch (e) {
      setErrorMsg(e?.message || "Failed to save Big Game data.");
    } finally {
      setSaving(false);
    }
  }

  async function importFromSupabase() {
    setErrorMsg("");
    setInfoMsg("");
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase client not available.");

      const { data, error } = await supabase
        .from("biggame_leagues")
        .select("*")
        .eq("year", season)
        .order("division_order", { ascending: true })
        .order("is_division_header", { ascending: false })
        .order("display_order", { ascending: true });

      if (error) throw error;

      const imported = (data || []).map((r, idx) =>
        normalizeRow(
          {
            ...r,
            division_slug: slugify(r?.division_name || ""),
            // keep existing supabase image paths as fallback
            division_image_key: "",
            league_image_key: "",
          },
          idx,
          season
        )
      );

      setRows(imported);
      setInfoMsg(`Imported ${imported.length} rows from Supabase. Review, then click "Save to R2".`);
    } catch (e) {
      setErrorMsg(e?.message || "Failed to import from Supabase.");
    }
  }

  function toggleGroup(k) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function upsertRow(rowId, patch) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function setDivisionHeader(group, patch) {
    if (group.header?.id) {
      upsertRow(group.header.id, patch);
      return;
    }

    // create missing header row
    const header = normalizeRow(
      {
        id: newId("bg"),
        year: group.year,
        division_name: group.division_name,
        division_slug: group.division_slug,
        division_status: "FULL",
        division_order: group.division_order,
        division_blurb: "",
        is_division_header: true,
        is_active: true,
      },
      0,
      season
    );

    setRows((prev) => [...prev, { ...header, ...patch }]);
  }

  function addDivision() {
    const baseName = window.prompt("Division name?") || "";
    const name = baseName.trim();
    if (!name) return;
    const divSlug = slugify(name);

    // header
    const header = normalizeRow(
      {
        id: newId("bg"),
        year: season,
        division_name: name,
        division_slug: divSlug,
        division_status: "FILLING",
        division_order: null,
        is_division_header: true,
        is_active: true,
      },
      0,
      season
    );

    // 8 leagues
    const leagues = Array.from({ length: 8 }).map((_, i) =>
      normalizeRow(
        {
          id: newId("bg"),
          year: season,
          division_name: name,
          division_slug: divSlug,
          division_status: header.division_status,
          league_name: "",
          league_url: "",
          league_status: header.division_status,
          display_order: i + 1,
          is_division_header: false,
          is_active: true,
        },
        i,
        season
      )
    );

    setRows((prev) => [...prev, header, ...leagues]);
    setInfoMsg(`Added division "${name}" locally. Click "Save to R2" to publish.`);
  }

  function deleteDivision(group) {
    const ok = window.prompt('Type BALLSVILLE to delete this entire division (header + leagues):');
    if ((ok || "").trim().toLowerCase() !== "ballsville") return;

    setRows((prev) => prev.filter((r) => !(Number(r.year) === Number(group.year) && safeStr(r.division_slug) === safeStr(group.division_slug))));
    setOpen((prev) => {
      const next = new Set(prev);
      next.delete(group.key);
      return next;
    });

    setInfoMsg(`Division "${group.division_name}" removed locally. Click "Save to R2" to publish.`);
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading Big Game divisions…</p>;
  }

  return (
    <section className="space-y-6">
      {(errorMsg || infoMsg) && (
        <div className="space-y-1 text-sm">
          {errorMsg && <p className="text-danger">{errorMsg}</p>}
          {infoMsg && !errorMsg && <p className="text-accent">{infoMsg}</p>}
        </div>
      )}

      <div className="rounded-2xl border border-subtle bg-card-surface p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Big Game data source: R2</p>
          <p className="text-xs text-muted">Reads/writes: /r2/{R2_KEY_FOR(season)}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-muted flex items-center gap-2">
            Season
            <input className="input w-24" value={season} onChange={(e) => setSeason(safeNum(e.target.value, season) || season)} />
          </label>

          <button className="btn btn-outline text-sm" type="button" onClick={() => loadFromR2(season)} disabled={saving}>
            Reload from R2
          </button>

          <button className="btn btn-outline text-sm" type="button" onClick={importFromSupabase} disabled={saving}>
            Import from Supabase
          </button>

          <button className="btn btn-primary text-sm" type="button" onClick={() => saveAllToR2(rows, season)} disabled={saving}>
            {saving ? "Saving…" : "Save to R2"}
          </button>

          <button className="btn btn-primary text-sm" type="button" onClick={addDivision} disabled={saving}>
            + Add division
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Divisions</h2>

        {groups.length === 0 ? (
          <p className="text-sm text-muted">No Big Game rows in R2 yet. Use “Import from Supabase” or “Add division”.</p>
        ) : (
          groups.map((g) => {
            const isOpen = open.has(g.key);
            const header = g.header;

            const divisionImageSrc = header?._pending_division_preview
              ? header._pending_division_preview
              : header?.division_image_key
              ? `/r2/${header.division_image_key}`
              : header?.division_image_path
              ? header.division_image_path
              : "";

            return (
              <div key={g.key} className="rounded-2xl border border-subtle bg-card-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(g.key)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 border-b border-subtle"
                >
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold truncate">
                      {g.division_name} · {g.year}
                    </p>
                    <p className="text-xs text-muted truncate">{g.leagues.length} leagues</p>
                  </div>
                  <span className="text-xs text-muted">{isOpen ? "Hide" : "Edit"} →</span>
                </button>

                {isOpen && (
                  <div className="p-5 space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs text-muted">Division name</span>
                        <input
                          className="input"
                          value={safeStr(header?.division_name || g.division_name)}
                          onChange={(e) => {
                            const nextName = e.target.value;
                            // update all rows in division
                            setRows((prev) =>
                              prev.map((r) => {
                                if (Number(r.year) !== Number(g.year)) return r;
                                if (safeStr(r.division_slug) !== safeStr(g.division_slug)) return r;
                                return {
                                  ...r,
                                  division_name: nextName,
                                  division_slug: slugify(nextName) || r.division_slug,
                                };
                              })
                            );
                          }}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs text-muted">Division order (small numbers show first)</span>
                        <input
                          className="input w-28"
                          value={safeStr(header?.division_order ?? "")}
                          onChange={(e) => setDivisionHeader(g, { division_order: safeNum(e.target.value, null) })}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs text-muted">Division status</span>
                        <select
                          className="input"
                          value={safeStr(header?.division_status || "FULL")}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRows((prev) =>
                              prev.map((r) => {
                                if (Number(r.year) !== Number(g.year)) return r;
                                if (safeStr(r.division_slug) !== safeStr(g.division_slug)) return r;
                                // keep division_status mirrored in all rows (matches current schema)
                                return { ...r, division_status: v };
                              })
                            );
                          }}
                        >
                          {DIVISION_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs text-muted">Division blurb (optional)</span>
                        <input
                          className="input"
                          value={safeStr(header?.division_blurb || "")}
                          onChange={(e) => setDivisionHeader(g, { division_blurb: e.target.value })}
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-3">
                        <label className="btn btn-outline text-xs cursor-pointer">
                          Upload division image
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const preview = URL.createObjectURL(file);

                              // store on header row
                              const headerId = header?.id;
                              if (!headerId) {
                                setDivisionHeader(g, { _pending_division_file: file, _pending_division_preview: preview });
                              } else {
                                setRows((prev) =>
                                  prev.map((r) => {
                                    if (r.id !== headerId) return r;
                                    safeRevoke(r._pending_division_preview);
                                    return { ...r, _pending_division_file: file, _pending_division_preview: preview };
                                  })
                                );
                              }

                              e.target.value = "";
                            }}
                          />
                        </label>

                        {divisionImageSrc ? (
                          <img
                            src={divisionImageSrc}
                            alt="Division preview"
                            className="h-12 w-20 object-cover rounded-lg border border-subtle"
                          />
                        ) : (
                          <span className="text-xs text-muted">No image</span>
                        )}

                        <span className="text-[11px] text-muted">
                          {header?.division_image_key ? `R2: ${safeStr(header.division_image_key).split("/").slice(-1)[0]}` : header?.division_image_path ? "URL" : "—"}
                        </span>
                      </div>

                      <button className="btn btn-outline text-sm" type="button" onClick={() => deleteDivision(g)}>
                        Delete division
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-subtle">
                      <table className="min-w-[980px] w-full text-sm">
                        <thead className="bg-subtle-surface">
                          <tr className="text-left">
                            <th className="px-3 py-2 w-[70px]">#</th>
                            <th className="px-3 py-2 w-[280px]">Name</th>
                            <th className="px-3 py-2 w-[140px]">Status</th>
                            <th className="px-3 py-2">Sleeper URL</th>
                            <th className="px-3 py-2 w-[220px]">Image</th>
                            <th className="px-3 py-2 w-[140px]">Spots</th>
                            <th className="px-3 py-2 w-[70px]">Active</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.leagues
                            .slice()
                            .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
                            .map((lg) => {
                              const leagueImg = lg._pending_league_preview
                                ? lg._pending_league_preview
                                : lg.league_image_key
                                ? `/r2/${lg.league_image_key}`
                                : lg.league_image_path
                                ? lg.league_image_path
                                : "";

                              return (
                                <tr key={lg.id} className="border-t border-subtle">
                                  <td className="px-3 py-2">
                                    <input
                                      className="input w-16"
                                      value={safeStr(lg.display_order ?? "")}
                                      onChange={(e) => upsertRow(lg.id, { display_order: safeNum(e.target.value, null) })}
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      className="input w-72"
                                      value={safeStr(lg.league_name)}
                                      onChange={(e) => upsertRow(lg.id, { league_name: e.target.value })}
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      className="input w-36"
                                      value={safeStr(lg.league_status || "FULL")}
                                      onChange={(e) => upsertRow(lg.id, { league_status: e.target.value })}
                                    >
                                      {LEAGUE_STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      className="input w-[320px]"
                                      value={safeStr(lg.league_url)}
                                      onChange={(e) => upsertRow(lg.id, { league_url: e.target.value })}
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <label className="btn btn-outline text-xs cursor-pointer">
                                        Upload
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const preview = URL.createObjectURL(file);
                                            setRows((prev) =>
                                              prev.map((r) => {
                                                if (r.id !== lg.id) return r;
                                                safeRevoke(r._pending_league_preview);
                                                return { ...r, _pending_league_file: file, _pending_league_preview: preview };
                                              })
                                            );
                                            e.target.value = "";
                                          }}
                                        />
                                      </label>

                                      {leagueImg ? (
                                        <img src={leagueImg} alt="League preview" className="h-10 w-16 object-cover rounded-lg border border-subtle" />
                                      ) : (
                                        <span className="text-xs text-muted">No image</span>
                                      )}

                                      <span className="text-[11px] text-muted truncate max-w-[120px]">
                                        {lg.league_image_key ? `R2: ${safeStr(lg.league_image_key).split("/").slice(-1)[0]}` : lg.league_image_path ? "URL" : "—"}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      className="input w-24"
                                      value={safeStr(lg.spots_available ?? "")}
                                      onChange={(e) => upsertRow(lg.id, { spots_available: safeNum(e.target.value, null) })}
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input type="checkbox" checked={lg.is_active !== false} onChange={(e) => upsertRow(lg.id, { is_active: e.target.checked })} />
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end">
                      <button className="btn btn-primary" type="button" onClick={() => saveAllToR2(rows, season)} disabled={saving}>
                        {saving ? "Saving…" : "Save to R2"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
