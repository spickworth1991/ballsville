"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const POSITION_STYLES = {
  QB: "border-red-400/30 bg-red-500/15 text-red-300",
  RB: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  WR: "border-sky-400/30 bg-sky-500/15 text-sky-300",
  TE: "border-orange-400/30 bg-orange-500/15 text-orange-300",
  FLEX: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  WRT: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  "WR/RB/TE": "border-amber-400/30 bg-amber-500/15 text-amber-300",
  K: "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-300",
  DEF: "border-violet-400/30 bg-violet-500/15 text-violet-300",
  DST: "border-violet-400/30 bg-violet-500/15 text-violet-300",
  BN: "border-slate-300/30 bg-slate-400/15 text-slate-200",
};

const toNum = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function positionLabel(left, right) {
  const raw = left?.slot || right?.slot || left?.pos || right?.pos || "FLEX";
  const label = String(raw).toUpperCase();
  return ["BN", "BENCH"].includes(label) ? (left?.pos || right?.pos || "BN").toUpperCase() : label;
}

function slotLetters(position) {
  const slots = {
    FLEX: ["W", "R", "T"],
    RB_WR_TE_FLEX: ["W", "R", "T"],
    WR_RB_FLEX: ["W", "R"],
    REC_FLEX: ["W", "T"],
    WR_TE_FLEX: ["W", "T"],
    SUPER_FLEX: ["W", "R", "T", "Q"],
  };
  return slots[position] || null;
}

const LETTER_STYLES = {
  W: "text-sky-300",
  R: "text-emerald-300",
  T: "text-orange-300",
  Q: "text-red-300",
};

function PositionBadge({ position }) {
  const letters = slotLetters(position);
  if (letters) {
    const superflex = position === "SUPER_FLEX";
    return (
      <span className={`${superflex ? "inline-grid grid-cols-2 leading-[0.7rem]" : "inline-flex"} min-w-8 items-center justify-center rounded-lg border border-white/15 bg-black/25 px-1.5 py-1 text-[10px] font-black tracking-tight shadow-inner`}>
        {letters.map((letter) => <span key={letter} className={LETTER_STYLES[letter]}>{letter}</span>)}
      </span>
    );
  }
  return (
    <span className={`inline-flex min-w-8 items-center justify-center rounded-lg border px-1.5 py-1 text-[10px] font-black uppercase tracking-wide ${POSITION_STYLES[position] || POSITION_STYLES.FLEX}`}>
      {position}
    </span>
  );
}

function PlayerAvatar({ player }) {
  if (!player?.id) return null;
  return (
    <img
      src={`https://sleepercdn.com/content/nfl/players/thumb/${encodeURIComponent(player.id)}.jpg`}
      alt=""
      loading="lazy"
      className="h-8 w-8 shrink-0 rounded-full border border-subtle bg-panel object-cover object-top sm:h-10 sm:w-10"
      onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
    />
  );
}

function ManagerAvatar({ avatar, name }) {
  const initial = String(name || "?").trim().charAt(0).toUpperCase();
  return avatar ? (
    <img
      src={`https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(avatar)}`}
      alt=""
      loading="lazy"
      className="h-10 w-10 shrink-0 rounded-full border-2 border-accent/40 bg-panel object-cover shadow-md sm:h-12 sm:w-12"
    />
  ) : (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-accent/30 bg-accent/10 text-sm font-black text-accent sm:h-12 sm:w-12">
      {initial}
    </span>
  );
}

function PlayerCell({ player, align = "left" }) {
  if (!player) return <div />;
  const rightAligned = align === "right";
  return (
    <div className={`flex min-w-0 items-center gap-2 ${rightAligned ? "justify-end text-right" : "text-left"}`}>
      {!rightAligned && <PlayerAvatar player={player} />}
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-foreground sm:text-sm" title={player.name}>{player.name}</div>
        <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wide text-muted">
          {player.team || "FA"} · {player.pos || "—"}
        </div>
      </div>
      {rightAligned && <PlayerAvatar player={player} />}
    </div>
  );
}

function ScoreMarker({ left, right }) {
  return (
    <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1 text-[11px] font-black tabular-nums text-foreground sm:text-xs">
      <span className="text-right">{left ? toNum(left.points).toFixed(2) : "—"}</span>
      <span aria-hidden="true" className="text-[10px] text-accent">🏈</span>
      <span>{right ? toNum(right.points).toFixed(2) : "—"}</span>
    </div>
  );
}

function LineupComparison({ left, right, bench = false }) {
  const rows = Math.max(left?.length || 0, right?.length || 0);
  return (
    <div className="divide-y divide-subtle overflow-hidden rounded-2xl border border-subtle bg-panel/25">
      {Array.from({ length: rows }, (_, index) => {
        const leftPlayer = left?.[index];
        const rightPlayer = right?.[index];
        const position = positionLabel(leftPlayer, rightPlayer);
        return (
          <div key={`${leftPlayer?.id || "left"}-${rightPlayer?.id || "right"}-${index}`} className="grid grid-cols-[minmax(0,1fr)_82px_minmax(0,1fr)] items-center gap-2 px-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_104px_minmax(0,1fr)] sm:px-4">
            <PlayerCell player={leftPlayer} align="right" />
            <div className="text-center">
              <PositionBadge position={bench ? "BN" : position} />
              <ScoreMarker left={leftPlayer} right={rightPlayer} />
            </div>
            <PlayerCell player={rightPlayer} />
          </div>
        );
      })}
    </div>
  );
}

export default function OwnerModal({ owner, onClose, allOwners = [], selectedRoster = null }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); setVisible(true); }, []);
  if (!owner || !mounted) return null;

  // --- Helpers
  // Find most-recent non-zero week from owner's weekly map
  const weeklyMap = owner.weekly || {};
  const weeksDesc = Object.keys(weeklyMap)
    .map((w) => Number(w))
    .filter((w) => Number.isFinite(w))
    .sort((a, b) => b - a);

  const mostRecentNonZeroWeek = weeksDesc.find((w) => toNum(weeklyMap[w]) > 0) ?? weeksDesc[0] ?? null;

  // Do we have a "live" latestRoster with non-zero starter points?
  const latestHasPoints = Array.isArray(owner.latestRoster?.starters)
    ? owner.latestRoster.starters.some((s) => toNum(s?.points) > 0)
    : false;

  // Choose the best roster & week to show
  // Priority:
  // 1) selectedRoster (when you clicked a weekly cell)
  // 2) latestRoster if it has points
  // 3) fallback: show latestRoster list but use the mostRecentNonZeroWeek value for week label + totals
  const chosenRoster = selectedRoster || (latestHasPoints ? owner.latestRoster : owner.latestRoster || null);
  const chosenWeek =
    selectedRoster?.week ??
    (latestHasPoints ? owner.latestRoster?.week : mostRecentNonZeroWeek ?? owner.latestRoster?.week ?? null);

  // Totals
  const startersTotalNum = chosenRoster
    ? chosenRoster.starters.reduce((sum, p) => sum + toNum(p.points), 0)
    : 0;
  const benchTotalNum = chosenRoster
    ? chosenRoster.bench.reduce((sum, p) => sum + toNum(p.points), 0)
    : 0;
  const opponent = chosenRoster?.opponent || null;
  const opponentTotalNum = opponent
    ? opponent.starters.reduce((sum, p) => sum + toNum(p.points), 0)
    : 0;

  // Display total logic: prefer weekly map for the chosen week if it exists and > 0 (finalized),
  // otherwise fall back to live starters sum
  const weeklyValForChosen = chosenWeek != null ? toNum(weeklyMap[chosenWeek]) : 0;
  const displayWeekPoints = weeklyValForChosen > 0 ? weeklyValForChosen : startersTotalNum;

  // Other leagues (same owner name)
  const otherLeagues = (allOwners || [])
    .filter((o) => o.ownerName === owner.ownerName && o.leagueName !== owner.leagueName)
    .map((o) => ({ name: o.leagueName, total: toNum(o.total) }))
    .sort((a, b) => b.total - a.total);

  const modalContent = (
    <div
      className={`fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-70 flex items-center justify-center z-[9999] transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className="ballsville-scrollbar relative m-2 max-h-[92vh] w-[96%] overflow-y-auto rounded-3xl border border-subtle bg-card-surface p-3 shadow-2xl sm:max-w-3xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-1 sm:top-2 right-2 text-white text-lg sm:text-xl hover:text-red-500"
        >
          ✖
        </button>

        {/* Header */}
        <h2 className="mb-1 truncate text-center text-base font-bold text-foreground sm:text-2xl">
          {opponent ? `Week ${chosenWeek} Matchup` : owner.ownerName}
        </h2>
        <p className="text-gray-400 mb-1 sm:mb-2 text-center text-xs sm:text-base">
          League: <span className="text-indigo-400">{owner.leagueName}</span>
        </p>
        <p className="text-center mb-2 sm:mb-4 text-xs sm:text-sm">
          Draft Slot: <span className="text-yellow-400 font-bold">#{owner.draftSlot || "-"}</span>
          {"  "}|{" "}
          {chosenWeek != null ? (
            <>
              Week {chosenWeek} Points:{" "}
              <span className="text-blue-400 font-semibold">{displayWeekPoints.toFixed(2)}</span>{" "}
              <span className="text-gray-400">(Season Total: {toNum(owner.total).toFixed(2)})</span>
            </>
          ) : (
            <>
              Season Total: <span className="text-blue-400 font-semibold">{toNum(owner.total).toFixed(2)}</span>
            </>
          )}
        </p>

        {/* Roster */}
        {chosenRoster && (
          <div className="mb-3 sm:mb-6">
            {opponent ? (
              <>
                <div className="mb-3 grid grid-cols-[minmax(0,1fr)_46px_minmax(0,1fr)] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_58px_minmax(0,1fr)]">
                  <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-foreground sm:text-lg">{owner.ownerName}</div>
                      <div className="text-xl font-black tabular-nums text-accent sm:text-3xl">{startersTotalNum.toFixed(2)}</div>
                    </div>
                    <ManagerAvatar avatar={owner.avatar} name={owner.ownerName} />
                  </div>
                  <div className="pb-1 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted">VS</div>
                  <div className="flex min-w-0 items-center gap-2">
                    <ManagerAvatar avatar={opponent.avatar} name={opponent.ownerName} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-foreground sm:text-lg">{opponent.ownerName}</div>
                      <div className="text-xl font-black tabular-nums text-accent sm:text-3xl">{opponentTotalNum.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
                <h3 className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-muted">Starters</h3>
                <LineupComparison left={chosenRoster.starters} right={opponent.starters} />
                {(chosenRoster.bench.length > 0 || opponent.bench.length > 0) && (
                  <details className="mt-4 rounded-2xl border border-subtle bg-panel/20 p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.22em] text-muted">Bench</summary>
                    <div className="mt-3"><LineupComparison left={chosenRoster.bench} right={opponent.bench} bench /></div>
                  </details>
                )}
              </>
            ) : (
              <h3 className="mb-2 text-center text-sm font-semibold text-accent sm:text-lg">
                {selectedRoster
                  ? `Week ${chosenWeek} Roster`
                  : `Latest Roster${chosenWeek != null ? ` (Week ${chosenWeek})` : ""}`}
              </h3>
            )}

            {/* If the list we have is from a different week than the one whose total we’re showing, indicate it */}
            {!selectedRoster &&
              chosenWeek != null &&
              owner.latestRoster?.week != null &&
              !latestHasPoints &&
              owner.latestRoster.week !== chosenWeek && (
                <p className="text-center text-xs sm:text-sm text-white/60 mb-2">
                  Showing most recent non-zero week ({chosenWeek}) for totals; lineup list may reflect Week{" "}
                  {owner.latestRoster.week}.
                </p>
            )}

            {!opponent && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
              {/* Starters */}
              <div>
                <h4 className="font-semibold text-blue-400 mb-1 text-xs sm:text-base">Starters</h4>
                <ul className="border border-gray-700 rounded p-1 sm:p-2 space-y-0.5 sm:space-y-1 text-xs sm:text-sm max-h-28 sm:max-h-64 overflow-y-auto">
                  {chosenRoster.starters.map((p, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="truncate">{p.name}</span>
                      <span className="text-gray-400">{toNum(p.points).toFixed(2)} pts</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-1 sm:mt-2 text-right text-yellow-400 font-bold text-xs sm:text-sm">
                  Total: {startersTotalNum.toFixed(2)} pts
                </div>
              </div>

              {/* Bench */}
              <div>
                <h4 className="font-semibold text-gray-300 mb-1 text-xs sm:text-base">Bench</h4>
                <div className="border border-gray-700 rounded p-1 sm:p-2 overflow-y-auto max-h-20 sm:max-h-64">
                  <ul className="text-xs sm:text-sm space-y-0.5 sm:space-y-1">
                    {chosenRoster.bench.map((p, i) => (
                      <li key={i} className="flex justify-between">
                        <span className="truncate">{p.name}</span>
                        <span className="text-gray-400">{toNum(p.points).toFixed(2)} pts</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-1 sm:mt-2 text-right text-yellow-400 font-bold text-xs sm:text-sm">
                  Total: {benchTotalNum.toFixed(2)} pts
                </div>
              </div>
            </div>}
          </div>
        )}

        {/* Other Leagues */}
        {otherLeagues.length > 0 && (
          <div>
            <h3 className="text-sm sm:text-lg font-semibold mb-1 sm:mb-2 text-center">Other Leagues</h3>
            <div className="max-h-20 sm:max-h-32 overflow-y-auto border border-gray-700 rounded p-1 sm:p-2">
              <ul className="list-disc list-inside text-gray-300 space-y-0.5 sm:space-y-1 text-xs sm:text-base">
                {otherLeagues.map((lg, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="truncate">{lg.name}</span>
                    <span className="text-blue-400">{lg.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
