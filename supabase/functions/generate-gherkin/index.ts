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
You are a QA engineer generating test scenarios.

Generate a Gherkin feature file based on this info:
URL: ${url}
Scenario description: ${scenarioDesc}

Requirements:
- Include a clear and concise Feature title.
- Break down the description into multiple independent Scenarios (not too big).
- Each Scenario must follow the real user flow logically from start to finish.
- Each Scenario must have Given, When, Then steps.
- Use meaningful step details (e.g., "Given the user navigates to the login page", 
  "When the user fills 'username' with 'validUser'").
- Be specific with actions and expected results, not generic.
- Use actual UI references if possible (buttons, fields, labels).
- Output ONLY the Gherkin content without explanation.
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
    const gherkin = data.choices?.[0]?.message?.content?.trim();

    if (!gherkin) {
      throw new Error("No content received from AI");
    }

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
