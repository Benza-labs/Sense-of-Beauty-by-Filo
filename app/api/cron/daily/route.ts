import type { NextRequest } from "next/server";
import { runDailyJobs } from "@/lib/notify/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lebenszeichen an die Datenbank. Supabase (kostenloser Tarif) pausiert ein Projekt
 * nach 7 Tagen ohne Zugriff. Die Website liest dank Cache selten direkt aus der Datenbank,
 * deshalb fragt dieser tägliche Lauf immer kurz nach, auch ohne CRON_SECRET.
 * Die Abfrage ist harmlos (zählt nur Behandlungen) und gibt nichts zurück.
 */
async function keepAlive() {
  try {
    await createAdminClient().from("services").select("id", { count: "exact", head: true });
  } catch (error) {
    console.error("Lebenszeichen an Supabase fehlgeschlagen:", error);
  }
}

/**
 * Täglicher Lauf (Vercel Cron, siehe vercel.json): Erinnerungen für morgen,
 * Bewertungsanfragen und Nachbuchungs-Erinnerungen, außerdem ein Lebenszeichen an Supabase.
 * Vercel schickt dabei automatisch "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: NextRequest) {
  await keepAlive();
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runDailyJobs(new Date());
    return Response.json({ ok: true, ...summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Täglicher Lauf fehlgeschlagen:", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
