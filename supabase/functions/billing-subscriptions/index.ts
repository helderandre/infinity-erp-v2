import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Content-Type": "application/json",
};

interface Subscription {
  id: string;
  agent_id: string;
  price_per_cycle: number;
  billing_cycle: string;
  cancel_at_period_end: boolean;
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string;
  failed_billing_count: number;
  catalog_item_id: string;
  marketing_catalog: { name: string } | null;
}

function addInterval(date: Date, cycle: string): Date {
  const result = new Date(date);
  switch (cycle) {
    case "weekly":
      result.setDate(result.getDate() + 7);
      break;
    case "monthly":
      result.setMonth(result.getMonth() + 1);
      break;
    case "quarterly":
      result.setMonth(result.getMonth() + 3);
      break;
    case "yearly":
      result.setFullYear(result.getFullYear() + 1);
      break;
    default:
      result.setMonth(result.getMonth() + 1);
  }
  return result;
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const summary = { processed: 0, billed: 0, cancelled: 0, failed: 0 };

  // Fetch active subscriptions due for billing, joined with catalog for service name
  const { data: subscriptions, error: fetchError } = await supabase
    .from("marketing_subscriptions")
    .select("*, marketing_catalog(name)")
    .eq("status", "active")
    .lte("next_billing_date", new Date().toISOString().split("T")[0]);

  if (fetchError) {
    console.error("Failed to fetch subscriptions:", fetchError.message);
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      { status: 500, headers: corsHeaders }
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    return new Response(JSON.stringify(summary), { headers: corsHeaders });
  }

  for (const sub of subscriptions as Subscription[]) {
    summary.processed++;

    try {
      // --- Cancel if flagged for end-of-period cancellation ---
      if (sub.cancel_at_period_end) {
        const { error: cancelError } = await supabase
          .from("marketing_subscriptions")
          .update({ status: "cancelled" })
          .eq("id", sub.id);

        if (cancelError) throw cancelError;

        summary.cancelled++;
        continue;
      }

      // --- Get agent's current balance ---
      const { data: lastTx, error: balanceError } = await supabase
        .from("conta_corrente_transactions")
        .select("balance_after")
        .eq("agent_id", sub.agent_id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (balanceError) throw balanceError;

      const currentBalance: number = lastTx?.balance_after ?? 0;
      const newBalance = currentBalance - sub.price_per_cycle;

      const catalogName =
        sub.marketing_catalog?.name ?? "Servico";

      // --- Insert DEBIT transaction ---
      const { error: txError } = await supabase
        .from("conta_corrente_transactions")
        .insert({
          agent_id: sub.agent_id,
          date: new Date().toISOString(),
          type: "DEBIT",
          category: "subscription_renewal",
          amount: sub.price_per_cycle,
          description: `Renovacao subscricao \u2014 ${catalogName}`,
          reference_id: sub.id,
          reference_type: "marketing_subscription",
          balance_after: newBalance,
        });

      if (txError) throw txError;

      // --- Log success ---
      await supabase.from("marketing_subscription_billing_log").insert({
        subscription_id: sub.id,
        status: "success",
        amount: sub.price_per_cycle,
        balance_after: newBalance,
        billed_at: new Date().toISOString(),
      });

      // --- Advance billing dates ---
      const newPeriodStart = new Date(sub.current_period_end);
      const newPeriodEnd = addInterval(newPeriodStart, sub.billing_cycle);

      const { error: updateError } = await supabase
        .from("marketing_subscriptions")
        .update({
          current_period_start: newPeriodStart.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
          next_billing_date: newPeriodEnd.toISOString().split("T")[0],
          failed_billing_count: 0,
        })
        .eq("id", sub.id);

      if (updateError) throw updateError;

      summary.billed++;
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      console.error(
        `Billing failed for subscription ${sub.id}:`,
        errorMessage
      );

      // Log failure
      await supabase.from("marketing_subscription_billing_log").insert({
        subscription_id: sub.id,
        status: "failed",
        amount: sub.price_per_cycle,
        error_message: errorMessage,
        billed_at: new Date().toISOString(),
      });

      // Increment failed count; suspend if >= 3
      const newFailedCount = (sub.failed_billing_count ?? 0) + 1;
      const updatePayload: Record<string, unknown> = {
        failed_billing_count: newFailedCount,
      };
      if (newFailedCount >= 3) {
        updatePayload.status = "billing_failed";
      }

      await supabase
        .from("marketing_subscriptions")
        .update(updatePayload)
        .eq("id", sub.id);

      summary.failed++;
    }
  }

  console.log("Billing run complete:", summary);

  return new Response(JSON.stringify(summary), { headers: corsHeaders });
});
