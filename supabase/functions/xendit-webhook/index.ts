
// Webhook Xendit. Secrets: supabase secrets set XENDIT_CALLBACK_TOKEN=... (token verifikasi dari dashboard Xendit)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get("XENDIT_CALLBACK_TOKEN") ?? "";
  const got = req.headers.get("x-callback-token") ?? "";
  if (!expected || got.length !== expected.length ||
      got.split("").reduce((a, c, i) => a | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) !== 0) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await req.json();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (body.status === "PAID" || body.status === "SETTLED") {
    // Cocokkan nominal dengan price di database; ganda/replay tidak memproses dua kali.
    await admin.rpc("mark_order_paid", { p_order_id: String(body.external_id), p_amount: Number(body.amount), p_ref: String(body.id) });
  } else if (body.status === "EXPIRED") {
    await admin.from("orders").update({ status: "Gagal" }).eq("id", body.external_id).eq("status", "Pending");
  }
  return new Response("ok", { status: 200 });
});
