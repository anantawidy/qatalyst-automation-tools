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
  const lower = moduleName.toLowerCase();

  const frameworkDetails: Record<string, { lang: string; importStyle: string; stepSyntax: string; adapterExample: string }> = {
    playwright: {
      lang: "TypeScript",
      importStyle: `import { Given, When, Then } from '@cucumber/cucumber';`,
      stepSyntax: `Given('the user navigates to the login page', async function () {
  await ${lower}Actions.navigateToLogin();
});

When('the user logs in with username {string} and password {string}', async function (username: string, password: string) {
  await ${lower}Actions.login(username, password);
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
    },
    selenium: {
      lang: "JavaScript",
      importStyle: `const { Given, When, Then } = require('@cucumber/cucumber');`,
      stepSyntax: `Given('the user navigates to the login page', async function () {
  await ${lower}Actions.navigateToLogin();
});

When('the user logs in with username {string} and password {string}', async function (username, password) {
  await ${lower}Actions.login(username, password);
});`,
      adapterExample: `const { By, until } = require('selenium-webdriver');

class ${moduleName}Adapter {
  constructor(driver) { this.driver = driver; }
  async navigateTo(url) { await this.driver.get(url); }
  async fill(selector, value) {
    const el = await this.driver.findElement(By.css(selector));
    await el.clear();
    await el.sendKeys(value);
  }
  async click(selector) { await this.driver.findElement(By.css(selector)).click(); }
  async getText(selector) { return await this.driver.findElement(By.css(selector)).getText(); }
}`,
    },
    cypress: {
      lang: "JavaScript",
      importStyle: `import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';`,
      stepSyntax: `Given('the user navigates to the login page', () => {
  ${lower}Actions.navigateToLogin();
});

When('the user logs in with username {string} and password {string}', (username, password) => {
  ${lower}Actions.login(username, password);
});`,
      adapterExample: `class ${moduleName}Adapter {
  navigateTo(url) { cy.visit(url); }
  fill(selector, value) { cy.get(selector).clear().type(value); }
  click(selector) { cy.get(selector).click(); }
  getText(selector) { return cy.get(selector).invoke('text'); }
  isVisible(selector) { cy.get(selector).should('be.visible'); }
}`,
    },
    robot: {
      lang: "Robot Framework",
      importStyle: `*** Settings ***\nLibrary    SeleniumLibrary`,
      stepSyntax: `*** Keywords ***
Navigate To Login Page
    ${moduleName} Actions.Navigate To Login

Login With Credentials
    [Arguments]    \${username}    \${password}
    ${moduleName} Actions.Login    \${username}    \${password}`,
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
    },
  };

  const fw = frameworkDetails[framework];

  return `
You are a senior BDD automation architect building a PRODUCTION-GRADE framework-agnostic BDD engine.

## INPUT

**Gherkin Scenarios:**
${gherkin}

**Test Cases (context):**
${JSON.stringify(testCases, null, 2)}

**Locators:**
${JSON.stringify(locators, null, 2)}

**Test Data:**
${JSON.stringify(testData, null, 2)}

**Target Framework:** ${framework}
**Module Name:** ${moduleName}

## CRITICAL RULES — READ BEFORE GENERATING

### RULE 1: STEP CONSOLIDATION (MANDATORY)
Detect and MERGE semantically similar steps into ONE step definition using regex alternation.

Example — these MUST become ONE step:
- "the user clicks the login button"
- "the user submits the login form"
- "the user proceeds to login"

→ Generate:
When(/^the user (?:clicks the login button|submits the login form|proceeds to login)$/, async function () {
  await ${lower}Actions.submitLogin();
});

### RULE 2: HIGH-LEVEL BUSINESS STEPS ONLY (MANDATORY)
NEVER generate atomic steps like:
- "the user enters username"
- "the user enters password"
- "the user clicks login"

ALWAYS prefer ONE business-level step:
When('the user logs in with username {string} and password {string}', async function (username, password) {
  await ${lower}Actions.login(username, password);
});

### RULE 3: STRICT PARAMETERIZATION
NEVER hardcode values in step text.
❌ BAD: When('the user provides a valid username', ...)
✅ GOOD: When('the user logs in with username {string} and password {string}', ...)
✅ GOOD: Then('the user should see error message {string}', ...)

### RULE 4: ZERO DUPLICATION
- No duplicate step definitions (even with different wording)
- No duplicate action methods (login, doLogin, performLogin → ONLY login())
- Reuse steps across scenarios via parameterization

### RULE 5: NAMING STANDARDIZATION
Actions MUST use these naming patterns:
✅ login(), navigateToLogin(), verifyLoginSuccess(), verifyErrorMessage()
❌ doLogin(), performLogin(), loginUser(), checkLogin()

### RULE 6: CLEAN SEPARATION
- Step Definitions → call ONLY Actions (never locators or framework APIs)
- Actions → call ONLY Adapter (never framework APIs directly)
- Adapter → ONLY layer that knows about ${framework}
- Data → separate file, never hardcoded

## ARCHITECTURE

### 1. STEP DEFINITIONS
- Language: ${fw.lang}
- Import: ${fw.importStyle}
- Parse ALL Gherkin steps, merge similar ones via regex
- Each step calls Actions layer only
- All dynamic values parameterized with {string}, {int}
- Example:
${fw.stepSyntax}

### 2. ACTIONS LAYER (Framework-Agnostic)
- File: core/actions/${lower}Actions
- High-level business methods:
  - login(username, password) — combines fill username + fill password + click submit
  - navigateToLogin()
  - verifyLoginSuccess()
  - verifyErrorMessage(expectedMessage)
  - loginAs(role) — if role-based patterns detected
- Auto-detect atomic action patterns and compose them:
  enterUsername + enterPassword + submitLogin → login(username, password)
- Include setAdapter() or constructor for dependency injection
- MUST NOT import any framework code

### 3. FRAMEWORK ADAPTER
- File: adapters/${framework}/${lower}Adapter
- Implements generic actions → ${framework} commands
- Uses provided locators
- Example:
${fw.adapterExample}

### 4. DATA FILE
- Valid JSON with flat structure
- All test data extracted from Gherkin and test cases
- Include valid/invalid credential sets, URLs, expected messages

## OUTPUT FORMAT
Output exactly with these separators. No markdown fences. No extra text.

===STEP_DEFINITIONS_START===
// Step definition code here
===STEP_DEFINITIONS_END===

===ACTIONS_START===
// Actions layer code here
===ACTIONS_END===

===ADAPTER_START===
// Framework adapter code here
===ADAPTER_END===

===DATA_FILE_START===
// JSON data file here
===DATA_FILE_END===
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
        temperature: 0.15,
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
