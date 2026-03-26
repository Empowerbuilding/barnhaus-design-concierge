import { useState, useRef, useCallback } from "react";

function generateId() {
  return "s_" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// Field card definitions in order
const FIELD_STEPS = [
  {
    id: "contact",
    fields: [
      { key: "name", label: "Your Name", type: "text", placeholder: "Full name", flex: "1 1 180px" },
      { key: "email", label: "Email", type: "text", placeholder: "you@email.com", flex: "1 1 180px" },
      { key: "phone", label: "Phone", type: "text", placeholder: "(555) 000-0000", flex: "1 1 140px" },
    ]
  },
  {
    id: "location",
    fields: [
      { key: "location", label: "City, State", type: "text", placeholder: "e.g. Boerne, TX", flex: "1 1 200px" },
      { key: "lot_size_acres", label: "Acres", type: "number", placeholder: "e.g. 5" },
      { key: "land_owned", label: "Own the Land?", type: "boolean" },
    ]
  },
  {
    id: "budget",
    fields: [
      { key: "budget", label: "Construction Budget", type: "text", placeholder: "e.g. $400k or $300-500k", flex: "1 1 220px" },
      { key: "timeline", label: "Build Timeline", type: "text", placeholder: "e.g. 12-18 months", flex: "1 1 160px" },
    ]
  },
  {
    id: "size",
    fields: [
      { key: "sqft", label: "Square Footage", type: "number", placeholder: "e.g. 2400" },
      { key: "stories", label: "Stories", type: "select", options: [{ value: "1", label: "Single story" }, { value: "2", label: "Two story" }] },
      { key: "bedrooms", label: "Bedrooms", type: "number", placeholder: "e.g. 3" },
      { key: "bathrooms", label: "Bathrooms", type: "number", placeholder: "e.g. 2.5" },
    ]
  },
  {
    id: "garage",
    fields: [
      { key: "garage_cars", label: "Garage", type: "select", options: [{ value: "0", label: "No garage" }, { value: "1", label: "1-car" }, { value: "2", label: "2-car" }, { value: "3", label: "3-car" }, { value: "4", label: "4+ / RV bay" }] },
      { key: "garage_has_shop", label: "Shop Space?", type: "boolean" },
      { key: "garage_has_rv", label: "RV Storage?", type: "boolean" },
    ]
  },
];

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [submissionData, setSubmissionData] = useState(null);
  const [fieldStep, setFieldStep] = useState(0); // which card to show next
  const [activeFields, setActiveFields] = useState(null);
  const [uploadPrompted, setUploadPrompted] = useState(false);
  const sessionId = useRef(generateId());
  const hasGreeted = useRef(false);
  const aiTurnCount = useRef(0);

  // Only show field cards for first 2 turns (contact + location)
  const maybeShowNextCard = useCallback((turnCount) => {
    if (turnCount < 2) {
      setActiveFields(FIELD_STEPS[turnCount].fields);
      setFieldStep(turnCount + 1);
    } else {
      setActiveFields(null);
    }
  }, []);

  const handleResponse = useCallback(async (data) => {
    const aiMsg = {
      role: "assistant",
      text: data.message,
      suggestedPlans: data.suggestedPlans || [],
    };
    setMessages((prev) => [...prev, aiMsg]);
    // Pulse upload button if AI is asking for a photo
    const asksForUpload = /upload|photo|picture|image|survey|aerial/i.test(data.message);
    setUploadPrompted(asksForUpload);

    if (data.conversationComplete && data.submissionData) {
      setSubmissionData(data.submissionData);
      setActiveFields(null);
      try {
        await fetch("/api/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionData: data.submissionData, sessionId: sessionId.current }),
        });
      } catch (err) { console.error("Completion webhook failed:", err); }
      setIsComplete(true);
    } else {
      // Show next field card after each AI turn
      const turn = aiTurnCount.current;
      aiTurnCount.current += 1;
      maybeShowNextCard(turn);
    }
  }, [maybeShowNextCard]);

  const sendMessage = useCallback(async (text, meta) => {
    if (isLoading || isComplete) return;
    setActiveFields(null);
    setMessages((prev) => [...prev, { role: "user", text }]);
    // Fire partial lead when contact card submitted
    if (meta?.partial) {
      fetch("/api/partial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, ...meta.partial }),
      }).catch(() => {});
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat request failed");
      await handleResponse(data);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [...prev, { role: "assistant", text: "I'm having trouble connecting right now. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isComplete, handleResponse]);

  const sendImage = useCallback(async (file, caption) => {
    setUploadPrompted(false);
    if (isLoading || isComplete) return;
    setIsLoading(true);
    const previewUrl = URL.createObjectURL(file);
    setMessages((prev) => [...prev, { role: "user", imageUrl: previewUrl, text: caption || undefined }]);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("sessionId", sessionId.current);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");
      const analysisNote = uploadData.analysis ? ` Vision analysis: ${uploadData.analysis}` : "";
      const captionNote = caption ? ` Client said: "${caption}"` : "";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          message: `[Client uploaded an inspiration image: ${uploadData.url}.${analysisNote}${captionNote}]`,
          imageUrl: uploadData.url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat request failed");
      await handleResponse(data);
    } catch (err) {
      console.error("Image upload error:", err);
      setMessages((prev) => [...prev, { role: "assistant", text: "Sorry, I had trouble with that image. Try again or describe what you're looking for." }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isComplete, handleResponse]);

  const startConversation = useCallback(async () => {
    if (hasGreeted.current) return;
    hasGreeted.current = true;
    setIsLoading(true);
    fetch("/api/plans").then(r => r.json()).then(plans => { window._floorPlans = plans; }).catch(() => {});
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, message: "Hello" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      setMessages([{ role: "assistant", text: data.message }]);
      // Show contact card immediately after greeting
      setActiveFields(FIELD_STEPS[0].fields);
      setFieldStep(1);
      aiTurnCount.current = 1;
    } catch (err) {
      setMessages([{ role: "assistant", text: "Hi! I'm the Barnhaus Design Concierge. What's your name and best email?" }]);
      setActiveFields(FIELD_STEPS[0].fields);
      setFieldStep(1);
      aiTurnCount.current = 1;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const dismissFields = useCallback(() => setActiveFields(null), []);

  return { messages, isLoading, isComplete, submissionData, activeFields, dismissFields, uploadPrompted, sendMessage, sendImage, startConversation };
}
