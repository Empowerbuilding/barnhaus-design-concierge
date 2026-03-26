import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function uploadImage(fileBuffer, mimetype, originalName) {
  const ext = originalName.split(".").pop().toLowerCase() || "jpg";
  const filename = `concierge/${Date.now()}-${randomUUID().slice(0,8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from("inspiration-images")
    .upload(filename, fileBuffer, { contentType: mimetype, upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("inspiration-images")
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

export async function analyzeImage(fileBuffer, mimetype) {
  try {
    const base64 = fileBuffer.toString("base64");
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimetype, data: base64 }
          },
          {
            type: "text",
            text: `Analyze this image uploaded by a prospective homebuilding client. Extract design signals in 3-5 sentences covering:
- Architectural style (modern, rustic, industrial, Hill Country, farmhouse, etc.)
- Key exterior materials (steel, wood, stone, stucco, etc.)
- Roof style if visible (gable, shed, flat, hip)
- Interior features if visible (open plan, vaulted ceilings, kitchen style, finishes)
- Overall vibe and any standout design elements
Be specific and useful for a home designer. Keep it concise.`
          }
        ]
      }]
    });
    return response.content[0]?.text || null;
  } catch (err) {
    console.error("Vision analysis error:", err.message);
    return null;
  }
}
