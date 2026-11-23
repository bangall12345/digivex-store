
// Membuat invoice Xendit untuk pesanan milik pengguna yang sedang login.
// Secrets: supabase secrets set XENDIT_SECRET_KEY=... SITE_URL=https://domain-anda
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Belum login" }, 401);

    const { order_id } = await req.json();
    const { data: order } = await userClient.from("orders")
      .select("id,price,status,invoice_url,product_name,item_name")
      .eq("id", order_id).eq("user_id", user.id).maybeSingle();
    if (!order) return json({ error: "Pesanan tidak ditemukan" }, 404);
    if (order.status !== "Pending") return json({ error: "Pesanan sudah diproses" }, 409);
    if (order.invoice_url) return json({ invoice_url: order.invoice_url });

    // Nominal selalu dari database, bukan dari klien.
    const res = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(Deno.env.get("XENDIT_SECRET_KEY")! + ":") },
      body: JSON.stringify({
        external_id: String(order.id), amount: Number(order.price), currency: "IDR",
        description: `${order.product_name} - ${order.item_name}`,
        success_redirect_url: Deno.env.get("SITE_URL"),
      }),
    });
    const inv = await res.json();
    if (!res.ok) return json({ error: "Gagal membuat invoice" }, 502);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("orders").update({ payment_ref: inv.id, invoice_url: inv.invoice_url }).eq("id", order.id);
    return json({ invoice_url: inv.invoice_url });
  } catch (_e) {
    return json({ error: "Kesalahan server" }, 500);
  }
});

