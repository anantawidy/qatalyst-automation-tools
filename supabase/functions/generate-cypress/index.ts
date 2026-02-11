import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TEST_CASES = 50;
const MAX_STRING_LENGTH = 1000;

function validateAutomationPayload(body: any): string | null {
  if (!body?.testCases || !Array.isArray(body.testCases) || body.testCases.length === 0) {
    return "No test cases provided. Please upload a valid CSV first.";
  }
  if (body.testCases.length > MAX_TEST_CASES) {
    return `Too many test cases. Maximum is ${MAX_TEST_CASES}.`;
  }
  for (const tc of body.testCases) {
    if (tc.steps && typeof tc.steps === "string" && tc.steps.length > MAX_STRING_LENGTH) {
      return `Test case step too long (max ${MAX_STRING_LENGTH} chars).`;
    }
    if (tc.expected && typeof tc.expected === "string" && tc.expected.length > MAX_STRING_LENGTH) {
      return `Test case expected result too long (max ${MAX_STRING_LENGTH} chars).`;
    }
  }
  return null;
}

function sanitizePayload(body: any) {
  const testCases = (body.testCases || []).slice(0, MAX_TEST_CASES).map((tc: any) => ({
    id: String(tc.id || "").slice(0, 100),
    description: String(tc.description || "").slice(0, MAX_STRING_LENGTH),
    steps: String(tc.steps || "").slice(0, MAX_STRING_LENGTH),
    expected: String(tc.expected || "").slice(0, MAX_STRING_LENGTH),
  }));
  const locators = body.locators && typeof body.locators === "object" ? body.locators : {};
  const testData = body.testData && typeof body.testData === "object" ? body.testData : {};
  return { testCases, locators, testData };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const validationError = validateAutomationPayload(body);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { testCases, locators, testData } = sanitizePayload(body);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Service configuration error. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

**TEST FILE (spec file):**
- Use describe() and it() blocks
- before() hook for one-time setup (visit page)
- Call custom commands instead of direct cy.get() where possible
- Use proper Cypress assertions (.should())
- NO hardcoded test data - load from fixture

**DATA FILE (testData.json):**
- Valid JSON with flat global structure (not nested per-scenario)
- Store all test data

**OUTPUT FORMAT:**
Output exactly in this format with the separators:

===PAGE_OBJECT_START===
// Custom Commands file content here
===PAGE_OBJECT_END===

===TEST_FILE_START===
// Test spec file content here
===TEST_FILE_END===

===DATA_FILE_START===
// JSON data file content here
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
        JSON.stringify({ error: "Failed to generate code. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error("No content received from AI");
      return new Response(
        JSON.stringify({ error: "Failed to generate code. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pageObjectMatch = content.match(/===PAGE_OBJECT_START===([\s\S]*?)===PAGE_OBJECT_END===/);
    const testFileMatch = content.match(/===TEST_FILE_START===([\s\S]*?)===TEST_FILE_END===/);
    const dataFileMatch = content.match(/===DATA_FILE_START===([\s\S]*?)===DATA_FILE_END===/);

    return new Response(
      JSON.stringify({
        pageObject: pageObjectMatch?.[1]?.trim() || '',
        testFile: testFileMatch?.[1]?.trim() || '',
        dataFile: dataFileMatch?.[1]?.trim() || '',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-cypress error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate code. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
