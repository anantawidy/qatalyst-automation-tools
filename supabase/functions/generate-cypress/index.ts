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

Generate Cypress test code with THREE separate outputs:

**REQUIREMENTS:**
1. Use Cypress with Mocha structure (describe, it)
2. Implement reusable actions as Cypress Custom Commands in commands.js
3. Page-specific locators should live in a dedicated Page Object file (not inside tests)
4. Tests should be clean and high-level, calling custom commands rather than repeating UI steps
5. Avoid hardcoded waits; use Cypress assertions and automatic retries
6. DO NOT hardcode locators or test data inside test files

**PAGE OBJECT FILE (commands.js):**
- Custom commands for reusable actions (Cypress.Commands.add())
- All locators defined as constants at the top
- Chain commands properly
- Examples: cy.login(), cy.fillForm(), cy.verifyError()

**TEST FILE (spec file):**
- Use describe() and it() blocks
- before() hook for one-time setup (visit page)
- All test cases in the same describe block share browser session
- Call custom commands instead of direct cy.get() where possible
- Use proper Cypress assertions (.should())
- NO hardcoded test data - load from fixture

**DATA FILE (testData.json):**
- Valid JSON with flat global structure (not nested per-scenario)
- Store all test data: username, password, invalidUsername, invalidPassword, emptyUsername, emptyPassword, errorMessage, etc.
- Load via cy.fixture('testData') or import

Example data structure:
{
  "username": "testuser",
  "password": "password123",
  "invalidUsername": "wronguser",
  "invalidPassword": "wrongpass",
  "emptyUsername": "",
  "emptyPassword": "",
  "errorMessage": "Invalid credentials"
}

**OUTPUT FORMAT:**
Output exactly in this format with the separators:

===PAGE_OBJECT_START===
// Custom Commands file content here (for cypress/support/commands.js)
===PAGE_OBJECT_END===

===TEST_FILE_START===
// Test spec file content here
===TEST_FILE_END===

===DATA_FILE_START===
// JSON data file content here (for cypress/fixtures/testData.json)
===DATA_FILE_END===

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

    // Parse the three files from the response
    const pageObjectMatch = content.match(/===PAGE_OBJECT_START===([\s\S]*?)===PAGE_OBJECT_END===/);
    const testFileMatch = content.match(/===TEST_FILE_START===([\s\S]*?)===TEST_FILE_END===/);
    const dataFileMatch = content.match(/===DATA_FILE_START===([\s\S]*?)===DATA_FILE_END===/);

    const pageObject = pageObjectMatch?.[1]?.trim() || '';
    const testFile = testFileMatch?.[1]?.trim() || '';
    const dataFile = dataFileMatch?.[1]?.trim() || '';

    return new Response(
      JSON.stringify({ pageObject, testFile, dataFile }),
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
