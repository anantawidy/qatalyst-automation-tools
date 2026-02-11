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

    const prompt = `You are a senior QA engineer and BDD specialist. Your task is to TRANSFORM the provided scenario description into properly structured Gherkin BDD scenarios.

CRITICAL: You must REWRITE and TRANSFORM the input into natural BDD language. Do NOT copy raw input text directly into steps. Convert imperative instructions into declarative, human-readable Gherkin.

INPUT:
URL: ${sanitizedUrl}
Scenario description: ${sanitizedDesc}

══════════════════════════════════════════
STRICT FORMAT RULES — VIOLATING ANY RULE IS A FAILURE
══════════════════════════════════════════

1. FEATURE HEADER (required):
   Feature: <Short Descriptive Name>
     As a <role>
     I want <goal>
     So that <benefit>

2. SCENARIO TITLES:
   - Concise, descriptive, human-readable
   - NEVER include numbered steps (1., 2., 3.)
   - NEVER include URLs or technical identifiers
   - NEVER include implementation details
   - GOOD: "Scenario: Successful login with valid credentials"
   - BAD: "Scenario: 1. Navigate to https://example.com and enter username"

3. STEP CLASSIFICATION (each step on its own line, 4-space indent):
   Given → precondition or initial state (ONE per line)
   When  → the FIRST main user action
   And   → additional user actions (after When, one per line)
   Then  → ONE expected outcome
   And   → additional expected outcomes (after Then, one per line)

4. TRANSFORMATION RULES (MANDATORY):
   - REMOVE all numbering (1., 2., 3.) from steps
   - REMOVE URLs from step text — refer to pages by name instead
   - CONVERT imperative steps ("Click the button", "Type username") into natural BDD language ("the user clicks the Login button", "the user enters a valid username")
   - SPLIT compound actions — each And step must contain exactly ONE action
   - NEVER combine multiple actions in a single When or And step
   - NEVER leave raw text, comments, or prose outside of Gherkin steps
   - Error messages MUST appear in Then or And steps:
     Then an error message "Error text here" should be displayed

5. FORMATTING:
   - No blank lines between steps within a scenario
   - ONE blank line between scenarios
   - 2-space indent for narrative (As a/I want/So that)
   - 4-space indent for steps (Given/When/And/Then)
   - No markdown fences, no comments, no explanations

6. OUTPUT: Raw Gherkin text ONLY. Nothing else.

EXAMPLE OUTPUT:
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
