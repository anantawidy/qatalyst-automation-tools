import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TEST_CASES = 50;
const MAX_STRING_LENGTH = Number.MAX_SAFE_INTEGER;

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
    const moduleName = String(body.moduleName || "Login").slice(0, 50);
    const gherkinScenarios = body.gherkinScenarios ? String(body.gherkinScenarios).slice(0, 10000) : "";
    const lower = moduleName.toLowerCase();
    const featureFile = `${lower}.feature`;
    const stepsFile = `${lower}.steps.js`;
    const pageFile = `${lower}.page.js`;
    const pageClass = `${moduleName}Page`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service configuration error. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `
You are a senior QA automation engineer expert in Selenium WebDriver + Cucumber BDD (JavaScript only, NO TypeScript).

Test Cases:
${JSON.stringify(testCases, null, 2)}

Locators:
${JSON.stringify(locators, null, 2)}

Test Data:
${JSON.stringify(testData, null, 2)}

Generate a Cucumber BDD project for Selenium with THREE outputs (NO data file).

**STRICT RULES:**
- Pure JavaScript only (NO TypeScript)
- require() / module.exports only
- Each test case = one Gherkin Scenario tagged @TC_xxx
- Reuse identical Gherkin steps across scenarios
- Step definitions use this.driver and this.${lower}Page from the Cucumber World
- **DO NOT create or import any testData.json / data.json file. NO require('../data/...').**
- All variable test values MUST live inside the Examples table of the .feature file
- Static values (baseUrl, fixed creds) MUST be hardcoded directly inside the step definition — NEVER abstracted to a data file
- NO hardcoded locators inside step definitions

**1) FEATURE FILE (${featureFile})**
Standard Gherkin with @TC tag above each Scenario.
- USE Scenario Outline + Examples table when multiple test cases share the same steps but vary by data. Include a 'tc' column for Test Case IDs and tag the outline with all related @TC ids. Keep single-data tests as plain Scenario.
- In step definitions, use {string}/{int} parameters to consume Examples values.

**2) STEP DEFINITIONS (${stepsFile})**
- const { Given, When, Then } = require('@cucumber/cucumber');
- const { ${pageClass} } = require('../pages/${pageFile}');
- **DO NOT** require any data/testData/json file
- Use {string}/{int} parameters in step patterns to consume values directly from the Examples table
- For steps with no varying data (like navigate), hardcode the value (e.g. baseUrl) directly inside the step body
- Initialize this.${lower}Page = new ${pageClass}(this.driver) in the first Given
- Steps call Page Object methods only

**3) PAGE OBJECT (${pageFile})**
- const { By, until } = require('selenium-webdriver');
- class ${pageClass} { constructor(driver) { this.driver = driver; ... } }
- Locators defined as By.* in constructor
- Reusable async methods + assertions inside the class
- module.exports = { ${pageClass} };

**OUTPUT FORMAT — exact separators, no markdown fences, no extra text:**

===FEATURE_FILE_START===
===FEATURE_FILE_END===

===STEPS_FILE_START===
===STEPS_FILE_END===

===PAGE_OBJECT_START===
===PAGE_OBJECT_END===

${gherkinScenarios ? `\n**EXISTING GHERKIN CONTEXT:**\n${gherkinScenarios}\n` : ''}
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
        return new Response(JSON.stringify({ error: "AI Generation limit reached. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Failed to generate code. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return new Response(JSON.stringify({ error: "Failed to generate code. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const featureMatch = content.match(/===FEATURE_FILE_START===([\s\S]*?)===FEATURE_FILE_END===/);
    const stepsMatch = content.match(/===STEPS_FILE_START===([\s\S]*?)===STEPS_FILE_END===/);
    const pageObjectMatch = content.match(/===PAGE_OBJECT_START===([\s\S]*?)===PAGE_OBJECT_END===/);

    return new Response(
      JSON.stringify({
        featureFile: featureMatch?.[1]?.trim() || '',
        testFile: stepsMatch?.[1]?.trim() || '',
        pageObject: pageObjectMatch?.[1]?.trim() || '',
        dataFile: '',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-selenium error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate code. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
