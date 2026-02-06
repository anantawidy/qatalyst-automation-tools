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
You are a senior QA automation engineer expert in Playwright.

Given this test data:

Test Cases:
${JSON.stringify(testCases, null, 2)}

Locators:
${JSON.stringify(locators, null, 2)}

Test Data:
${JSON.stringify(testData, null, 2)}

Generate Playwright test code with THREE separate outputs:

**REQUIREMENTS:**
1. Use Playwright Test Runner (@playwright/test)
2. Must implement Page Object Model (POM)
3. Each test file should create ONE page instance per file (not global across multiple files)
4. Use beforeEach to instantiate the Page Object
5. All assertions should preferably be inside the Page Object methods
6. DO NOT hardcode locators or test data inside test files

**PAGE OBJECT FILE:**
- All locators as class properties (imported or defined)
- Reusable action methods (login, fillForm, clickButton, etc.)
- Use getByRole, getByLabel, getByPlaceholder, getByText where possible
- Fallback to locator() for CSS/XPath selectors
- Import test data from data file

**TEST FILE:**
- Clean and high-level, calling Page Object methods
- Use describe() block for grouping
- Each test case as separate test() block
- Use beforeEach to create Page Object instance
- NO hardcoded test data - reference data file values

**DATA FILE (testData.json):**
- Valid JSON with flat global structure (not nested per-scenario)
- Store all test data: username, password, invalidUsername, invalidPassword, emptyUsername, emptyPassword, errorMessage, etc.
- Tests reference these fields explicitly

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
// Page Object file content here
===PAGE_OBJECT_END===

===TEST_FILE_START===
// Test file content here
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
      throw new Error("Failed to generate Playwright code from AI");
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
    console.error("generate-playwright error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
