const CRM_URL = "https://ejsnbluvkqocuchifdvp.supabase.co";
const CRM_KEY = process.env.CRM_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqc25ibHV2a3FvY3VjaGlmZHZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjgwMTQ5NywiZXhwIjoyMDgyMzc3NDk3fQ.ZUTMAnnrwi7KPYYhkWL4Gexbn7ClrxOkG_CGWl2Q5X8";

const PORTAL_URL = "https://xqvnpcxyyxxxydescfzw.supabase.co";
const PORTAL_KEY = process.env.PORTAL_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxdm5wY3h5eXh4eHlkZXNjZnp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjU4MDQzOSwiZXhwIjoyMDk4MTU2NDM5fQ.JR-MTbj8dPCH0stzW3PHzmo0On0JeUVXdc8TKcXRhrI";
const PORTAL_ORG_ID = "1c466ccb-ef35-4ba4-bf00-5fcabf20edec";
const PORTAL_LEAD_ALERTS_CHANNEL = "barnhaus-atlas-lead-alerts";
const PORTAL_LARRY_CHANNEL = "barnhaus-vanessa-larry";
const LARRY_SCHEDULER_URL = process.env.LARRY_SCHEDULER_URL || "https://crm.empowerbuilding.ai/book/30-minute-consultation";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ── Helpers ─────────────────────────────────────────────────────────────────

function val(v) { return v && v !== "null" && v !== "undefined" ? v : null; }

function buildRichMessage(s, partial = false) {
  const tag = partial
    ? "⚡ **Partial Lead — Contact Captured**"
    : "🏠 **New Design Concierge Submission**";

  const sections = [];

  // Contact block
  const contact = [
    `**Client:** ${val(s.name) || "Unknown"}`,
    val(s.email) && `**Email:** ${s.email}`,
    val(s.phone) && `**Phone:** ${s.phone}`,
  ].filter(Boolean).join("\n");
  sections.push(contact);

  if (!partial && val(s.summary)) sections.push(`**Summary:** ${s.summary}`);

  // Design
  const design = [
    val(s.sqft) && `• Size: ${s.sqft} SF${val(s.stories) ? ` | ${s.stories} story` : ""}`,
    (val(s.bedrooms) || val(s.bathrooms)) && `• Beds/Baths: ${val(s.bedrooms) || "?"}bd / ${val(s.bathrooms) || "?"}ba`,
    val(s.style) && `• Style: ${s.style}`,
    val(s.ceiling_height) && `• Ceilings: ${s.ceiling_height}ft${s.great_room_vaulted ? " (vaulted)" : ""}`,
    !val(s.ceiling_height) && s.great_room_vaulted && `• Ceilings: Vaulted great room`,
    val(s.roof_style) && `• Roof: ${s.roof_style}`,
  ].filter(Boolean);
  if (design.length) sections.push("📐 **Design**\n" + design.join("\n"));

  // Garage & Outdoor
  const garage = [
    val(s.garage_cars) && `• Garage: ${s.garage_cars}-car${s.garage_has_shop ? " + shop" : ""}${s.garage_has_rv ? " + RV" : ""}`,
    val(s.outdoor_living) && `• Outdoor: ${s.outdoor_living}`,
    val(s.porch_sf_estimate) && `• Porch: ~${s.porch_sf_estimate} SF`,
  ].filter(Boolean);
  if (garage.length) sections.push("🚗 **Garage & Outdoor**\n" + garage.join("\n"));

  // Location
  const location = [
    val(s.location) && `• ${s.location}`,
    val(s.lot_size_acres) && `• ${s.lot_size_acres} acres`,
    val(s.view_direction) && `• View: ${s.view_direction}`,
    val(s.street_facing) && `• Street: ${s.street_facing}`,
  ].filter(Boolean);
  if (location.length) sections.push("🌎 **Location**\n" + location.join("\n"));

  // Project details
  const project = [
    val(s.budget) && `• Budget: ${s.budget}`,
    val(s.timeline) && `• Timeline: ${s.timeline}`,
    s.land_owned === true && `• Land: Owned`,
    s.land_owned === false && `• Land: Not yet purchased`,
    s.has_builder === false && `• Builder: Needs referral`,
    s.desired_rooms?.length && `• Special rooms: ${s.desired_rooms.join(", ")}`,
    val(s.lifestyle_notes) && `• Lifestyle: ${s.lifestyle_notes}`,
    val(s.additional_notes) && `• Notes: ${s.additional_notes}`,
  ].filter(Boolean);
  if (project.length) sections.push("📋 **Project**\n" + project.join("\n"));

  // Suggested plans
  if (!partial && s.suggested_plan_names?.length) {
    sections.push(`🏡 **Plans Shown**\n${s.suggested_plan_names.map(n => `• ${n}`).join("\n")}`);
  }

  // Inspiration images
  if (s.imageUrls?.length) {
    const imgLines = [`📷 **Images (${s.imageUrls.length})**`];
    s.imageUrls.forEach((url, i) => {
      imgLines.push(`• ${url}`);
      if (s.imageAnalyses?.[i]) imgLines.push(`  ↳ ${s.imageAnalyses[i].analysis.split("\n")[0]}`);
    });
    sections.push(imgLines.join("\n"));
  }

  return tag + "\n\n" + sections.join("\n\n");
}

async function postToPortal(channelId, content) {
  const res = await fetch(`${PORTAL_URL}/rest/v1/portal_messages`, {
    method: "POST",
    headers: {
      apikey: PORTAL_KEY,
      Authorization: `Bearer ${PORTAL_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      channel_id: channelId,
      org_id: PORTAL_ORG_ID,
      sender_type: "agent",
      sender_id: "design-concierge",
      sender_name: "Design Concierge",
      content,
      created_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Portal post failed (${res.status}): ${text}`);
  }
  const rows = await res.json();
  return rows?.[0]?.id || null;
}

export async function deletePortalMessage(messageId) {
  if (!messageId) return;
  try {
    await fetch(`${PORTAL_URL}/rest/v1/portal_messages?id=eq.${messageId}`, {
      method: "DELETE",
      headers: {
        apikey: PORTAL_KEY,
        Authorization: `Bearer ${PORTAL_KEY}`,
      },
    });
  } catch (err) { console.error("Portal delete error:", err.message); }
}

// ── Exports ──────────────────────────────────────────────────────────────────

// Post full rich lead card to Portal lead alerts channel — returns message ID
export async function postToPortalLeadAlerts(s, partial = false) {
  try {
    const content = buildRichMessage(s, partial);
    const msgId = await postToPortal(PORTAL_LEAD_ALERTS_CHANNEL, content);
    console.log(`Portal lead-alerts posted (partial=${partial}) ✅ id=${msgId}`);
    return msgId;
  } catch (err) { console.error("Portal lead-alerts error:", err.message); return null; }
}

// Fire n8n webhook (e.g. SMS to lead) — URL set via N8N_WEBHOOK env var
export async function sendN8nWebhook(s) {
  if (!process.env.N8N_WEBHOOK) return;
  try {
    await fetch(process.env.N8N_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: s.name, email: s.email, phone: s.phone, summary: s.summary, source: "design_concierge" }),
    });
    console.log("n8n webhook fired ✅");
  } catch (err) { console.error("n8n webhook error:", err.message); }
}

// Create a Larry follow-up task via Atlas CRM task webhook
export async function notifyAtlasCrmTask(s, contactId = null) {
  try {
    const content = buildRichMessage(s, false);
    await fetch("https://n8n.empowerbuilding.ai/webhook/atlas-lead-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, channel_id: PORTAL_LEAD_ALERTS_CHANNEL, contact_id: contactId }),
    });
    console.log("Atlas CRM task webhook fired ✅ contact_id=", contactId);
  } catch (err) { console.error("Atlas CRM task webhook error:", err.message); }
}

// ── Auto-send email + text follow-up to lead (10/18 — replaces manual drafts) ─

const TELNYX_API_KEY = process.env.TELNYX_API_KEY; // set in Coolify env — never hardcode (GitHub push protection blocks it)
const TELNYX_FROM_NUMBER = "+18304076296";
const LARRY_EMAIL_FROM = "Larry Madison <larry@barnhaussteelbuilders.com>";
const LARRY_OWNER_ID = "4e86efd2-6335-464b-b286-671b863a9dfc";
const VANESSA_EMAIL_WEBHOOK = "https://n8n.empowerbuilding.ai/webhook/vanessa-send-email";
const PORTAL_LARRY_SMS_CHANNEL = "barnhaus-vanessa-larry-sms";
const LARRY_SIGNATURE = 'Thank you,\n\n<strong>Larry Madison</strong><br>\n🌐 <a href="https://barnhaussteelbuilders.com">Barnhaus Steel Builders</a><br>\n📞 830-407-6296';

// In-process double-fire guard (double /api/complete POSTs)
const recentDispatch = new Map(); // contactId -> dispatch timestamp
const DISPATCH_TTL_MS = 10 * 60 * 1000;

function normalizePhone(phone) {
  const raw = String(phone || "").replace(/\D/g, "");
  if (raw.length === 10) return "+1" + raw;
  if (raw.length === 11 && raw.startsWith("1")) return "+" + raw;
  return null;
}

function asciiOnly(text) {
  // Telnyx/carrier gotcha: keep SMS ASCII-only (smart quotes, em dashes, emoji break delivery)
  return String(text || "")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripClosers(body) {
  // Defensive: strip AI sign-offs so the canonical Larry signature isn't doubled
  // (same regex family Vanessa's send_email.py applies before signature injection)
  return String(body || "")
    .replace(/(?:^|\n|<br\s*\/?>)\s*(?:<br\s*\/?>\s*)*(?:Thank you(?:\s+again)?|Best(?:\s+regards)?|Warm regards|Kind regards|Sincerely|Regards|Thanks(?:\s+again)?|Cheers|Talk soon|Excited to connect|Looking forward(?:[^,\n!]{0,40})?)\s*[,!][\s\S]*/i, "")
    .trimEnd();
}

async function hasRecentActivity(contactId, activityType, windowMs = 10 * 60 * 1000) {
  if (!contactId) return false;
  try {
    const res = await fetch(
      `${CRM_URL}/rest/v1/activities?contact_id=eq.${contactId}&activity_type=eq.${activityType}&order=created_at.desc&limit=1&select=id,created_at`,
      { headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}` } }
    );
    const rows = await res.json();
    const last = Array.isArray(rows) && rows[0];
    if (!last) return false;
    return Date.now() - new Date(last.created_at).getTime() < windowMs;
  } catch { return false; }
}

async function fetchContact(contactId) {
  if (!contactId) return null;
  try {
    const res = await fetch(
      `${CRM_URL}/rest/v1/contacts?id=eq.${contactId}&select=id,first_name,last_name,owner_id,sms_opt_out&limit=1`,
      { headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}` } }
    );
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch { return null; }
}

// Draft email + SMS via Claude — same voice as before, signature now auto-appended
async function draftFollowUp(s) {
  const name = s.name || "the lead";
  const firstName = name.split(" ")[0];
  const summaryBlock = [
      s.summary && `Summary: ${s.summary}`,
      s.location && `Location: ${s.location}`,
      s.budget && `Budget: ${s.budget}`,
      s.sqft && `Size: ${s.sqft} SF, ${s.stories || "1"} story`,
      (s.bedrooms || s.bathrooms) && `Beds/Baths: ${s.bedrooms || "?"}bd / ${s.bathrooms || "?"}ba`,
      s.style && `Style: ${s.style}`,
      s.garage_cars && `Garage: ${s.garage_cars}-car`,
      s.timeline && `Timeline: ${s.timeline}`,
      s.land_owned === true ? "Land: Owned" : s.land_owned === false ? "Land: Not yet purchased" : null,
      s.suggested_plan_names?.length && `Plans shown: ${s.suggested_plan_names.join(", ")}`,
    ].filter(Boolean).join("\n");

    const prompt = `You are Larry, an experienced sales consultant at Barnhaus Steel Builders. A new lead just completed our Design Concierge — an AI-powered home design interview.

Here is their submission:
${summaryBlock}

Name: ${name}
Email: ${s.email || "—"}
Phone: ${s.phone || "—"}

Write two things:

1. A short, warm, personalized EMAIL from Larry to this prospect. Goal: get them on a call to discuss their vision. Reference specific details from their submission so it feels personal, not templated. End with a clear CTA to schedule a meeting: ${LARRY_SCHEDULER_URL}
   - Subject line included
   - Do NOT write a signature, sign-off, or contact info at the end — one is appended automatically
   - Keep it under 200 words, conversational, no fluff

2. A short personalized TEXT MESSAGE (SMS) — under 160 characters ideally, max 320. Friendly, reference one specific detail from their submission, include the scheduler link: ${LARRY_SCHEDULER_URL}. ASCII characters only — no em dashes, curly quotes, or emoji.

Return ONLY valid JSON in this exact format, no extra text:
{
  "email_subject": "...",
  "email_body": "...",
  "sms_text": "..."
}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResp.ok) throw new Error(`Anthropic ${aiResp.status}: ${(await aiResp.text()).slice(0, 200)}`);
    const aiData = await aiResp.json();
    const raw = aiData?.content?.[0]?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");
    const drafts = JSON.parse(jsonMatch[0]);
    if (!drafts.email_subject || !drafts.email_body || !drafts.sms_text) {
      throw new Error("AI draft missing required fields");
    }
    return drafts;
}

// ── Send paths ───────────────────────────────────────────────────────────────

async function sendEmailToLead(s, drafts, contactId) {
  if (!s.email) return { status: "skipped", detail: "no email address on submission" };
  if (await hasRecentActivity(contactId, "email_sent")) {
    return { status: "skipped", detail: "contact was emailed in the last 10 min (double-fire guard)" };
  }
  const body = stripClosers(drafts.email_body) + "\n\n" + LARRY_SIGNATURE;
  try {
    const res = await fetch(VANESSA_EMAIL_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: s.email,
        subject: drafts.email_subject,
        body,
        from_addr: LARRY_EMAIL_FROM,
        user: "larry",
        contact_id: contactId,
        // Automated-flow marker: CRM email activity gets source+auto so the SMS
        // auto-responder knows this was NOT a human rep touch (Joanie Croteau 10/19)
        source: "design_concierge",
        auto: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success !== true) {
      throw new Error(`webhook ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    }
    return { status: "sent", detail: `resend_id=${data.resend_id}` };
  } catch (err) {
    return { status: "failed", detail: err.message };
  }
}

async function sendSmsToLead(s, drafts, contactId, contact) {
  if (!TELNYX_API_KEY) return { status: "failed", detail: "TELNYX_API_KEY env var not set on concierge server" };
  const to = normalizePhone(s.phone);
  if (!to) return { status: "skipped", detail: `phone "${s.phone || ""}" is not a valid US number` };
  if (contact?.sms_opt_out) return { status: "skipped", detail: "contact has SMS opt-out flag" };
  if (await hasRecentActivity(contactId, "sms_sent")) {
    return { status: "skipped", detail: "contact was texted in the last 10 min (double-fire guard)" };
  }

  const text = asciiOnly(drafts.sms_text).slice(0, 320);
  if (!text) return { status: "skipped", detail: "SMS text empty after sanitize" };

  try {
    // 1. Send via Telnyx (main rep line — same number Larry/Vanessa texts come from)
    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: TELNYX_FROM_NUMBER, to, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Telnyx ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    const telnyxId = data?.data?.id || "unknown";

    // 2. CRM activity log + contact patch (mirrors Vanessa's send_sms.py direct-send path)
    const now = new Date().toISOString();
    if (contactId) {
      const crmHeaders = { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };
      await fetch(`${CRM_URL}/rest/v1/activities`, {
        method: "POST",
        headers: crmHeaders,
        body: JSON.stringify({
          contact_id: contactId,
          activity_type: "sms_sent",
          title: "SMS sent: Initial outreach",
          description: text,
          created_at: now,
          user_id: LARRY_OWNER_ID,
          metadata: { sent_by: "larry", source: "design_concierge", auto: true, telnyx_message_id: telnyxId },
        }),
      }).catch(e => console.error("SMS CRM activity log error:", e.message));
      const patch = { last_contacted_at: now, last_contact_type: "sms_sent", last_sms_rep: "larry" };
      if (!contact?.owner_id) patch.owner_id = LARRY_OWNER_ID;
      await fetch(`${CRM_URL}/rest/v1/contacts?id=eq.${contactId}`, {
        method: "PATCH",
        headers: crmHeaders,
        body: JSON.stringify(patch),
      }).catch(e => console.error("SMS contact patch error:", e.message));
    }

    // 3. Thread card in Larry's SMS channel (so the thread shows when the lead replies)
    const contactName = contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : null;
    const smsCardContent = [
      "📱 **SMS Sent**",
      `**To:** ${contactName || to} (${to})`,
      `**From:** ${TELNYX_FROM_NUMBER}`,
      "",
      "```",
      text.slice(0, 1500),
      "```",
    ].join("\n");
    try {
      await fetch(`${PORTAL_URL}/rest/v1/portal_messages`, {
        method: "POST",
        headers: { apikey: PORTAL_KEY, Authorization: `Bearer ${PORTAL_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          channel_id: PORTAL_LARRY_SMS_CHANNEL,
          org_id: PORTAL_ORG_ID,
          sender_type: "system",
          sender_name: "Design Concierge",
          content: smsCardContent,
          processed: true,
          created_at: now,
          metadata: {
            approval_state: "sent",
            direction: "outbound",
            to,
            contact_phone: to,
            contact_name: contactName,
            contact_id: contactId,
            source: "design_concierge",
            auto: true,
          },
        }),
      });
    } catch (e) { console.error("SMS thread card error:", e.message); }

    return { status: "sent", detail: `telnyx_id=${telnyxId}` };
  } catch (err) {
    return { status: "failed", detail: err.message };
  }
}

// ── Orchestrator: draft → auto-send both → notify Larry's channel ────────────

export async function autoSendFollowUp(s, contactId = null) {
  const name = s.name || "Unknown";

  // Double-fire guards
  const lastDispatch = recentDispatch.get(contactId || s.email || s.phone || "") || 0;
  if (Date.now() - lastDispatch < DISPATCH_TTL_MS) {
    console.log(`Auto follow-up skipped — already dispatched for ${name} <10 min ago`);
    return;
  }
  recentDispatch.set(contactId || s.email || s.phone || "", Date.now());

  if (!ANTHROPIC_API_KEY) {
    await postToPortal(PORTAL_LARRY_CHANNEL,
      `⚠️ **Auto follow-up NOT sent — ${name}**\nNo ANTHROPIC_API_KEY on concierge server. Follow up manually; CRM task already created.`).catch(() => {});
    return;
  }

  let drafts;
  try {
    drafts = await draftFollowUp(s);
  } catch (err) {
    console.error("Draft generation failed:", err.message);
    await postToPortal(PORTAL_LARRY_CHANNEL,
      `⚠️ **Auto follow-up FAILED — ${name}**\nDraft generation error: ${err.message}\n\nCRM task already created for manual follow-up.`).catch(() => {});
    return;
  }

  const contact = await fetchContact(contactId);
  const [emailResult, smsResult] = await Promise.all([
    sendEmailToLead(s, drafts, contactId),
    sendSmsToLead(s, drafts, contactId, contact),
  ]);

  console.log(`Auto follow-up ${name}: email=${emailResult.status} (${emailResult.detail}) sms=${smsResult.status} (${smsResult.detail})`);

  const icon = (r) => r.status === "sent" ? "✅" : r.status === "skipped" ? "⏭️" : "⚠️";
  const lines = [
    `🤖 **Auto follow-up — ${name}**`,
    "_Concierge completion → email + text handled automatically. No action needed._",
    "",
    `${icon(emailResult)} **Email ${emailResult.status}** → ${s.email || "—"}`,
  ];
  if (drafts.email_subject) lines.push(`**Subject:** ${drafts.email_subject}`);
  if (emailResult.status !== "sent" && emailResult.detail) lines.push(`_${emailResult.detail}_`);
  lines.push("");
  lines.push(`${icon(smsResult)} **Text ${smsResult.status}** → ${normalizePhone(s.phone) || s.phone || "—"}`);
  if (smsResult.status === "sent" && drafts.sms_text) lines.push(`> ${asciiOnly(drafts.sms_text).slice(0, 220)}`);
  if (smsResult.status !== "sent" && smsResult.detail) lines.push(`_${smsResult.detail}_`);

  // Failure fallback: include full drafts so Larry can send manually
  if (emailResult.status === "failed" || smsResult.status === "failed") {
    lines.push("", "⚠️ **Something failed — drafts below for manual send:**", "",
      `📧 **Email draft** (to ${s.email || "—"})`, `**Subject:** ${drafts.email_subject}`, "", drafts.email_body, "",
      `💬 **Text draft** (to ${s.phone || "—"})`, "```", asciiOnly(drafts.sms_text).slice(0, 500), "```");
  }

  await postToPortal(PORTAL_LARRY_CHANNEL, lines.join("\n")).catch(e => console.error("Larry notification post error:", e.message));
}

export async function writeToCRM(s) {
  try {
    // Handle both s.name (full name) and s.first_name/s.last_name
    let firstName, lastName;
    if (s.first_name || s.last_name) {
      firstName = s.first_name || "";
      lastName = s.last_name || "";
    } else {
      const parts = (s.name || "").trim().split(" ");
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || "";
    }

    // Build notes from all collected data
    const noteLines = [
      s.summary && `Summary: ${s.summary}`,
      s.location && `Location: ${s.location}${s.lot_size_acres ? ` (${s.lot_size_acres} acres)` : ""}`,
      s.budget && `Budget: ${s.budget}`,
      s.sqft && `Size: ${s.sqft} SF | ${s.stories || "1"} story`,
      (s.bedrooms || s.bathrooms) && `Beds/Baths: ${s.bedrooms || "?"}bd / ${s.bathrooms || "?"}ba`,
      s.style && `Style: ${s.style}`,
      s.garage_cars && `Garage: ${s.garage_cars}-car${s.garage_has_shop ? " + shop" : ""}`,
      s.outdoor_living && `Outdoor: ${s.outdoor_living}`,
      s.timeline && `Timeline: ${s.timeline}`,
      s.land_owned === true ? "Land: Owned" : s.land_owned === false ? "Land: Not yet purchased" : null,
      s.has_builder === false ? "Needs builder referral" : null,
      s.desired_rooms?.length && `Special rooms: ${s.desired_rooms.join(", ")}`,
      s.lifestyle_notes && `Lifestyle: ${s.lifestyle_notes}`,
      s.family_notes && `Family: ${s.family_notes}`,
      s.additional_notes && `Notes: ${s.additional_notes}`,
      s.suggested_plan_names?.length && `Suggested plans: ${s.suggested_plan_names.join(", ")}`,
      `Source: Design Concierge (design.barnhaussteelbuilders.com)`,
      s.imageUrls?.length && `Inspiration images: ${s.imageUrls.join(", ")}`,
      s.imageAnalyses?.length && `Image analysis:\n${s.imageAnalyses.map((a, i) => `Image ${i + 1}: ${a.analysis}`).join("\n")}`,
    ].filter(Boolean).join("\n");

    // Check if contact already exists by email
    const existing = await fetch(
      `${CRM_URL}/rest/v1/contacts?email=eq.${encodeURIComponent(s.email)}&select=id&limit=1`,
      { headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}` } }
    ).then(r => r.json());

    // Phone fallback if no email match
    let matchedContact = existing?.[0] || null;
    if (!matchedContact && s.phone) {
      const phone = s.phone.replace(/\D/g, "");
      const byPhone = await fetch(
        `${CRM_URL}/rest/v1/contacts?select=id,lead_source,email&phone=ilike.*${phone.slice(-10)}*&limit=1`,
        { headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}` } }
      ).then(r => r.json());
      if (byPhone?.length > 0) {
        console.log("CRM: matched contact by phone", byPhone[0].id);
        matchedContact = byPhone[0];
      }
    }

    if (matchedContact) {
      const existingFull = await fetch(
        `${CRM_URL}/rest/v1/contacts?id=eq.${matchedContact.id}&select=id,lead_source,email`,
        { headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}` } }
      ).then(r => r.json());
      const existingLeadSource = existingFull?.[0]?.lead_source;
      const existingEmail = existingFull?.[0]?.email;
      const updatePayload = { notes: noteLines, lifecycle_stage: "lead", updated_at: new Date().toISOString() };
      if (!existingLeadSource) updatePayload.lead_source = "design_concierge";
      if (!existingEmail && s.email) updatePayload.email = s.email;
      // Monetization routing + consent (10/14): monotonic — only set true, never clear
      if (s.project_type) updatePayload.project_type = s.project_type;
      if (s.budget_range) updatePayload.budget_range = s.budget_range;
      if (s.timeline_code) updatePayload.timeline = s.timeline_code;
      if (s.land_status || s.land_owned === true || s.land_owned === false) updatePayload.land_status = s.land_status || (s.land_owned ? "owned" : "looking");
      for (const k of ["consent_kit","consent_builder","consent_lender","consent_realtor","consent_sitework","consent_well","consent_sms"]) {
        if (s[k] === true) updatePayload[k] = true;
      }
      if (["consent_kit","consent_builder","consent_lender","consent_realtor","consent_sitework","consent_well","consent_sms"].some(k => s[k] === true)) {
        updatePayload.consent_captured_at = new Date().toISOString();
        updatePayload.consent_source_url = "https://design.barnhaussteelbuilders.com";
        updatePayload.consent_text_version = "concierge-v1";
      }
      await fetch(`${CRM_URL}/rest/v1/contacts?id=eq.${matchedContact.id}`, {
        method: "PATCH",
        headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(updatePayload),
      });
      console.log("CRM: updated existing contact", matchedContact.id);
      if (noteLines) await insertCRMNote(matchedContact.id, noteLines);
      return matchedContact.id;
    } else {
      const res = await fetch(`${CRM_URL}/rest/v1/contacts`, {
        method: "POST",
        headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: s.email,
          phone: s.phone || null,
          lead_source: "design_concierge",
          lifecycle_stage: "lead",
          notes: noteLines,
          // Monetization routing + consent (10/14)
          project_type: s.project_type || null,
          budget_range: s.budget_range || null,
          timeline: s.timeline_code || null,
          land_status: s.land_status || (s.land_owned === true ? "owned" : s.land_owned === false ? "looking" : null),
          consent_kit: s.consent_kit === true,
          consent_builder: s.consent_builder === true,
          consent_lender: s.consent_lender === true,
          consent_realtor: s.consent_realtor === true,
          consent_sitework: s.consent_sitework === true,
          consent_well: s.consent_well === true,
          consent_sms: s.consent_sms === true,
          consent_captured_at: ["consent_kit","consent_builder","consent_lender","consent_realtor","consent_sitework","consent_well","consent_sms"].some(k => s[k] === true) ? new Date().toISOString() : null,
          consent_source_url: ["consent_kit","consent_builder","consent_lender","consent_realtor","consent_sitework","consent_well","consent_sms"].some(k => s[k] === true) ? "https://design.barnhaussteelbuilders.com" : null,
          consent_text_version: ["consent_kit","consent_builder","consent_lender","consent_realtor","consent_sitework","consent_well","consent_sms"].some(k => s[k] === true) ? "concierge-v1" : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      const created = await res.json();
      const contactId = created?.[0]?.id;
      console.log("CRM: created contact", contactId);
      if (contactId && noteLines) await insertCRMNote(contactId, noteLines);
      return contactId || null;
    }
  } catch (err) { console.error("CRM write error:", err.message); return null; }
}

async function insertCRMNote(contactId, content) {
  try {
    await fetch(`${CRM_URL}/rest/v1/notes`, {
      method: "POST",
      headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ contact_id: contactId, content, created_at: new Date().toISOString() }),
    });
  } catch (err) { console.error("CRM note insert error:", err.message); }
}
