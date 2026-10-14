// Optional: powers the "Rewrite with AI" button. Uses a free Gemini or Groq key stored as a Supabase secret (README step 6).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // Only signed-in team members may use it
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    const { prompt } = await req.json();
    if (typeof prompt !== "string" || !prompt || prompt.length > 6000) {
      return new Response(JSON.stringify({ error: "bad prompt" }), { status: 400, headers: cors });
    }
    // Free options. AI_PROVIDER = "gemini" (default) or "groq". Keys are stored as Supabase secrets.
    const provider = Deno.env.get("AI_PROVIDER") ?? "gemini";
    let text = "";
    if (provider === "groq") {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}` },
        body: JSON.stringify({
          model: Deno.env.get("AI_MODEL") ?? "llama-3.3-70b-versatile",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const j = await r.json();
      text = j?.choices?.[0]?.message?.content ?? "";
    } else {
      const model = Deno.env.get("AI_MODEL") ?? "gemini-2.5-flash";
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 600 } }),
        },
      );
      const j = await r.json();
      text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }
    return new Response(JSON.stringify({ text }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "failed" }), { status: 500, headers: cors });
  }
});
