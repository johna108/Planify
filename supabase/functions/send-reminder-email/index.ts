import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ReminderTiming = "at_time" | "5_min_before" | "15_min_before" | "1_hour_before" | "1_day_before";

const timingLabel: Record<ReminderTiming, string> = {
  at_time: "at task time",
  "5_min_before": "5 minutes before",
  "15_min_before": "15 minutes before",
  "1_hour_before": "1 hour before",
  "1_day_before": "1 day before",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const REMINDER_FROM_EMAIL = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Planify <onboarding@resend.dev>";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing Supabase env configuration." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const to = String(body?.to ?? "").trim().toLowerCase();
    const taskTitle = String(body?.taskTitle ?? "").trim();
    const scheduledStart = String(body?.scheduledStart ?? "").trim();
    const reminderTiming = String(body?.reminderTiming ?? "") as ReminderTiming;

    if (!to || !taskTitle || !scheduledStart || !(reminderTiming in timingLabel)) {
      return new Response(JSON.stringify({ error: "Invalid payload." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user.email || to !== user.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Email mismatch with authenticated user." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2 style="margin-bottom: 8px;">Planify Reminder</h2>
        <p style="margin: 0 0 8px;">Your task <strong>${taskTitle}</strong> is scheduled soon.</p>
        <p style="margin: 0 0 8px;"><strong>Reminder:</strong> ${timingLabel[reminderTiming]}</p>
        <p style="margin: 0;"><strong>Scheduled for:</strong> ${new Date(scheduledStart).toLocaleString()}</p>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: REMINDER_FROM_EMAIL,
        to: [to],
        subject: `Planify Reminder: ${taskTitle}`,
        html,
      }),
    });

    const resendResult = await resendResponse.json();
    if (!resendResponse.ok) {
      return new Response(JSON.stringify({ error: "Resend API failed", details: resendResult }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await adminClient.from("reminder_email_logs").insert({
      user_id: user.id,
      user_email: to,
      task_title: taskTitle,
      scheduled_start: scheduledStart,
      reminder_timing: reminderTiming,
      provider_message_id: resendResult?.id ?? null,
      status: "sent",
    });

    return new Response(JSON.stringify({ ok: true, id: resendResult?.id ?? null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Unhandled function error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
