
// Webhook notifikasi Midtrans. Set MIDTRANS_SERVER_KEY sebagai Supabase secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

async function sha512(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-512", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY") ?? "";
    if (!serverKey) return new Response("Payment configuration missing", { status: 500 });
    const body = await req.json();
    const orderId = String(body.order_id ?? "");
    const statusCode = String(body.status_code ?? "");
    const grossAmount = String(body.gross_amount ?? "");
    const signature = String(body.signature_key ?? "");
    const expected = await sha512(orderId + statusCode + grossAmount + serverKey);
    if (!signature) return new Response("Invalid signature", { status: 401 });
    let diff = signature.length ^ expected.length;
    for (let i = 0; i < Math.max(signature.length, expected.length); i++) {
      diff |= (signature.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
    }
    if (diff !== 0) return new Response("Invalid signature", { status: 401 });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const amount = Number(grossAmount);
    const transactionStatus = String(body.transaction_status ?? "");
    const fraudStatus = String(body.fraud_status ?? "");

    if (statusCode === "200" && (transactionStatus === "settlement" || (transactionStatus === "capture" && fraudStatus === "accept"))) {
      const { error } = await admin.rpc("mark_order_paid", { p_order_id: orderId, p_amount: amount, p_ref: String(body.transaction_id ?? orderId) });
      if (error) { console.error("mark_order_paid failed", error); return new Response("Could not update order", { status: 500 }); }
    } else if (["expire", "cancel", "deny"].includes(transactionStatus)) {
      await admin.from("orders").update({ status: "Gagal" }).eq("id", orderId).eq("status", "Pending");
    }
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("midtrans-webhook error", error);
    return new Response("Invalid notification", { status: 400 });
  }
});
