const CRM_URL = "https://ejsnbluvkqocuchifdvp.supabase.co";
const CRM_KEY = process.env.CRM_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqc25ibHV2a3FvY3VjaGlmZHZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjgwMTQ5NywiZXhwIjoyMDgyMzc3NDk3fQ.ZUTMAnnrwi7KPYYhkWL4Gexbn7ClrxOkG_CGWl2Q5X8";

export async function sendN8nWebhook(s) {
  if (!process.env.N8N_WEBHOOK) return;
  try {
    await fetch(process.env.N8N_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: s.name, email: s.email, phone: s.phone, summary: s.summary, source: "design_concierge" }),
    });
  } catch (err) { console.error("n8n webhook error:", err.message); }
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
      s.imageAnalyses?.length && `Image analysis:\n${s.imageAnalyses.map((a,i) => `Image ${i+1}: ${a.analysis}`).join("\n")}`,
    ].filter(Boolean).join("\n");

    // Check if contact already exists
    const existing = await fetch(
      `${CRM_URL}/rest/v1/contacts?email=eq.${encodeURIComponent(s.email)}&select=id&limit=1`,
      { headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}` } }
    ).then(r => r.json());

    if (existing?.length > 0) {
      // Update existing contact
      await fetch(`${CRM_URL}/rest/v1/contacts?id=eq.${existing[0].id}`, {
        method: "PATCH",
        headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ notes: noteLines, lead_source: "design_concierge", lifecycle_stage: "lead", updated_at: new Date().toISOString() }),
      });
      console.log("CRM: updated existing contact", existing[0].id);
      if (noteLines) await insertCRMNote(existing[0].id, noteLines);
    } else {
      // Create new contact
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
      if (contactId && noteLines) {
        await insertCRMNote(contactId, noteLines);
      }
    }
  } catch (err) { console.error("CRM write error:", err.message); }
}

async function insertCRMNote(contactId, content) {
  try {
    await fetch(`${CRM_URL}/rest/v1/notes`, {
      method: "POST",
      headers: { apikey: CRM_KEY, Authorization: `Bearer ${CRM_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        contact_id: contactId,
        content: content,
        created_at: new Date().toISOString(),
      }),
    });
  } catch (err) { console.error("CRM note insert error:", err.message); }
}

function val(v) { return v && v !== "null" && v !== "undefined" ? v : null; }

export async function sendDiscordNotification(s, partial = false) {
  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL) return;
  try {
    const tag = partial ? "⚡ **Partial Lead — Contact Captured**" : "🏠 **New Design Concierge Submission**";
    const sections = [];

    const contact = [`**Client:** ${val(s.name) || "Unknown"}`, val(s.email) && `**Email:** ${s.email}`, val(s.phone) && `**Phone:** ${s.phone}`].filter(Boolean).join("\n");
    sections.push(contact);

    if (!partial && val(s.summary)) sections.push(`**Summary:** ${s.summary}`);

    const design = [
      val(s.sqft) && `• Size: ${s.sqft} SF${val(s.stories) ? ` | ${s.stories} story` : ""}`,
      (val(s.bedrooms) || val(s.bathrooms)) && `• Beds/Baths: ${val(s.bedrooms) || "?"}bd / ${val(s.bathrooms) || "?"}ba`,
      val(s.style) && `• Style: ${s.style}`,
      val(s.ceiling_height) && `• Ceilings: ${s.ceiling_height}ft${s.great_room_vaulted ? " (vaulted)" : ""}`,
      !val(s.ceiling_height) && s.great_room_vaulted && `• Ceilings: Vaulted great room`,
      val(s.roof_style) && `• Roof: ${s.roof_style}`,
    ].filter(Boolean);
    if (design.length) sections.push("📐 **Design**\n" + design.join("\n"));

    const garage = [
      val(s.garage_cars) && `• Garage: ${s.garage_cars}-car${s.garage_has_shop ? " + shop" : ""}${s.garage_has_rv ? " + RV" : ""}`,
      val(s.outdoor_living) && `• Outdoor: ${s.outdoor_living}`,
      val(s.porch_sf_estimate) && `• Porch: ~${s.porch_sf_estimate} SF`,
    ].filter(Boolean);
    if (garage.length) sections.push("🚗 **Garage & Outdoor**\n" + garage.join("\n"));

    const location = [
      val(s.location) && `• ${s.location}`,
      val(s.lot_size_acres) && `• ${s.lot_size_acres} acres`,
      val(s.view_direction) && `• View: ${s.view_direction}`,
      val(s.street_facing) && `• Street: ${s.street_facing}`,
    ].filter(Boolean);
    if (location.length) sections.push("🌎 **Location**\n" + location.join("\n"));

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

    // Floor plans shown
    if (!partial && s.suggested_plan_names?.length) {
      sections.push(`🏡 **Plans Shown**\n${s.suggested_plan_names.map(n => `• ${n}`).join("\n")}`);
    }

    if (s.imageUrls?.length) {
      const imgLines = [`📷 **Images (${s.imageUrls.length})**`];
      s.imageUrls.forEach((url, i) => {
        imgLines.push(`• ${url}`);
        if (s.imageAnalyses?.[i]) imgLines.push(`  ↳ ${s.imageAnalyses[i].analysis.split("\n")[0]}`);
      });
      sections.push(imgLines.join("\n"));
    }

    const content = tag + "\n\n" + sections.join("\n\n");

    const res = await fetch(`https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bot ${process.env.DISCORD_TOKEN}`, "Content-Type": "application/json", "User-Agent": "DiscordBot (barnhaus, 1.0)" },
      body: JSON.stringify({ content }),
    });
    const msg = await res.json();
    return msg.id || null;
  } catch (err) { console.error("Discord notification error:", err.message); return null; }
}

export async function deleteDiscordMessage(messageId) {
  if (!messageId || !process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL) return;
  try {
    await fetch(`https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL}/messages/${messageId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bot ${process.env.DISCORD_TOKEN}`, "User-Agent": "DiscordBot (barnhaus, 1.0)" },
    });
  } catch (err) { console.error("Discord delete error:", err.message); }
}
