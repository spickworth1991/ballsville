import { CURRENT_SEASON } from "@/lib/season";

const json = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const text = (value) => String(value || "").trim();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const bucketFor = (env) => env.admin_bucket || env.ADMIN_BUCKET;

async function requireAdmin(context) {
  const auth = context.request.headers.get("authorization") || ""; const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok:false, status:401, error:"Missing Authorization Bearer token." };
  const env=context.env, url=env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL, key=env.SUPABASE_ANON_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admins=text(env.ADMIN_EMAILS||env.NEXT_PUBLIC_ADMIN_EMAILS).split(",").map((v)=>v.trim().toLowerCase()).filter(Boolean);
  if(!url||!key||!admins.length)return{ok:false,status:500,error:"Admin authentication is not configured."};
  const response=await fetch(`${url.replace(/\/$/,"")}/auth/v1/user`,{headers:{apikey:key,authorization:`Bearer ${token}`}}); if(!response.ok)return{ok:false,status:401,error:"Invalid session token."};
  const user=await response.json(); if(!admins.includes(text(user.email).toLowerCase()))return{ok:false,status:403,error:"Not an admin."}; return{ok:true};
}

function clean(data, season) {
  const weeks=(Array.isArray(data?.weeks)?data.weeks:[]).map((week)=>({ week:Math.max(1,Math.min(18,number(week?.week,1))), label:text(week?.label), matchups:(Array.isArray(week?.matchups)?week.matchups:[]).map((pair,index)=>({ id:text(pair?.id)||`w${number(week?.week,1)}-${index+1}`, teamA:{rosterId:text(pair?.teamA?.rosterId)}, teamB:text(pair?.teamB?.rosterId)?{rosterId:text(pair.teamB.rosterId)}:null })).filter((pair)=>pair.teamA.rosterId) })).sort((a,b)=>a.week-b.week);
  return { season:number(season,CURRENT_SEASON), title:text(data?.title)||"The Brass Balls", intro:text(data?.intro), leagueId:text(data?.leagueId), currentWeek:Math.max(1,Math.min(18,number(data?.currentWeek,1))), heroImageUrl:text(data?.heroImageUrl), secondaryImageUrl:text(data?.secondaryImageUrl), actualBoardImageUrl:text(data?.actualBoardImageUrl), youtubeId:text(data?.youtubeId), updatedAt:new Date().toISOString(), weeks };
}

export async function onRequest(context) {
  const gate=await requireAdmin(context); if(!gate.ok)return json({error:gate.error},gate.status);
  const bucket=bucketFor(context.env); if(!bucket?.get||!bucket?.put)return json({error:"Missing R2 admin bucket binding."},500);
  const url=new URL(context.request.url), season=number(url.searchParams.get("season"),CURRENT_SEASON), key=`data/brass-balls/season_${season}.json`;
  if(context.request.method==="GET"){const object=await bucket.get(key);if(!object)return json({error:"Brass Balls season not found."},404);return json({ok:true,key,data:JSON.parse(await object.text())});}
  if(context.request.method==="PUT"){const data=clean(await context.request.json(),season);await bucket.put(key,JSON.stringify(data,null,2),{httpMetadata:{contentType:"application/json; charset=utf-8",cacheControl:"no-store"}});await bucket.put(`data/manifests/brass-balls_${season}.json`,JSON.stringify({section:"brass-balls",season,updatedAt:data.updatedAt},null,2),{httpMetadata:{contentType:"application/json; charset=utf-8"}});return json({ok:true,key,data});}
  return json({error:"Method not allowed."},405);
}
