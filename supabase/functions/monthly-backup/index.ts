// Emails a full backup (JSON) + reports sheet (CSV). Runs monthly from pg_cron, or on demand from the app.
// Sends through Resend (free plan). Secrets needed: RESEND_API_KEY, CRON_SECRET
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "content-type": "application/json" } });

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const csvCell = (v: unknown) => {
  if (v === undefined || v === null) return "";
  let t = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
function toCsv(rows: Record<string, unknown>[]) {
  const cols: string[] = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!cols.includes(k)) cols.push(k); }));
  return "﻿" + [cols.join(",")].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))).join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    // Allowed callers: the monthly schedule (secret header) or a signed-in team member (the app button)
    const isCron = req.headers.get("x-cron-secret") === Deno.env.get("CRON_SECRET") && !!Deno.env.get("CRON_SECRET");
    if (!isCron) {
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ ok: false, error: "unauthorized" }, 401);
    }

    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: setting } = await db.from("app_settings").select("value").eq("key", "backup_email").maybeSingle();
    const to = setting?.value;
    if (!to) return json({ ok: false, error: "no backup email set" }, 400);

    const all: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("records").select("kind,id,data").range(from, from + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    const of = (k: string) => all.filter((r) => r.kind === k).map((r) => ({ ...r.data, id: r.id }));
    const payload = {
      app: "conx-ops", version: 1, exportedAt: new Date().toISOString(),
      contracts: of("contracts"), clients: of("clients"), tickets: of("tickets"), reports: of("reports"),
    };
    const stamp = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const lastMonth = new Date(monthStart); lastMonth.setMonth(lastMonth.getMonth() - 1);
    const recent = payload.reports.filter((r: any) => r.createdAt && new Date(r.createdAt) >= lastMonth && new Date(r.createdAt) < monthStart).length;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}` },
      body: JSON.stringify({
        from: Deno.env.get("BACKUP_FROM") ?? "Conx Ops <onboarding@resend.dev>",
        to: [to],
        subject: `Conx Ops backup ${stamp}`,
        text:
          `Conx Ops backup, ${stamp}\n\n` +
          `AMC contracts: ${payload.contracts.length}\nClients: ${payload.clients.length}\n` +
          `Tickets: ${payload.tickets.length}\nService reports: ${payload.reports.length} (${recent} created last month)\n\n` +
          `Attached: full backup (.json) to restore from Data > Import in the app, and a reports sheet (.csv) you can open in Excel.`,
        attachments: [
          { filename: `conx-ops-backup-${stamp}.json`, content: b64(JSON.stringify(payload, null, 2)) },
          { filename: `conx-ops-reports-${stamp}.csv`, content: b64(toCsv(payload.reports)) },
        ],
      }),
    });
    if (!res.ok) return json({ ok: false, error: "email provider refused: " + (await res.text()).slice(0, 200) }, 502);
    return json({ ok: true, to });
  } catch (_e) {
    return json({ ok: false, error: "failed" }, 500);
  }
});
