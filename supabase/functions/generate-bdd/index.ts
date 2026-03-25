import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TEST_CASES = 50;
const MAX_STRING_LENGTH = 1000;

function validatePayload(body: any): string | null {
  if (!body?.gherkinScenarios || typeof body.gherkinScenarios !== "string") {
    return "No Gherkin scenarios provided.";
  }
  if (!body?.framework || !["playwright", "selenium", "cypress", "robot"].includes(body.framework)) {
    return "Invalid framework. Choose: playwright, selenium, cypress, robot.";
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

function buildPrompt(framework: string, gherkin: string, testCases: any[], locators: any, testData: any, moduleName: string): string {
  const frameworkDetails: Record<string, { lang: string; stepSyntax: string; adapterExample: string; stepDefExample: string }> = {
    playwright: {
      lang: "TypeScript",
      stepSyntax: `import { Given, When, Then } from '@cucumber/cucumber';
import { actions } from '../core/actions/${moduleName.toLowerCase()}Actions';

Given('the user navigates to login page', async function () {
  await actions.navigateToLogin();
});`,
      adapterExample: `import { Page } from '@playwright/test';

export class ${moduleName}Adapter {
  constructor(private page: Page) {}

  async navigateTo(url: string) { await this.page.goto(url); }
  async fill(selector: string, value: string) { await this.page.fill(selector, value); }
  async click(selector: string) { await this.page.click(selector); }
  async getText(selector: string) { return await this.page.textContent(selector); }
  async isVisible(selector: string) { return await this.page.isVisible(selector); }
}`,
      stepDefExample: `Given('...', async function() { await actions.methodName(); });`
    },
    selenium: {
      lang: "JavaScript",
      stepSyntax: `const { Given, When, Then } = require('@cucumber/cucumber');
const actions = require('../core/actions/${moduleName.toLowerCase()}Actions');

Given('the user navigates to login page', async function () {
  await actions.navigateToLogin();
});`,
      adapterExample: `const { By, until } = require('selenium-webdriver');

class ${moduleName}Adapter {
  constructor(driver) { this.driver = driver; }

  async navigateTo(url) { await this.driver.get(url); }
  async fill(selector, value) { await this.driver.findElement(By.css(selector)).sendKeys(value); }
  async click(selector) { await this.driver.findElement(By.css(selector)).click(); }
  async getText(selector) { return await this.driver.findElement(By.css(selector)).getText(); }
}`,
      stepDefExample: `Given('...', async function() { await actions.methodName(); });`
    },
    cypress: {
      lang: "JavaScript",
      stepSyntax: `import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import actions from '../core/actions/${moduleName.toLowerCase()}Actions';

Given('the user navigates to login page', () => {
  actions.navigateToLogin();
});`,
      adapterExample: `class ${moduleName}Adapter {
  navigateTo(url) { cy.visit(url); }
  fill(selector, value) { cy.get(selector).clear().type(value); }
  click(selector) { cy.get(selector).click(); }
  getText(selector) { return cy.get(selector).invoke('text'); }
  isVisible(selector) { cy.get(selector).should('be.visible'); }
}`,
      stepDefExample: `Given('...', () => { actions.methodName(); });`
    },
    robot: {
      lang: "Robot Framework",
      stepSyntax: `*** Keywords ***
# Step: Given the user navigates to login page
Navigate To Login Page
    actions.Navigate To Login`,
      adapterExample: `*** Keywords ***
Navigate To URL
    [Arguments]    \${url}
    Open Browser    \${url}    chrome
    Maximize Browser Window

Fill Field
    [Arguments]    \${locator}    \${value}
    Wait Until Element Is Visible    \${locator}    10s
    Input Text    \${locator}    \${value}

Click Element By Locator
    [Arguments]    \${locator}
    Wait Until Element Is Visible    \${locator}    10s
    Click Element    \${locator}`,
      stepDefExample: `# Keyword maps to Gherkin step`
    }
  };

  const fw = frameworkDetails[framework];

  return `
You are a senior BDD automation architect building a TRUE framework-agnostic BDD automation engine.

## INPUT

**Gherkin Scenarios:**
${gherkin}

**Test Cases (for context):**
${JSON.stringify(testCases, null, 2)}

**Locators:**
${JSON.stringify(locators, null, 2)}

**Test Data:**
${JSON.stringify(testData, null, 2)}

**Target Framework:** ${framework}
**Module Name:** ${moduleName}

## ARCHITECTURE

You must generate a layered BDD architecture with FOUR outputs:

### 1. STEP DEFINITIONS
- Parse ALL Gherkin steps (Given/When/Then/And/But)
- Deduplicate similar steps (e.g., "user enters username" and "user provides username" → ONE step)
- Parameterize static values: "standard_user" → {string}
- Each step calls the ABSTRACTION LAYER (actions), NOT framework code directly
- Language: ${fw.lang}
- Example syntax:
${fw.stepSyntax}

### 2. ABSTRACTION LAYER (Actions)
- Framework-INDEPENDENT action functions
- File: core/actions/${moduleName.toLowerCase()}Actions
- High-level methods: login(), navigateToLogin(), verifyLoginSuccess(), verifyErrorMessage()
- Smart mapping: detect patterns like (enter username + enter password + click login) → login()
- Each action delegates to the ADAPTER (injected dependency)
- MUST NOT import any framework-specific code
- Include a setAdapter() or constructor to inject the framework adapter

### 3. FRAMEWORK ADAPTER
- Implements the actual framework-specific commands
- File: adapters/${framework}/${moduleName.toLowerCase()}Adapter
- Translates generic actions (fill, click, navigate, getText, isVisible) into ${framework} commands
- Uses the locators provided
- Example:
${fw.adapterExample}

### 4. DATA FILE
- Valid JSON with flat global structure
- All test data extracted from the Gherkin scenarios and test cases
- File: testData.json

## RULES
- NO hardcoded test data in step definitions or actions
- NO duplicate step definitions
- Step definitions call ONLY actions, never framework APIs directly
- Actions call ONLY the adapter, never framework APIs directly
- Adapter is the ONLY layer that knows about ${framework}
- All parameterized values use {string}, {int}, etc.
- Generated code must be production-ready
- Maintain a clear dependency chain: Steps → Actions → Adapter → Framework

## OUTPUT FORMAT
Output exactly in this format with separators:

===STEP_DEFINITIONS_START===
// Step definition code here
===STEP_DEFINITIONS_END===

===ACTIONS_START===
// Abstraction layer / actions code here
===ACTIONS_END===

===ADAPTER_START===
// Framework adapter code here
===ADAPTER_END===

===DATA_FILE_START===
// JSON data file here
===DATA_FILE_END===

Do not include any other text, comments outside the blocks, or markdown code fences.
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const validationError = validatePayload(body);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const framework = body.framework;
    const gherkin = String(body.gherkinScenarios).slice(0, 15000);
    const moduleName = String(body.moduleName || "Login").slice(0, 50);
    const { testCases, locators, testData } = sanitizePayload(body);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service configuration error." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(framework, gherkin, testCases, locators, testData, moduleName);

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
        JSON.stringify({ error: "Failed to generate BDD code. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Failed to generate BDD code. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stepDefsMatch = content.match(/===STEP_DEFINITIONS_START===([\s\S]*?)===STEP_DEFINITIONS_END===/);
    const actionsMatch = content.match(/===ACTIONS_START===([\s\S]*?)===ACTIONS_END===/);
    const adapterMatch = content.match(/===ADAPTER_START===([\s\S]*?)===ADAPTER_END===/);
    const dataMatch = content.match(/===DATA_FILE_START===([\s\S]*?)===DATA_FILE_END===/);

    return new Response(
      JSON.stringify({
        stepDefinitions: stepDefsMatch?.[1]?.trim() || '',
        actions: actionsMatch?.[1]?.trim() || '',
        adapter: adapterMatch?.[1]?.trim() || '',
        dataFile: dataMatch?.[1]?.trim() || '',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-bdd error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate BDD code. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
