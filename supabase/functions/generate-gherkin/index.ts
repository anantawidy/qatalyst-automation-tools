import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, scenarioDesc } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `
You are a senior QA engineer writing Gherkin BDD scenarios.

Generate a Gherkin feature file based on this info:
URL: ${url}
Scenario description: ${scenarioDesc}

STRICT FORMAT RULES:
1. Start with a Feature line, then the BDD narrative:
   Feature: <Feature Name>
     As a <role>
     I want <goal>
     So that <benefit>

2. Scenario naming:
   - Concise, readable titles
   - Do NOT include numbered steps, URLs, or technical IDs in scenario titles

3. Step structure:
   - Given: preconditions or initial state
   - When: a single main user action
   - And: additional user actions (after When)
   - Then: expected outcome
   - And: additional expected outcomes (after Then)

4. Formatting:
   - Do NOT include numbering (1., 2., 3.) inside steps
   - Each step must be on its own line
   - Do NOT place multiple actions inside a single When step
   - Error messages must be part of Then or And steps

5. Be specific with actions and expected results using actual UI references (buttons, fields, labels).

6. Output ONLY the Gherkin content. No explanation, no markdown fences.
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate Gherkin from AI");
    }

    const data = await response.json();
    let gherkin = data.choices?.[0]?.message?.content?.trim();

    if (!gherkin) {
      throw new Error("No content received from AI");
    }

    // Strip markdown fences if present
    gherkin = gherkin.replace(/^```(?:gherkin)?\n?/i, '').replace(/\n?```$/i, '').trim();

    return new Response(
      JSON.stringify({ gherkin }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-gherkin error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
