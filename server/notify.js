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
export async function notifyAtlasCrmTask(s) {
  try {
    const content = buildRichMessage(s, false);
    await fetch("https://n8n.empowerbuilding.ai/webhook/lXtylBI3tPMZxubr/webhook/atlas-lead-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, channel_id: PORTAL_LEAD_ALERTS_CHANNEL }),
    });
    console.log("Atlas CRM task webhook fired ✅");
  } catch (err) { console.error("Atlas CRM task webhook error:", err.message); }
}

// ── Draft email + text for Larry ────────────────────────────────────────────

export async function draftAndPostToLarry(s) {
  if (!ANTHROPIC_API_KEY) { console.warn("No ANTHROPIC_API_KEY — skipping Larry drafts"); return; }
  try {
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
   - Sign off as Larry from Barnhaus Steel Builders (larry@barnhaussteelbuilders.com, 210-517-7267)
   - Keep it under 200 words, conversational, no fluff

2. A short personalized TEXT MESSAGE (SMS) — under 160 characters ideally, max 320. Friendly, reference one specific detail from their submission, include the scheduler link: ${LARRY_SCHEDULER_URL}

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

    const aiData = await aiResp.json();
    const raw = aiData?.content?.[0]?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");
    const drafts = JSON.parse(jsonMatch[0]);

    const emailContent = [
      `📧 **Email Draft — ${name}**`,
      `**To:** ${s.email || "—"}`,
      `**Subject:** ${drafts.email_subject}`,
      ``,
      drafts.email_body,
    ].join("\n");

    const smsContent = [
      `💬 **Text Draft — ${name}**`,
      `**To:** ${s.phone || "—"}`,
      ``,
      drafts.sms_text,
    ].join("\n");

    await postToPortal(PORTAL_LARRY_CHANNEL, emailContent);
    await postToPortal(PORTAL_LARRY_CHANNEL, smsContent);
    console.log("Larry drafts posted to portal ✅");
  } catch (err) { console.error("Larry draft error:", err.message); }
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
      await fetch(`${CRM_URL}/rest/v1/contacts?id=eq.${matchedContact.id}`, {
        method: "PATCH",
        headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(updatePayload),
      });
      console.log("CRM: updated existing contact", matchedContact.id);
      if (noteLines) await insertCRMNote(matchedContact.id, noteLines);
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      const created = await res.json();
      const contactId = created?.[0]?.id;
      console.log("CRM: created contact", contactId);
      if (contactId && noteLines) await insertCRMNote(contactId, noteLines);
    }
  } catch (err) { console.error("CRM write error:", err.message); }
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
