const SECTION = "joe-street-journal";
const CONTENT_KEY = "content/joe-street-journal/main.json";

const INITIAL_CONTENT = {
  schemaVersion: 1,
  branding: {
    eyebrow: "Ballsville presents",
    title: "The Joe Street",
    accent: "Journal",
    description:
      "Your front door to the Ballsville DFS League: a new lineup every week, season-long stakes, weekly cash, and Joe's running account of the action.",
  },
  links: [
    { id: "signup", label: "Apply to join", url: "https://forms.gle/613k73dmU6iSgyKD8" },
    { id: "payment", label: "Pay dues on LeagueSafe", url: "https://www.leaguesafe.com/join/4444507" },
    { id: "draftkings-referral", label: "Create a DraftKings account", url: "https://www.draftkings.com/r/JWillMayne/US-DK/US-CA" },
    { id: "draftkings-league", label: "Open Ballsville DFS Degens", url: "https://dkn.gs/r/nd9EVtj8P0CTbd5lyateaw" },
    { id: "rules", label: "Review official scoring", url: "https://www.draftkings.com/help/rules/1" },
    { id: "source", label: "View original league information", url: "https://docs.google.com/document/d/19I0M17HoNYu_zi2dcLTdrbr7lzSRzLqxQb6OAnzNRQk/edit?tab=t.0" },
    { id: "weekly", label: "Read the weekly update", url: "/joe-street-journal/weekly" },
  ],
  stats: [
    { value: "$200", label: "Entry" },
    { value: "100%", label: "Paid out" },
    { value: "17", label: "Scoring weeks" },
    { value: "Weekly", label: "Fresh lineups" },
  ],
  journey: [
    { title: "Join", text: "Submit the short interest form so Ballsville knows you're in." },
    { title: "Fund", text: "Confirmed entrants pay the $200 fee securely through LeagueSafe." },
    { title: "Compete", text: "Build a new Sunday Main Slate lineup every week on DraftKings." },
  ],
  sections: [
    {
      id: "format",
      title: "The format",
      body: "This league is played on DraftKings. Each week you'll build a brand-new lineup using DraftKings' Salary Cap format. Every player has a salary, and your job is to build the best lineup possible while staying under the cap. You're never stuck with the same team—every week is a fresh start.\n\nStandard DraftKings PPR scoring applies.",
      items: ["1 QB", "2 RB", "3 WR", "1 TE", "1 FLEX (RB/WR/TE)", "1 D/ST"],
      linkId: "rules",
    },
    {
      id: "payouts",
      title: "The prize pool",
      body: "The prize pool is 100% paid out and split between weekly prizes and season-long cumulative prizes. The final payout structure will be announced once league size is finalized.",
      items: [
        "Season-long (~60%): Top three cumulative scores win.",
        "The final season-long structure depends on league size, with a goal of paying up to the top 10 if participation allows.",
        "Weekly (40%): Weekly winners earn an estimated $100+ depending on league size.",
        "The goal is to pay up to the top three each week.",
        "Ballsville freebies may be used as bonus prizes throughout the season.",
      ],
      linkId: "",
    },
    {
      id: "schedule",
      title: "The schedule",
      body: "The official contest each week is the DraftKings Sunday Main Slate.",
      items: [
        "Weeks 1–17 count toward cumulative season standings.",
        "Week 18 is a bonus week reserved for Ballsville freebies.",
        "Every Wednesday, the upcoming contest is posted in the Ballsville Discord DFS channel.",
        "All LeagueSafe funds are paid no later than Wednesday, January 13, 2027—within three days after Week 18.",
      ],
      linkId: "",
    },
    {
      id: "commitment",
      title: "The commitment",
      body: "Season standings are cumulative. Missing one week does not eliminate you, but it creates a significant disadvantage. Missing multiple weeks will likely leave you competing only for weekly prizes. This league is built for active owners from Week 1 through Week 17.\n\nLife happens, but if you do not believe you can submit a lineup most weeks, please do not enter.",
      items: ["No refunds", "No chargebacks", "No exceptions for missed lineups"],
      calloutTitle: "Know before you enter",
      calloutText: "By paying your entry fee and joining Ballsville DFS Degens, you commit to the entire NFL season. There are no concessions for missed weeks.",
      linkId: "",
    },
  ],
  draftKings: {
    title: "New to DraftKings?",
    description: "Use Joe's referral link and complete these steps. The referral is only for first-time DraftKings users.",
    steps: [
      "Create your DraftKings account.",
      "Deposit at least $20.",
      "Enter any DraftKings contest.",
      "Join the Ballsville DFS Degens league.",
    ],
  },
  signup: {
    eyebrow: "Get on the field",
    title: "Ready to play?",
    description: "Apply first. Once your spot is confirmed, fund it through LeagueSafe and join the official DraftKings league.",
    paymentNote: "All league funds are held securely through LeagueSafe. Payment is for confirmed entrants committing to the full season.",
  },
  weekly: {
    eyebrow: "Already in the league?",
    title: "Joe's weekly desk is down the hall.",
    description: "Open the live edition for weekly updates, analysis, props, and receipts.",
  },
  disclaimer: "Participation is subject to DraftKings eligibility and local laws.",
};

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function bucket(env) {
  const value = env.ADMIN_BUCKET || env.admin_bucket;
  if (!value?.get || !value?.put) throw new Error("Missing R2 binding: ADMIN_BUCKET");
  return value;
}

async function requireAdmin({ request, env }) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Missing admin session." };
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admins = String(env.ADMIN_EMAILS || env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!url || !anon || !admins.length) return { ok: false, status: 500, error: "Admin authentication is not configured." };
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: anon, authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { ok: false, status: 401, error: "Invalid admin session." };
  const user = await res.json();
  if (!admins.includes(String(user?.email || "").toLowerCase())) {
    return { ok: false, status: 403, error: "Not an admin." };
  }
  return { ok: true };
}

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const cleanId = (v, fallback) =>
  str(v || fallback).toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

function objectText(value, fields) {
  const out = {};
  for (const field of fields) out[field] = str(value?.[field]).trim();
  return out;
}

function sanitize(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    schemaVersion: 1,
    branding: objectText(raw.branding, ["eyebrow", "title", "accent", "description"]),
    links: (Array.isArray(raw.links) ? raw.links : []).map((item, index) => ({
      id: cleanId(item?.id, `link-${index + 1}`),
      label: str(item?.label).trim(),
      url: str(item?.url).trim(),
    })).filter((item) => item.id && item.label),
    stats: (Array.isArray(raw.stats) ? raw.stats : []).map((item) => objectText(item, ["value", "label"])),
    journey: (Array.isArray(raw.journey) ? raw.journey : []).map((item) => objectText(item, ["title", "text"])),
    sections: (Array.isArray(raw.sections) ? raw.sections : []).map((item, index) => ({
      id: cleanId(item?.id, `section-${index + 1}`),
      title: str(item?.title).trim(),
      body: str(item?.body).trim(),
      items: (Array.isArray(item?.items) ? item.items : []).map(str).map((v) => v.trim()).filter(Boolean),
      calloutTitle: str(item?.calloutTitle).trim(),
      calloutText: str(item?.calloutText).trim(),
      linkId: cleanId(item?.linkId, ""),
    })).filter((item) => item.id && item.title),
    draftKings: {
      ...objectText(raw.draftKings, ["title", "description"]),
      steps: (Array.isArray(raw.draftKings?.steps) ? raw.draftKings.steps : []).map(str).map((v) => v.trim()).filter(Boolean),
    },
    signup: objectText(raw.signup, ["eyebrow", "title", "description", "paymentNote"]),
    weekly: objectText(raw.weekly, ["eyebrow", "title", "description"]),
    disclaimer: str(raw.disclaimer).trim(),
  };
}

async function read(r2) {
  const obj = await r2.get(CONTENT_KEY);
  if (!obj) return null;
  return JSON.parse(await obj.text());
}

async function write(r2, data) {
  await r2.put(CONTENT_KEY, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function manifest(r2, updatedAt) {
  await r2.put(`data/manifests/${SECTION}.json`, JSON.stringify({ section: SECTION, updatedAt }), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

export async function onRequest(context) {
  try {
    const auth = await requireAdmin(context);
    if (!auth.ok) return response({ ok: false, error: auth.error }, auth.status);
    const r2 = bucket(context.env);

    if (context.request.method === "GET") {
      let data = await read(r2);
      let initialized = false;
      if (!data) {
        const updatedAt = new Date().toISOString();
        data = { ...INITIAL_CONTENT, updatedAt };
        await write(r2, data);
        await manifest(r2, updatedAt);
        initialized = true;
      }
      return response({ ok: true, data, key: CONTENT_KEY, initialized });
    }

    if (context.request.method === "PUT" || context.request.method === "POST") {
      const body = await context.request.json().catch(() => null);
      if (!body) return response({ ok: false, error: "Invalid JSON body." }, 400);
      const updatedAt = new Date().toISOString();
      const data = { ...sanitize(body), updatedAt };
      await write(r2, data);
      await manifest(r2, updatedAt);
      return response({ ok: true, data, key: CONTENT_KEY, updatedAt });
    }

    return response({ ok: false, error: "Method Not Allowed" }, 405);
  } catch (error) {
    return response({ ok: false, error: error?.message || "Server error" }, 500);
  }
}
