
 // Membuat transaksi Midtrans Snap untuk pesanan milik pengguna yang login.
// Secrets: MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION (true/false).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method tidak diizinkan" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!supabaseUrl || !anonKey || !serverKey) return json({ error: "Konfigurasi pembayaran server belum lengkap" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Silakan login terlebih dahulu" }, 401);

    const payload = await req.json();
    const orderId = String(payload?.order_id ?? "");
    if (!orderId || orderId.length > 50) return json({ error: "ID pesanan tidak valid" }, 400);

    const { data: order, error: orderError } = await userClient.from("orders")
      .select("id,price,status,invoice_url,product_name,item_name")
      .eq("id", orderId).eq("user_id", user.id).maybeSingle();
    if (orderError || !order) return json({ error: "Pesanan tidak ditemukan" }, 404);
    if (order.status !== "Pending") return json({ error: "Pesanan bukan berstatus Pending" }, 409);
    if (order.invoice_url) return json({ redirect_url: order.invoice_url });

    const amount = Number(order.price);
    if (!Number.isSafeInteger(amount) || amount < 1) return json({ error: "Nominal pesanan tidak valid" }, 400);

    const production = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
    const endpoint = production
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const auth = btoa(`${serverKey}:`);
    const midtransRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Basic ${auth}` },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: orderId, price: amount, quantity: 1, name: `${order.product_name} ${order.item_name}`.slice(0, 50) }],
        customer_details: { first_name: String(user.user_metadata?.name ?? user.email ?? "Pelanggan").slice(0, 50), email: user.email },
      }),
    });
    const result = await midtransRes.json();
    if (!midtransRes.ok || !result.redirect_url) {
      console.error("Midtrans Snap error", midtransRes.status, result);
      return json({ error: "Midtrans gagal membuat transaksi. Periksa konfigurasi dan Server Key." }, 502);
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: updateError } = await admin.from("orders")
      .update({ payment_ref: String(result.token ?? orderId), invoice_url: String(result.redirect_url) })
      .eq("id", orderId).eq("status", "Pending");
    if (updateError) {
      console.error("Gagal menyimpan referensi pembayaran", updateError);
      return json({ error: "Transaksi dibuat tetapi gagal menyimpan data pembayaran. Hubungi admin." }, 500);
    }
    return json({ redirect_url: result.redirect_url });
  } catch (error) {
    console.error("create-payment error", error);
    return json({ error: "Kesalahan server saat membuat pembayaran" }, 500);
  }
});
