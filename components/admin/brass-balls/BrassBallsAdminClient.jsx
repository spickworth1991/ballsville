"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "@/components/admin/AdminNav";
import { getSupabase } from "@/lib/supabaseClient";
import { CURRENT_SEASON } from "@/lib/season";

const num = (value) => Number(value || 0);
const emptyMatchup = () => ({ id: crypto.randomUUID(), teamA: { rosterId: "" }, teamB: null });
const emptyWeek = (week) => ({ week, label: "", matchups: [emptyMatchup()] });
const defaults = { season: CURRENT_SEASON, title: "The Brass Balls", intro: "A test game mode with custom weekly matchups.", leagueId: "", currentWeek: 1, heroImageUrl: "/photos/brass-balls/main-2026.png", secondaryImageUrl: "/photos/brass-balls/board-no-names-2026.png", actualBoardImageUrl: "/photos/brass-balls/actual-board-2026.png", youtubeId: "", weeks: [emptyWeek(1)] };

async function token() { const { data } = await getSupabase().auth.getSession(); return data?.session?.access_token || ""; }
async function api(method, season, body) {
  const response = await fetch(`/api/admin/brass-balls?season=${encodeURIComponent(season)}`, { method, headers: { ...(method === "PUT" ? { "content-type": "application/json" } : {}), authorization: `Bearer ${await token()}` }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`); return data;
}

async function uploadImage(file, section, season) {
  const form = new FormData(); form.append("file", file); form.append("section", section); form.append("season", String(season));
  const response = await fetch("/api/admin/upload", { method:"POST", headers:{ authorization:`Bearer ${await token()}` }, body:form });
  const data = await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || "Image upload failed."); return `/r2/${data.key}`;
}

export default function BrassBallsAdminClient() {
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [doc, setDoc] = useState(defaults);
  const [teams, setTeams] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => { setBusy(true); setMessage(""); try { const result = await api("GET", season); setDoc(result.data || { ...defaults, season }); } catch (error) { setDoc({ ...defaults, season }); setMessage(error.message.includes("not found") ? "No saved season yet. Start with the form below." : error.message); } finally { setBusy(false); } };
  useEffect(() => { load(); }, [season]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTeams = async () => {
    if (!doc.leagueId) return setMessage("Enter a Sleeper league ID first.");
    setBusy(true); setMessage("");
    try {
      const id = encodeURIComponent(doc.leagueId);
      const [rosters, users] = await Promise.all([fetch(`https://api.sleeper.app/v1/league/${id}/rosters`).then((r) => r.json()), fetch(`https://api.sleeper.app/v1/league/${id}/users`).then((r) => r.json())]);
      setTeams(rosters.map((roster) => { const user = users.find((row) => String(row.user_id) === String(roster.owner_id)); return { rosterId: String(roster.roster_id), username: user?.username || user?.display_name || `Roster ${roster.roster_id}`, teamName: user?.metadata?.team_name || "" }; }).sort((a,b) => a.username.localeCompare(b.username)));
      setMessage(`Loaded ${rosters.length} teams from Sleeper.`);
    } catch { setMessage("Sleeper teams could not be loaded. Check the league ID."); } finally { setBusy(false); }
  };

  const updateWeek = (index, patch) => setDoc((current) => ({ ...current, weeks: current.weeks.map((row, i) => i === index ? { ...row, ...patch } : row) }));
  const updateMatchup = (weekIndex, matchupIndex, side, rosterId) => setDoc((current) => ({ ...current, weeks: current.weeks.map((week, wi) => wi !== weekIndex ? week : { ...week, matchups: week.matchups.map((pair, mi) => mi !== matchupIndex ? pair : { ...pair, [side]: rosterId ? { rosterId } : side === "teamB" ? null : { rosterId: "" } }) }) }));
  const used = (week) => new Set(week.matchups.flatMap((pair) => [pair.teamA?.rosterId, pair.teamB?.rosterId]).filter(Boolean));
  const teamLabel = (team) => team.teamName ? `${team.teamName} · @${team.username}` : `@${team.username} · Roster ${team.rosterId}`;
  const save = async () => {
    const duplicateWeek = doc.weeks.find((week) => { const ids = week.matchups.flatMap((pair) => [pair.teamA?.rosterId, pair.teamB?.rosterId]).filter(Boolean); return new Set(ids).size !== ids.length; });
    if (!doc.leagueId) return setMessage("A Sleeper league ID is required.");
    if (duplicateWeek) return setMessage(`Week ${duplicateWeek.week} uses the same team more than once.`);
    setBusy(true); setMessage(""); try { await api("PUT", season, doc); setMessage("The Brass Balls schedule was published to R2."); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  const chooseImage = async (file, field, section) => { if(!file)return;setBusy(true);setMessage("");try{const url=await uploadImage(file,section,season);setDoc((current)=>({...current,[field]:url}));setMessage("Image uploaded. Publish the page to save its placement.");}catch(error){setMessage(error.message);}finally{setBusy(false);} };

  return <section className="section"><div className="container-site max-w-6xl space-y-7">
    <AdminNav eyebrow="Admin · Game Modes" title="The Brass Balls" description="Set the custom weekly schedule. Scores and player breakdowns come directly from Sleeper." publicHref="/brass-balls" />
    <div className="card border border-subtle bg-card-surface p-5"><div className="grid gap-4 sm:grid-cols-3"><label className="text-sm">Season<input type="number" value={season} onChange={(e)=>setSeason(num(e.target.value))} className="mt-1 w-full rounded-xl border border-subtle bg-background px-3 py-2" /></label><label className="text-sm">Current displayed week<input type="number" min="1" max="18" value={doc.currentWeek} onChange={(e)=>setDoc({...doc,currentWeek:num(e.target.value)})} className="mt-1 w-full rounded-xl border border-subtle bg-background px-3 py-2" /></label><label className="text-sm">Sleeper league ID<div className="mt-1 flex gap-2"><input value={doc.leagueId} onChange={(e)=>setDoc({...doc,leagueId:e.target.value})} className="min-w-0 flex-1 rounded-xl border border-subtle bg-background px-3 py-2" /><button type="button" onClick={loadTeams} className="btn btn-secondary">Load teams</button></div></label></div></div>
    <div className="card border border-subtle bg-card-surface p-5"><h2 className="text-xl font-semibold">Public page content</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm">Page title<input value={doc.title} onChange={(e)=>setDoc({...doc,title:e.target.value})} className="mt-1 w-full rounded-xl border border-subtle bg-background px-3 py-2" /></label><label className="text-sm">YouTube video ID<input value={doc.youtubeId} onChange={(e)=>setDoc({...doc,youtubeId:e.target.value})} placeholder="Only the ID, not the full URL" className="mt-1 w-full rounded-xl border border-subtle bg-background px-3 py-2" /></label><label className="text-sm sm:col-span-2">Explanation<textarea rows="4" value={doc.intro} onChange={(e)=>setDoc({...doc,intro:e.target.value})} className="mt-1 w-full rounded-xl border border-subtle bg-background px-3 py-2" /></label><label className="text-sm">Rules artwork<input type="file" accept="image/*" onChange={(e)=>chooseImage(e.target.files?.[0],"heroImageUrl","brass-balls-hero")} className="mt-1 block w-full rounded-xl border border-subtle bg-background px-3 py-2" /><input value={doc.heroImageUrl} onChange={(e)=>setDoc({...doc,heroImageUrl:e.target.value})} className="mt-2 w-full rounded-xl border border-subtle bg-background px-3 py-2" /></label><label className="text-sm">Game board artwork<input type="file" accept="image/*" onChange={(e)=>chooseImage(e.target.files?.[0],"secondaryImageUrl","brass-balls-secondary")} className="mt-1 block w-full rounded-xl border border-subtle bg-background px-3 py-2" /><input value={doc.secondaryImageUrl} onChange={(e)=>setDoc({...doc,secondaryImageUrl:e.target.value})} className="mt-2 w-full rounded-xl border border-subtle bg-background px-3 py-2" /></label><label className="text-sm sm:col-span-2">Current assignments artwork<input type="file" accept="image/*" onChange={(e)=>chooseImage(e.target.files?.[0],"actualBoardImageUrl","brass-balls-assignments")} className="mt-1 block w-full rounded-xl border border-subtle bg-background px-3 py-2" /><input value={doc.actualBoardImageUrl || ""} onChange={(e)=>setDoc({...doc,actualBoardImageUrl:e.target.value})} className="mt-2 w-full rounded-xl border border-subtle bg-background px-3 py-2" /></label></div></div>
    <div className="space-y-5">{doc.weeks.sort((a,b)=>num(a.week)-num(b.week)).map((week, wi) => <div key={`${week.week}-${wi}`} className="card border border-subtle bg-card-surface p-5"><div className="flex flex-wrap items-end gap-3"><label className="text-sm">Week<input type="number" min="1" max="18" value={week.week} onChange={(e)=>updateWeek(wi,{week:num(e.target.value)})} className="mt-1 w-24 rounded-xl border border-subtle bg-background px-3 py-2" /></label><label className="min-w-48 flex-1 text-sm">Optional label<input value={week.label || ""} onChange={(e)=>updateWeek(wi,{label:e.target.value})} className="mt-1 w-full rounded-xl border border-subtle bg-background px-3 py-2" /></label><button type="button" onClick={()=>setDoc({...doc,weeks:doc.weeks.filter((_,i)=>i!==wi)})} className="btn btn-secondary text-red-200">Remove week</button></div><div className="mt-4 space-y-3">{week.matchups.map((pair, mi) => <div key={pair.id || mi} className="grid gap-3 rounded-2xl border border-subtle p-4 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center"><select value={pair.teamA?.rosterId || ""} onChange={(e)=>updateMatchup(wi,mi,"teamA",e.target.value)} className="rounded-xl border border-subtle bg-background px-3 py-2"><option value="">Select a username</option>{teams.map((team)=><option key={team.rosterId} value={team.rosterId} disabled={used(week).has(team.rosterId)&&team.rosterId!==pair.teamA?.rosterId}>{teamLabel(team)}</option>)}</select><b className="text-center text-muted">VS</b><select value={pair.teamB?.rosterId || ""} onChange={(e)=>updateMatchup(wi,mi,"teamB",e.target.value)} className="rounded-xl border border-subtle bg-background px-3 py-2"><option value="">No opponent / solo</option>{teams.map((team)=><option key={team.rosterId} value={team.rosterId} disabled={used(week).has(team.rosterId)&&team.rosterId!==pair.teamB?.rosterId}>{teamLabel(team)}</option>)}</select><button type="button" onClick={()=>updateWeek(wi,{matchups:week.matchups.filter((_,i)=>i!==mi)})} className="btn btn-secondary">Remove</button></div>)}<button type="button" onClick={()=>updateWeek(wi,{matchups:[...week.matchups,emptyMatchup()]})} className="btn btn-secondary">+ Add matchup</button></div></div>)}</div>
    <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>setDoc({...doc,weeks:[...doc.weeks,emptyWeek(Math.max(0,...doc.weeks.map(row=>num(row.week)))+1)]})} className="btn btn-secondary">+ Add week</button><button type="button" onClick={save} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Publish to R2"}</button><button type="button" onClick={load} className="btn btn-secondary">Reload</button></div>{message ? <div className="rounded-xl border border-subtle bg-card-surface p-4 text-sm">{message}</div> : null}
  </div></section>;
}
