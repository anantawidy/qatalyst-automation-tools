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
    const moduleName = String(body.moduleName || "Login").slice(0, 50);
    const gherkinScenarios = body.gherkinScenarios ? String(body.gherkinScenarios).slice(0, 10000) : "";
    const lower = moduleName.toLowerCase();
    const featureFile = `${lower}.feature`;
    const stepsFile = `${lower}.steps.js`;
    const pageFile = `${lower}.page.js`;
    const pageClass = `${moduleName}Page`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Service configuration error. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `
You are a senior QA automation engineer expert in Playwright + Cucumber BDD (JavaScript only, NO TypeScript).

Given this test data:

Test Cases:
${JSON.stringify(testCases, null, 2)}

Locators:
${JSON.stringify(locators, null, 2)}

Test Data:
${JSON.stringify(testData, null, 2)}

Generate a Cucumber BDD project for Playwright with FOUR outputs:

**STRICT RULES:**
- Pure JavaScript only (NO TypeScript, NO type annotations, NO interfaces, NO generics)
- Use require() and module.exports — NEVER import/export ES syntax
- Each test case = one Gherkin Scenario tagged with its TC id (e.g. @TC_LOGIN_001)
- Reuse identical Gherkin steps across scenarios (deduplicate)
- Step definitions use this.page and this.${lower}Page (World context)
- NO hardcoded test data inside steps or page object — load from testData.json
- NO hardcoded locators inside step definitions — only inside the Page Object

**1) FEATURE FILE (${featureFile})**
- Standard Gherkin: Feature, scenario tags (@TC_xxx above each Scenario), Scenario, Given/When/Then/And
- Concise, declarative, business-readable language
- **USE Scenario Outline + Examples** when multiple test cases share the same steps but vary by data (e.g. login with different invalid credentials, form validations).
  - Include a 'tc' column in Examples to track Test Case IDs (e.g. | tc | username | password | error_message |)
  - Use angle-bracket placeholders <username>, <password>, <error_message> in the steps
  - Tag the Scenario Outline with all related TC ids (e.g. @TC_LOGIN_001 @TC_LOGIN_002)
- Keep single-data test cases as regular Scenario (not Outline)

**2) STEP DEFINITIONS (${stepsFile})**
- const { Given, When, Then } = require('@cucumber/cucumber');
- const { ${pageClass} } = require('../pages/${pageFile}');
- const data = require('../data/testData.json');
- Use {string} / {int} parameters in step patterns to consume Examples values
- Each step body calls Page Object methods via this.${lower}Page
- Initialize this.${lower}Page = new ${pageClass}(this.page) inside the first Given step
- Reuse one definition for steps that repeat across scenarios

**3) PAGE OBJECT (${pageFile})** — Playwright SEMANTIC LOCATORS only
- const { expect } = require('@playwright/test');
- class ${pageClass} { constructor(page) { this.page = page; /* locators here */ } ... }
- **MANDATORY: All locators MUST be arrow-function getters using Playwright semantic locators**
  Example:
    this.usernameInput = () => this.page.getByLabel('Username');
    this.passwordInput = () => this.page.getByLabel('Password');
    this.loginButton  = () => this.page.getByRole('button', { name: 'Login' });
    this.errorBox     = () => this.page.getByRole('alert');
  Dynamic example:
    this.productByName = (name) => this.page.getByText(name, { exact: true });
- **Locator priority (use first that applies):**
  1. getByRole('button'|'textbox'|'combobox'|'checkbox'|'alert'|..., { name: '...' })
  2. getByLabel('...')
  3. getByPlaceholder('...')
  4. getByText('...', { exact: true })
  5. getByTestId('...')
  6. page.locator('css') — LAST RESORT only
- **NEVER use** page.locator('id=...'), page.locator('class=...'), or raw '#id'/'.class' selectors when a semantic locator can express the element
- Methods invoke locators with parens: await this.usernameInput().fill(value);
- Assertions inside Page Object methods using expect()
- module.exports = { ${pageClass} };

**4) DATA FILE (testData.json)**
- Valid JSON, flat global structure
- Only sensitive/shared data (base URL, valid admin credentials). Do NOT duplicate data already inlined in Examples tables.

**OUTPUT FORMAT — exact separators, no markdown fences, no extra text:**

===FEATURE_FILE_START===
// .feature content
===FEATURE_FILE_END===

===STEPS_FILE_START===
// step definitions JS content
===STEPS_FILE_END===

===PAGE_OBJECT_START===
// page object JS content
===PAGE_OBJECT_END===

===DATA_FILE_START===
// JSON content
===DATA_FILE_END===

${gherkinScenarios ? `\n**EXISTING GHERKIN CONTEXT** (align step wording with this where possible):\n${gherkinScenarios}\n` : ''}
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

    const featureMatch = content.match(/===FEATURE_FILE_START===([\s\S]*?)===FEATURE_FILE_END===/);
    const stepsMatch = content.match(/===STEPS_FILE_START===([\s\S]*?)===STEPS_FILE_END===/);
    const pageObjectMatch = content.match(/===PAGE_OBJECT_START===([\s\S]*?)===PAGE_OBJECT_END===/);
    const dataFileMatch = content.match(/===DATA_FILE_START===([\s\S]*?)===DATA_FILE_END===/);

    return new Response(
      JSON.stringify({
        featureFile: featureMatch?.[1]?.trim() || '',
        testFile: stepsMatch?.[1]?.trim() || '',
        pageObject: pageObjectMatch?.[1]?.trim() || '',
        dataFile: dataFileMatch?.[1]?.trim() || '',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-playwright error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate code. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
