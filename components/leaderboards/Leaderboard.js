"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLeaderboard } from "../../app/leaderboards/context/LeaderboardContext";
import  OwnerModal from "./OwnerModal";

const WEEKS_WINDOW = 3; // how many weeks to show at once

/**
 * Leaderboard view (controls + table)
 *
 * NOTE: The old Navbar was a separate component when leaderboards lived in a separate repo.
 * In Ballsville main we keep these controls embedded with the leaderboard UI.
 */
export default function Leaderboard({
  data,
  years: yearsProp,
  current,
  setCurrent,
  basePath,
  lastUpdated,
  showWeeks,
  setShowWeeks,
}) {
  if (!data || !current?.year) return null;

  // Prefer the explicit list from props; otherwise fall back to whatever is in data
  const years = useMemo(() => {
    const base = yearsProp?.length ? yearsProp : Object.keys(data || {});
    return [...base].map(String).sort((a, b) => b.localeCompare(a));
  }, [yearsProp, data]);

  // Available modes for selected year
  const availableModes = useMemo(() => {
    const yearBlock = data?.[current.year] || {};
    const order = { big_game: 1, mini_game: 2, highlander: 3, redraft_2025: 4, redraft: 4, gauntlet: 5, dynasty: 6 };
    return Object.keys(yearBlock)
      .filter((key) => !String(key).startsWith("__"))
      .sort(
      (a, b) => (order[a] ?? 99) - (order[b] ?? 99) || a.localeCompare(b)
      );
  }, [data, current.year]);

  // Keep mode valid
  const activeMode = useMemo(() => {
    if (availableModes.includes(current.mode)) return current.mode;
    return (
      availableModes.find((k) => k === "redraft_2025") ||
      availableModes.find((k) => k === "redraft") ||
      availableModes[0] ||
      ""
    );
  }, [availableModes, current.mode]);

  useEffect(() => {
    if (activeMode && activeMode !== current.mode) {
      setCurrent((prev) => ({ ...prev, mode: activeMode, filterType: "all", filterValue: null }));
    }
  }, [activeMode, current.mode, setCurrent]);

  const activeBlock = data?.[current.year]?.[activeMode] || null;
  const isGauntlet = activeMode === "gauntlet";
  const isRedraft2025 = activeMode === "redraft_2025";

  const shortModeName = (val, key) => {
    const name = val?.name || key;
    const parts = String(name).split(" ").filter(Boolean);
    return parts[1] || name;
  };

  return (
    <div className="space-y-4">
      <LeaderboardControls
        data={data}
        years={years}
        current={{ ...current, mode: activeMode }}
        setCurrent={setCurrent}
        showWeeks={showWeeks}
        setShowWeeks={setShowWeeks}
        lastUpdated={lastUpdated}
        activeMode={activeMode}
        activeBlock={activeBlock}
        isGauntlet={isGauntlet}
        isRedraft2025={isRedraft2025}
        shortModeName={shortModeName}
      />

      {/* Table */}
      {activeBlock ? (
        <LeaderboardTable
          data={activeBlock}
          year={Number(current.year)}
          category={activeMode}
          basePath={basePath}
          showWeeks={showWeeks}
          setShowWeeks={setShowWeeks}
          filterType={current.filterType}
          filterValue={current.filterValue}
        />
      ) : (
        <div className="rounded-3xl border border-subtle bg-card-surface shadow-md p-6 text-sm text-muted">
          No leaderboard data available.
        </div>
      )}
    </div>
  );
}

/* ---------------- Controls (embedded navbar) ---------------- */

function LeaderboardControls({
  data,
  years,
  current,
  setCurrent,
  showWeeks,
  setShowWeeks,
  lastUpdated,
  activeMode,
  activeBlock,
  isGauntlet,
  isRedraft2025,
  shortModeName,
}) {
  const [openSheet, setOpenSheet] = useState(null);
  const [search, setSearch] = useState("");

  const handleSelect = (updates) => {
    setCurrent((prev) => ({ ...prev, ...updates }));
    setOpenSheet(null);
    setSearch("");
  };
  const resetFilter = () => handleSelect({ filterType: "all", filterValue: null });

  const filteredDivisions = useMemo(() => {
    // Preserve backend-provided ordering (it already reflects divisionOrder/leagueOrder).
    const list = [...(activeBlock?.divisions || [])];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((d) => String(d).toLowerCase().includes(q));
  }, [activeBlock, search]);

  const filteredLeaguesByDivision = useMemo(() => {
    const map = activeBlock?.leaguesByDivision || {};
    // Preserve backend-provided ordering (it already reflects divisionOrder/leagueOrder).
    // Fallback to object keys if the backend didn't provide a divisions array.
    const divisions = (Array.isArray(activeBlock?.divisions) && activeBlock.divisions.length)
      ? [...activeBlock.divisions]
      : Object.keys(map);
    const q = search.trim().toLowerCase();

    const result = {};
    divisions.forEach((division) => {
      // Preserve backend-provided ordering (it already reflects divisionOrder/leagueOrder).
      const leagues = [...(map[division] || [])];
      if (!q) {
        result[division] = leagues;
        return;
      }
      const matches = leagues.filter((l) => String(l).toLowerCase().includes(q));
      if (matches.length) result[division] = matches;
    });
    return result;
  }, [activeBlock, search]);

  return (
    <section className="rounded-3xl border border-subtle bg-card-surface shadow-md p-4">
      {/* Row 1 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-[0.16em] uppercase text-muted">
            Leaderboards{lastUpdated ? ` • Updated ${lastUpdated}` : ""}
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground leading-tight truncate" title={activeBlock?.name}>
            {activeBlock?.name || "Leaderboard"}
          </div>
          {(current.filterType !== "all" && current.filterValue) && (
            <div className="mt-1 text-xs text-muted">
              Filter: <span className="text-foreground font-semibold">{String(current.filterValue)}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          {/* Years */}
          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
            {years.map((year) => (
              <Chip
                key={year}
                active={current.year === year}
                onClick={() => handleSelect({ year, filterType: "all", filterValue: null })}
              >
                {year}
              </Chip>
            ))}
          </div>

          {/* Modes + Weekly */}
          <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
            {Object.keys(data?.[current.year] || {}).filter((modeKey) => !String(modeKey).startsWith("__")).length > 0 &&
              Object.keys(data[current.year] || {}).filter((modeKey) => !String(modeKey).startsWith("__")).map((modeKey) => {
                const val = data?.[current.year]?.[modeKey];
                const label = shortModeName(val, modeKey);
                const order = { big_game: 1, mini_game: 2, redraft_2025: 3, redraft: 3, gauntlet: 4, dynasty: 5 };
                return { modeKey, label, order: order[modeKey] ?? 99 };
              })
                .sort((a, b) => a.order - b.order || a.modeKey.localeCompare(b.modeKey))
                .map(({ modeKey, label }) => (
                  <Chip
                    key={modeKey}
                    active={activeMode === modeKey}
                    onClick={() => handleSelect({ mode: modeKey, filterType: "all", filterValue: null })}
                  >
                    {label}
                  </Chip>
                ))}

            <button
              onClick={() => setShowWeeks(!showWeeks)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                showWeeks
                  ? "bg-accent/15 border-accent/40 text-foreground"
                  : "bg-panel/40 border-subtle text-muted hover:border-accent/30 hover:text-foreground"
              }`}
              title="Toggle weekly columns"
              aria-pressed={showWeeks}
            >
              Weekly
              <span
                className={`inline-block w-9 h-4 rounded-full p-[2px] transition ${
                  showWeeks ? "bg-foreground/80" : "bg-muted/30"
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-card-surface transform transition ${
                    showWeeks ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Division/League picker */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isRedraft2025 || !activeBlock?.divisions?.length}
          onClick={() => {
            setSearch("");
            setOpenSheet("divisions");
          }}
          className={`flex-1 min-w-[140px] px-3 py-2 rounded-xl text-sm font-semibold border transition ${
            isRedraft2025 || !activeBlock?.divisions?.length
              ? "bg-panel/40 text-muted border-subtle cursor-not-allowed opacity-60"
              : "bg-panel border-subtle text-foreground hover:border-accent/40"
          }`}
          title={isRedraft2025 ? "No Divisions" : isGauntlet ? "Browse Legions" : "Browse Divisions"}
        >
          {isRedraft2025 ? "No Divisions" : isGauntlet ? "Legions" : "Divisions"}
        </button>

        <button
          type="button"
          disabled={!activeBlock?.leaguesByDivision}
          onClick={() => {
            setSearch("");
            setOpenSheet("leagues");
          }}
          className={`flex-1 min-w-[140px] px-3 py-2 rounded-xl text-sm font-semibold border transition ${
            !activeBlock?.leaguesByDivision
              ? "bg-panel/40 text-muted border-subtle cursor-not-allowed opacity-60"
              : "bg-panel border-subtle text-foreground hover:border-accent/40"
          }`}
          title="Browse Leagues"
        >
          Leagues
        </button>

        {current.filterType !== "all" && (
          <button
            type="button"
            onClick={resetFilter}
            className="shrink-0 px-3 py-2 rounded-xl text-sm font-semibold bg-accent/15 border border-accent/40 text-foreground hover:bg-accent/20 transition"
            title="Clear filter"
          >
            Reset
          </button>
        )}
      </div>

      <Sheet
        open={!!openSheet}
        title={
          openSheet === "divisions"
            ? isGauntlet
              ? "Legions"
              : "Divisions"
            : openSheet === "leagues"
            ? "Leagues"
            : ""
        }
        onClose={() => {
          setOpenSheet(null);
          setSearch("");
        }}
        search={search}
        setSearch={setSearch}
      >
        {openSheet === "divisions" && (
          <div className="divide-y divide-subtle">
            {filteredDivisions.length === 0 && <EmptyState msg="No matches found." />}
            {filteredDivisions.map((div) => (
              <button
                key={div}
                className="w-full text-left px-4 py-3 hover:bg-panel/60 transition"
                onClick={() => handleSelect({ filterType: "division", filterValue: div })}
              >
                <div className="text-sm text-foreground font-semibold">{div}</div>
                <div className="text-xs text-muted">{isGauntlet ? "Legion" : "Division"}</div>
              </button>
            ))}
          </div>
        )}

        {openSheet === "leagues" && (
          <div className="space-y-6">
            {Object.keys(filteredLeaguesByDivision).length === 0 && (
              <EmptyState msg="No leagues match your search." />
            )}
            {Object.entries(filteredLeaguesByDivision).map(([division, leagues]) => (
              <div key={division} className="border border-subtle rounded-2xl overflow-hidden">
                <div className="px-4 py-2 bg-panel/60 text-foreground text-sm font-semibold">
                  {division}
                </div>
                <div className="divide-y divide-subtle">
                  {leagues.map((league) => (
                    <button
                      key={league}
                      className="w-full text-left px-4 py-3 hover:bg-panel/60 transition"
                      onClick={() => handleSelect({ filterType: "league", filterValue: league })}
                    >
                      <div className="text-sm text-foreground font-semibold">{league}</div>
                      <div className="text-xs text-muted">League</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </section>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap border ${
        active
          ? "bg-accent/15 border-accent/40 text-foreground"
          : "bg-panel/40 border-subtle text-muted hover:border-accent/30 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Sheet({ open, title, onClose, children, search, setSearch }) {
  // Lock body + ESC to close (runs only when open)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sheetUI = (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-[9999] flex items-end md:items-center md:justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-full md:max-w-3xl bg-card-surface border border-subtle shadow-2xl overflow-hidden rounded-t-3xl md:rounded-3xl flex flex-col"
          style={{ maxHeight: "82vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
            <button
              onClick={onClose}
              className="shrink-0 w-9 h-9 grid place-items-center rounded-xl bg-panel/60 text-foreground hover:bg-panel transition"
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
            <div className="text-foreground font-semibold">{title}</div>
          </div>

          <div className="p-4 border-b border-subtle">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${String(title).toLowerCase()}…`}
                className="w-full bg-panel/40 border border-subtle rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              {!!search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs"
                  aria-label="Clear"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div
            className="px-4 pb-6 overflow-y-auto min-h flex-1 md:max-h-[90vh]"
            style={{ maxHeight: "90vh", WebkitOverflowScrolling: "touch" }}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );

  // Render above everything (fixes embed z-index issues)
  return createPortal(sheetUI, document.body);
}

function EmptyState({ msg }) {
  return <div className="text-center text-muted py-10 text-sm">{msg}</div>;
}

function formatStatValue(value) {
  if (value == null || value === "") return "-";
  const num = Number(value);
  if (Number.isFinite(num)) return num.toLocaleString();
  return String(value);
}

function SummaryChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-subtle bg-panel/35 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.24em] text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{formatStatValue(value)}</div>
    </div>
  );
}

function getModeOwnerLabel(card) {
  const rawName = String(card?.name || card?.key || "mode").trim();
  const cleaned = rawName.replace(/^\d{4}\s+/, "").trim() || "Mode";
  return `Unique ${cleaned} owners`;
}

function ModeMiniCard({ card }) {
  const draftedTeamsOutOf = `${formatStatValue(card?.draftedTeams)}/${formatStatValue(card?.totalRosterSlots)}`;
  const leaguesDraftedOutOf = `${formatStatValue(card?.draftedLeagues)}/${formatStatValue(card?.totalLeagues)}`;
  const draftingLeaguesOutOf = `${formatStatValue(card?.draftingLeagues)}/${formatStatValue(card?.totalLeagues)}`;
  const veteran = card?.draftTypeBreakdown?.veteran || null;
  const rookie = card?.draftTypeBreakdown?.rookie || null;

  return (
    <div className="rounded-2xl border border-subtle bg-panel/30 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-accent">{card?.name || card?.key || "Mode"}</div>
      <div className="mt-3 space-y-2 text-sm text-muted">
        {veteran || rookie ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span>Veteran leagues drafted</span>
              <span className="font-semibold text-foreground">
                {formatStatValue(veteran?.draftedLeagues)}/{formatStatValue(veteran?.totalLeagues)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Veteran teams drafted</span>
              <span className="font-semibold text-foreground">
                {formatStatValue(veteran?.draftedTeams)}/{formatStatValue(veteran?.totalRosterSlots)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Rookie leagues drafted</span>
              <span className="font-semibold text-foreground">
                {formatStatValue(rookie?.draftedLeagues)}/{formatStatValue(rookie?.totalLeagues)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Rookie teams drafted</span>
              <span className="font-semibold text-foreground">
                {formatStatValue(rookie?.draftedTeams)}/{formatStatValue(rookie?.totalRosterSlots)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Drafting leagues</span>
              <span className="font-semibold text-foreground">{draftingLeaguesOutOf}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{getModeOwnerLabel(card)}</span>
              <span className="font-semibold text-foreground">{formatStatValue(card?.uniqueOwnersOnceDrafted)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span>Drafted teams</span>
              <span className="font-semibold text-foreground">{draftedTeamsOutOf}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Leagues drafted</span>
              <span className="font-semibold text-foreground">{leaguesDraftedOutOf}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Drafting leagues</span>
              <span className="font-semibold text-foreground">{draftingLeaguesOutOf}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{getModeOwnerLabel(card)}</span>
              <span className="font-semibold text-foreground">{formatStatValue(card?.uniqueOwnersOnceDrafted)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OwnerYearComparisonCard({ item }) {
  if (!item || !Array.isArray(item.comparisons) || item.comparisons.length === 0) return null;

  return (
    <div className="rounded-2xl border border-subtle bg-panel/30 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-accent">{item.year} owner movement</div>
      <div className="mt-3 space-y-3 text-sm text-muted">
        {item.comparisons.map((comparison) => (
          <div
            key={`${item.year}-${comparison.compareYear}`}
            className="rounded-2xl border border-subtle bg-panel/35 px-3 py-3"
          >
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted">vs {comparison.compareYear}</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span>Returned</span>
              <span className="font-semibold text-foreground">{formatStatValue(comparison.returned)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span>New</span>
              <span className="font-semibold text-foreground">{formatStatValue(comparison.newOwners)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopOwnersMiniBoard({ item, expanded, onToggle }) {
  const sourceRows = Array.isArray(item?.rows) ? item.rows : [];
  const rows = expanded ? sourceRows.slice(0, 10) : sourceRows.slice(0, 3);

  return (
    <div className="rounded-2xl border border-subtle bg-panel/30 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-accent">{item?.name || item?.key || "Mode leaders"}</div>
      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-muted">No owner leaderboard yet.</div>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <div key={`${item?.key || "mode"}-${row.ownerName}-${index}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.22em] text-muted">#{index + 1}</div>
                <div className="truncate text-sm font-semibold text-foreground">{row.ownerName}</div>
              </div>
              <div className="text-right text-xs text-muted">
                <div>{formatStatValue(row.teamCount)} teams</div>
                <div>{formatStatValue(row.draftedTeamCount)} drafted</div>
                {Number(row.draftingTeamCount || 0) > 0 ? <div>{formatStatValue(row.draftingTeamCount)} drafting</div> : null}
                {Number(row.preDraftTeamCount || 0) > 0 ? <div>{formatStatValue(row.preDraftTeamCount)} pre-draft</div> : null}
                {row.averageTotal != null && row.hasPointData !== false ? (
                  <div>{formatStatValue(row.averageTotal)} avg points</div>
                ) : (
                  <div>No scored teams yet</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {sourceRows.length > 3 ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-accent transition hover:text-accent/80"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

/* ---------------- Table (existing leaderboard UI) ---------------- */

function LeaderboardTable({ data, year, category, basePath, showWeeks, setShowWeeks, filterType, filterValue }) {
  const { statsByYear } = useLeaderboard();
  const yearSummary = statsByYear?.[year] || {};
  const {
    draftedTeams = 0,
    draftedUniqueOwners = 0,
    draftingTeams = null,
    uniqueOwnersOnceDrafted = null,
    openDraftSlots = null,
    totalRosterSlots = null,
    totalLeagues = null,
    draftedLeagues = null,
    modeCards = [],
    topOwnersByMode = {},
    ownerYearComparisons = [],
  } = yearSummary;

  const norm = (s) => String(s || "").toLowerCase().trim();

  const filterOwnersByDivisionOrLeague = useMemo(() => {
    const t = String(filterType || "all");
    const v = filterValue == null ? "" : String(filterValue);
    const qv = norm(v);

    if (t === "division" && qv) {
      return (o) => {
        const dv = norm(o?.division ?? o?.divisionName ?? o?.theme_name ?? o?.themeName ?? "");
        return dv === qv;
      };
    }
    if (t === "league" && qv) {
      return (o) => {
        const lv = norm(o?.leagueName ?? o?.league ?? o?.name ?? "");
        return lv === qv;
      };
    }
    return () => true;
  }, [filterType, filterValue]);

  // Build a globally-ranked list (always from ALL owners, so Global Rank stays meaningful)
  const rankedOwners = useMemo(() => {
    const owners = Array.isArray(data?.owners) ? data.owners : [];
    const list = [...owners].sort(
      (a, b) =>
        Number(b?.total || 0) - Number(a?.total || 0) ||
        String(a?.ownerName || "").localeCompare(String(b?.ownerName || "")) ||
        String(a?.leagueName || "").localeCompare(String(b?.leagueName || ""))
    );
    return list.map((o, i) => ({ ...o, globalRank: i + 1 }));
  }, [data]);

  const scopedOwners = useMemo(() => {
    return rankedOwners.filter(filterOwnersByDivisionOrLeague);
  }, [rankedOwners, filterOwnersByDivisionOrLeague]);

  // -------- Owner Search ----------
  const [query, setQuery] = useState("");
  const [focusSuggest, setFocusSuggest] = useState(false);
  const [showMoreStats, setShowMoreStats] = useState(false);
  const [expandedBoards, setExpandedBoards] = useState({});
  const inputRef = useRef(null);

  const q = norm(query);

  // -------- Weekly sort/filter ----------
  const [weeklySortWeek, setWeeklySortWeek] = useState(null); // number | null
  const [weeklySortDir, setWeeklySortDir] = useState("desc"); // "asc" | "desc"

  // Suggestions / filtered list
  const filteredOwners = useMemo(() => {
    let base = !q ? scopedOwners : scopedOwners.filter((o) => norm(o.ownerName).includes(q));

    // When in weeks view and a sort week is selected, sort by that week's score
    if (showWeeks && weeklySortWeek != null) {
      const w = weeklySortWeek;
      base = [...base].sort((a, b) => {
        const av = typeof a.weekly?.[w] === "number" ? a.weekly[w] : -Infinity;
        const bv = typeof b.weekly?.[w] === "number" ? b.weekly[w] : -Infinity;
        if (av === bv) return (a.globalRank || 0) - (b.globalRank || 0);
        return weeklySortDir === "asc" ? av - bv : bv - av;
      });
    }
    return base;
  }, [q, scopedOwners, showWeeks, weeklySortWeek, weeklySortDir, norm]);

  const ownerSuggestions = useMemo(() => {
    if (!q) return [];
    const names = Array.from(new Set(scopedOwners.map((o) => o.ownerName)));
    const starts = names.filter((n) => norm(n).startsWith(q));
    const includes = names.filter((n) => !norm(n).startsWith(q) && norm(n).includes(q));
    return [...starts, ...includes].slice(0, 8);
  }, [q, scopedOwners]);

  const orderedModeCards = useMemo(() => {
    const cards = Array.isArray(modeCards)
      ? modeCards.filter((card) => card && !String(card?.key || "").startsWith("__"))
      : [];
    return [...cards].sort((a, b) => {
      if (a?.key === category) return -1;
      if (b?.key === category) return 1;
      return String(a?.name || a?.key || "").localeCompare(String(b?.name || b?.key || ""));
    });
  }, [category, modeCards]);

  const topOwnerBoards = useMemo(() => {
    return Object.values(topOwnersByMode || {})
      .filter((item) => item && !String(item?.key || "").startsWith("__"))
      .sort((a, b) => {
        if (a?.key === category) return -1;
        if (b?.key === category) return 1;
        return String(a?.name || a?.key || "").localeCompare(String(b?.name || b?.key || ""));
      });
  }, [category, topOwnersByMode]);

  const clearQuery = () => setQuery("");
  const draftingTeamsOutOf =
    totalRosterSlots == null ? draftingTeams : `${Number(draftingTeams || 0)}/${Number(totalRosterSlots || 0)}`;
  const leaguesDraftedOutOf =
    totalLeagues == null ? draftedLeagues : `${Number(draftedLeagues || 0)}/${Number(totalLeagues || 0)}`;
  const orderedOwnerYearComparisons = useMemo(() => {
    return Array.isArray(ownerYearComparisons) ? [...ownerYearComparisons] : [];
  }, [ownerYearComparisons]);
  const currentOwnerYearComparison = useMemo(() => {
    return orderedOwnerYearComparisons.find((item) => String(item?.year) === String(year)) || null;
  }, [orderedOwnerYearComparisons, year]);

  // -------- Pagination ----------
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    setPage(1); // reset to page 1 whenever filter changes
  }, [q, year, category, filterType, filterValue]);

  useEffect(() => {
    setExpandedBoards({});
  }, [year, category]);

  // -------- Weekly data (per-year) ----------
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [selectedRoster, setSelectedRoster] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [visibleWeeksStart, setVisibleWeeksStart] = useState(0);
  const weeklyCache = useRef({}); // cache per year

  // Reset weeks pager & weekly sort when year/mode/toggle changes
  useEffect(() => {
    setVisibleWeeksStart(0);
  }, [year, category, showWeeks]);
  useEffect(() => {
    setWeeklySortWeek(null);
  }, [year, category, showWeeks]);

  const sumPoints = (arr = []) =>
    arr.reduce(
      (s, p) => s + Number(p?.points ?? p?.pts ?? p?.score ?? p?.value ?? 0),
      0
    );

  // When Weekly is turned on and weeklyData is ready, jump pager to latest non-zero week
  useEffect(() => {
    if (!showWeeks || !weeklyData) return;

    const weeks = Array.isArray(data.weeks) ? [...data.weeks] : [];
    if (!weeks.length) return;

    // Descending: newest → oldest
    weeks.sort((a, b) => b - a);

    // Does ANY owner have non-zero points this week?
    const ownerHasPoints = (wk) => {
      for (const o of scopedOwners) {
        // 1) Use precomputed weekly totals on the owner if available
        const val = typeof o.weekly?.[wk] === "number" ? o.weekly[wk] : null;
        if (val != null && val > 0) return true;

        // 2) Fallback to roster records in weeklyData
        const leagueWeeks = weeklyData[year]?.[category]?.[o.leagueName] || {};
        const recArr = leagueWeeks[wk] || [];
        const rec = recArr.find((r) => r.ownerName === o.ownerName);
        if (rec) {
          const total = sumPoints(rec.starters) + sumPoints(rec.bench);
          if (total > 0) return true;
        }
      }
      return false;
    };

    let targetWeek = null;
    for (const wk of weeks) {
      if (ownerHasPoints(wk)) {
        targetWeek = wk;
        break;
      }
    }
    if (targetWeek == null) return;

    // Position pager so targetWeek is visible in the WEEKS_WINDOW
    const start = Math.floor((targetWeek - 1) / WEEKS_WINDOW) * WEEKS_WINDOW;
    setVisibleWeeksStart(start);
  }, [showWeeks, weeklyData, year, category, scopedOwners, data.weeks]);

  // Helper: load weekly data
  const loadWeeklyDataForYear = async () => {
    if (weeklyCache.current[year]) {
      setWeeklyData(weeklyCache.current[year]);
      return weeklyCache.current[year];
    }
    try {
      const base = (basePath || "/r2/data/leaderboards").replace(/\/$/, "");
      const manRes = await fetch(`${base}/weekly_manifest_${year}.json`, { cache: "no-store" });
      if (!manRes.ok) return null;

      const manifest = await manRes.json(); // { parts: [...] }
      let combined = {};
      for (const part of manifest.parts || []) {
        const url = `${base}/${part}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const chunk = await res.json();
        for (const y in chunk) {
          combined[y] = combined[y] || {};
          for (const mode in chunk[y]) {
            combined[y][mode] = combined[y][mode] || {};
            Object.assign(combined[y][mode], chunk[y][mode]);
          }
        }
      }
      weeklyCache.current[year] = combined;
      setWeeklyData(combined);
      return combined;
    } catch {
      return null;
    }
  };

  // Only auto-load when Weekly is ON; otherwise lazy-load on click
  useEffect(() => {
    let ignore = false;
    const go = async () => {
      if (!showWeeks) {
        if (weeklyCache.current[year] && !ignore) setWeeklyData(weeklyCache.current[year]);
        return;
      }
      const d = await loadWeeklyDataForYear();
      if (!ignore && d) setWeeklyData(d);
    };
    go();
    return () => {
      ignore = true;
    };
  }, [showWeeks, year, category]);

  const handleWeeklyClick = (owner, week) => {
    if (!weeklyData) return;
    const leagueData = weeklyData[year]?.[category]?.[owner.leagueName]?.[week];
    if (!leagueData) return;
    const match = leagueData.find((r) => r.ownerName === owner.ownerName);
    if (match) {
      setSelectedOwner(owner);
      setSelectedRoster({ week, starters: match.starters, bench: match.bench });
    }
  };

  const handleRowClickLatest = async (owner) => {
    let wd = weeklyData;
    if (!wd) {
      wd = await loadWeeklyDataForYear();
      if (!wd) return;
    }

    const weeks = Array.isArray(data.weeks) ? [...data.weeks] : [];
    weeks.sort((a, b) => b - a);

    const mostRecentNonZero = weeks.find((wk) => {
      const val = typeof owner.weekly?.[wk] === "number" ? owner.weekly[wk] : null;
      if (val != null && val > 0) return true;

      const leagueData = wd[year]?.[category]?.[owner.leagueName]?.[wk];
      const match = leagueData?.find((r) => r.ownerName === owner.ownerName);
      if (!match) return false;
      const total = sumPoints(match.starters) + sumPoints(match.bench);
      return total > 0;
    });

    const week = mostRecentNonZero ?? weeks[0];
    if (!week) return;

    const leagueData = wd[year]?.[category]?.[owner.leagueName]?.[week];
    const match = leagueData?.find((r) => r.ownerName === owner.ownerName);
    if (!match) return;

    setSelectedOwner(owner);
    setSelectedRoster({ week, starters: match.starters, bench: match.bench });
  };

  // Visible weeks in window
  const weeks = useMemo(() => {
    const w = Array.isArray(data.weeks) ? [...data.weeks] : [];
    return w.sort((a, b) => a - b);
  }, [data.weeks]);
  const currentWeeks = useMemo(() => {
    if (!weeks.length) return [];
    return weeks.slice(visibleWeeksStart, visibleWeeksStart + WEEKS_WINDOW);
  }, [weeks, visibleWeeksStart]);

  // Pagination slices
  const totalPages = Math.max(1, Math.ceil(filteredOwners.length / itemsPerPage));
  const currentOwners = filteredOwners.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const showLeagueColumn = useMemo(() => {
    // If we're in a league filter, league column is redundant
    if (filterType === "league") return false;
    return true;
  }, [filterType]);

  return (
    <div className="rounded-3xl border border-subtle bg-card-surface shadow-md p-4">
      {/* Stats */}
      <div className="mb-4 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryChip label="Drafted Teams" value={draftedTeams} />
            <SummaryChip label="Drafted Unique Owners" value={draftedUniqueOwners} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setShowMoreStats((prev) => !prev)}
              className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:border-accent/50 hover:bg-accent/15"
            >
              {showMoreStats ? "Hide more stats" : "More stats"}
            </button>

            <div className="relative w-full sm:min-w-[320px] sm:max-w-sm">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocusSuggest(true)}
                onBlur={() => setTimeout(() => setFocusSuggest(false), 120)}
                className="w-full rounded-xl border border-subtle bg-panel/40 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="Search owner..."
              />
              {!!query && (
                <button
                  type="button"
                  onClick={clearQuery}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs"
                  aria-label="Clear"
                >
                  Clear
                </button>
              )}

              {focusSuggest && ownerSuggestions.length > 0 && (
                <div className="absolute mt-2 w-full rounded-2xl border border-subtle bg-card-surface shadow-xl overflow-hidden z-10">
                  {ownerSuggestions.map((name) => (
                    <button
                      type="button"
                      key={name}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-panel/60 transition"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setQuery(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {showMoreStats && (
          <div className="rounded-3xl border border-subtle bg-subtle-surface/35 p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <SummaryChip label="Drafting Teams" value={draftingTeamsOutOf} />
              <SummaryChip label="Unique Owners Once Drafted" value={uniqueOwnersOnceDrafted} />
              <SummaryChip label="Open Draft Slots" value={openDraftSlots} />
              <SummaryChip label="Tracked Leagues" value={totalLeagues} />
              <SummaryChip label="Leagues Drafted" value={leaguesDraftedOutOf} />
            </div>

            {currentOwnerYearComparison && Array.isArray(currentOwnerYearComparison.comparisons) && currentOwnerYearComparison.comparisons.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-accent">Owner movement by year</div>
                <div className="mt-2 text-xs text-muted">
                  Returned counts are drafted owners shared by both years. New counts are owners in that year who were not in the compared earlier year.
                </div>
                <div className="mt-3">
                  <OwnerYearComparisonCard item={currentOwnerYearComparison} />
                </div>
              </div>
            )}

            {orderedModeCards.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-accent">Mode snapshots</div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {orderedModeCards.map((card) => (
                    <ModeMiniCard key={card.key || card.name} card={card} />
                  ))}
                </div>
              </div>
            )}

            {topOwnerBoards.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-[0.28em] text-accent">Top owners by mode</div>
                <div className="mt-2 text-xs text-muted">
                  Includes drafted, drafting, and pre-draft leagues. Expand any board to see more owners.
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {topOwnerBoards.map((item) => (
                    <TopOwnersMiniBoard
                      key={item.key || item.name}
                      item={item}
                      expanded={Boolean(expandedBoards[item.key || item.name])}
                      onToggle={() =>
                        setExpandedBoards((prev) => ({
                          ...prev,
                          [item.key || item.name]: !prev[item.key || item.name],
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Weekly navigation */}
      {showWeeks && weeks.length > WEEKS_WINDOW && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            type="button"
            onClick={() => setVisibleWeeksStart((s) => Math.max(0, s - WEEKS_WINDOW))}
            disabled={visibleWeeksStart === 0}
            className="px-3 py-2 rounded-xl border border-subtle bg-panel/40 text-foreground hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev Weeks
          </button>

          <div className="text-xs text-muted">
            Showing weeks {currentWeeks[0]}-{currentWeeks[currentWeeks.length - 1]}
          </div>

          <button
            type="button"
            onClick={() =>
              setVisibleWeeksStart((s) => Math.min(weeks.length - WEEKS_WINDOW, s + WEEKS_WINDOW))
            }
            disabled={visibleWeeksStart + WEEKS_WINDOW >= weeks.length}
            className="px-3 py-2 rounded-xl border border-subtle bg-panel/40 text-foreground hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Weeks
          </button>
        </div>
      )}

      {/* Weekly sort options */}
      {showWeeks && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {weeklySortWeek != null && (
            <button
              type="button"
              onClick={() => {
                setWeeklySortWeek(null);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-panel/60 border border-subtle text-foreground hover:border-accent/30"
            >
              Clear Weekly Sort
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-subtle">
        <table className="w-full text-sm">
          <thead className="bg-panel/60 text-muted">
            <tr>
              <th className="p-2 text-left">Rank</th>
              <th className="p-2 text-left">Owner</th>
              <th className="p-2 text-left">Slot</th>
              {showLeagueColumn && <th className="p-2 text-left">League</th>}
              {showWeeks &&
                currentWeeks.map((w) => (
                  <th key={w} className="p-2 text-center">
                    <button
                      type="button"
                      className="px-2 py-1 rounded-lg bg-panel/60 hover:bg-panel border border-subtle text-xs"
                      onClick={() => {
                        if (weeklySortWeek === w) {
                          setWeeklySortDir((d) => (d === "desc" ? "asc" : "desc"));
                        } else {
                          setWeeklySortWeek(w);
                          setWeeklySortDir("desc");
                        }
                      }}
                      title="Sort by this week's points"
                    >
                      W{w}
                      {weeklySortWeek === w ? (weeklySortDir === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
              <th className="p-2 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {currentOwners.map((o, idx) => (
              <tr
                key={`${o.ownerName}-${idx}`}
                className="border-t border-subtle hover:bg-panel/40 cursor-pointer"
                onClick={() => {
                  if (showWeeks) return; // weekly cells have their own click handler
                  handleRowClickLatest(o);
                }}
              >
                <td className="p-2">{o.globalRank}</td>
                <td className="p-2 font-semibold text-foreground">{o.ownerName}</td>
                <td className="p-2 text-muted">{o.draftSlot ? `(${o.draftSlot})` : "-"}</td>
                {showLeagueColumn && <td className="p-2 text-muted">{o.leagueName}</td>}
                {showWeeks &&
                  currentWeeks.map((w) => (
                    <td
                      key={w}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWeeklyClick(o, w);
                      }}
                      className="p-2 text-center text-foreground hover:bg-accent/10 rounded-lg transition"
                      title="Click for roster details"
                    >
                      {typeof o.weekly?.[w] === "number" ? o.weekly[w].toFixed(2) : "-"}
                    </td>
                  ))}
                <td className="p-2 font-bold text-foreground">{o.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-4 mt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-subtle bg-panel/40 hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <div className="px-3 py-2 text-sm text-muted">Page {page} of {totalPages}</div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl border border-subtle bg-panel/40 hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Owner modal (weekly details) */}
      {selectedOwner && selectedRoster && (
        <OwnerModal
          owner={selectedOwner}
          selectedRoster={selectedRoster}
          onClose={() => {
            setSelectedOwner(null);
            setSelectedRoster(null);
          }}
          allOwners={data.owners}
          year={year}
          mode={category}
          basePath="/data"
        />
      )}
    </div>
  );
}
