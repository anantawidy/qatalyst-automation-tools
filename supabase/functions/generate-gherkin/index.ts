import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_URL_LENGTH = 500;
const MAX_DESC_LENGTH = 2000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const url = body?.url;
    const scenarioDesc = body?.scenarioDesc;

    // Input validation
    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "A valid URL is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (url.length > MAX_URL_LENGTH) {
      return new Response(
        JSON.stringify({ error: `URL must be less than ${MAX_URL_LENGTH} characters.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!scenarioDesc || typeof scenarioDesc !== "string" || scenarioDesc.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "A scenario description of at least 5 characters is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (scenarioDesc.length > MAX_DESC_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Scenario description must be less than ${MAX_DESC_LENGTH} characters.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedUrl = url.trim().slice(0, MAX_URL_LENGTH);
    const sanitizedDesc = scenarioDesc.trim().slice(0, MAX_DESC_LENGTH);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Service configuration error. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are a senior QA engineer writing Gherkin BDD scenarios.

Generate a Gherkin feature file based on this info:
URL: ${sanitizedUrl}
Scenario description: ${sanitizedDesc}

STRICT FORMAT RULES — YOU MUST FOLLOW EVERY RULE EXACTLY:

1. Start with a Feature line, then the BDD narrative (each on its own line, indented with 2 spaces):
   Feature: <Feature Name>
     As a <role>
     I want <goal>
     So that <benefit>

2. Scenario naming:
   - Concise, readable titles
   - Do NOT include numbered steps, URLs, or technical IDs in scenario titles
   - Good: "Scenario: Successful login with valid credentials"
   - Bad: "Scenario: 1. Navigate to https://example.com and login"

3. Step structure — each step MUST be on its own line with proper indentation (4 spaces):
   - Given: preconditions or initial state (ONE precondition per line)
   - When: a SINGLE main user action
   - And: additional user actions (each on its own line, after When)
   - Then: ONE expected outcome
   - And: additional expected outcomes (each on its own line, after Then)

4. CRITICAL formatting rules:
   - Do NOT include numbering (1., 2., 3.) inside steps — NEVER
   - Do NOT place multiple actions inside a single When step
   - Do NOT leave raw text outside of Gherkin steps
   - Do NOT add blank lines between steps within a scenario
   - Add ONE blank line between scenarios
   - Error messages MUST be part of Then or And steps, e.g.:
     Then an error message "Epic sadface: Username is required" should be displayed

5. Be specific with actions and expected results using actual UI references (buttons, fields, labels).

6. Output ONLY the Gherkin content. No explanation, no markdown fences, no comments.

EXAMPLE OUTPUT FORMAT:
Feature: Login Functionality
  As a user
  I want to login into the system
  So that I can access the products page

  Scenario: Successful login with valid credentials
    Given the user is on the login page
    When the user enters a valid username
    And the user enters a valid password
    And the user clicks the Login button
    Then the user should be redirected to the Products page

  Scenario: Login fails with invalid credentials
    Given the user is on the login page
    When the user enters an invalid username
    And the user enters a valid password
    And the user clicks the Login button
    Then an error message should be displayed
    And the error message should be "Epic sadface: Username and password do not match any user in this service"
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
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI Generation limit reached. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Failed to generate Gherkin. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let gherkin = data.choices?.[0]?.message?.content?.trim();

    if (!gherkin) {
      console.error("No content received from AI");
      return new Response(
        JSON.stringify({ error: "Failed to generate Gherkin. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      JSON.stringify({ error: "Failed to generate Gherkin. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
