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
    const { testCases, locators, testData } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `
You are a senior QA automation engineer expert in Cypress.

Given this test data:

Test Cases:
${JSON.stringify(testCases, null, 2)}

Locators:
${JSON.stringify(locators, null, 2)}

Test Data:
${JSON.stringify(testData, null, 2)}

Generate Cypress test code using Mocha structure with custom commands. Output TWO separate files:

**REQUIREMENTS:**
1. Use Cypress with Mocha test runner (describe, it, before, beforeEach)
2. Create a Commands file (for cypress/support/commands.js) with:
   - Custom commands for reusable actions (cy.login, cy.fillForm, etc.)
   - All locators defined as constants at the top
   - Use Cypress.Commands.add() syntax
   - Chain commands properly
3. Create a Test file (spec file) with:
   - Use describe() and it() blocks
   - before() hook for one-time setup (visit page)
   - All test cases in the same describe block share browser session
   - Call custom commands instead of direct cy.get() where possible
   - Use proper Cypress assertions (.should())
4. Use cy.get(), cy.contains(), cy.find() for element selection
5. Leverage Cypress auto-waiting (no explicit waits)

**OUTPUT FORMAT:**
Output exactly in this format with the separators:

===PAGE_OBJECT_START===
// Custom Commands file content here (for cypress/support/commands.js)
===PAGE_OBJECT_END===

===TEST_FILE_START===
// Test spec file content here
===TEST_FILE_END===

Do not include any other text, comments, or markdown code blocks.
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
        temperature: 0.2,
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
      throw new Error("Failed to generate Cypress code from AI");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("No content received from AI");
    }

    // Parse the two files from the response
    const pageObjectMatch = content.match(/===PAGE_OBJECT_START===([\s\S]*?)===PAGE_OBJECT_END===/);
    const testFileMatch = content.match(/===TEST_FILE_START===([\s\S]*?)===TEST_FILE_END===/);

    const pageObject = pageObjectMatch?.[1]?.trim() || '';
    const testFile = testFileMatch?.[1]?.trim() || '';

    return new Response(
      JSON.stringify({ pageObject, testFile }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-cypress error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
