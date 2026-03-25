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

  const adapterExamples: Record<string, string> = {
    playwright: `import { Page } from '@playwright/test';

export class Adapter {
  constructor(page) { this.page = page; }
  async navigate(url) { await this.page.goto(url); }
  async fill(selector, value) { await this.page.fill(selector, value); }
  async click(selector) { await this.page.click(selector); }
  async getText(selector) { return await this.page.textContent(selector); }
  async isVisible(selector) { return await this.page.isVisible(selector); }
}`,
    selenium: `const { By, until } = require('selenium-webdriver');

class Adapter {
  constructor(driver) { this.driver = driver; }
  async navigate(url) { await this.driver.get(url); }
  async fill(selector, value) {
    const el = await this.driver.findElement(By.css(selector));
    await el.clear(); await el.sendKeys(value);
  }
  async click(selector) { await this.driver.findElement(By.css(selector)).click(); }
  async getText(selector) { return await this.driver.findElement(By.css(selector)).getText(); }
  async isVisible(selector) {
    try { return await this.driver.findElement(By.css(selector)).isDisplayed(); }
    catch { return false; }
  }
}`,
    cypress: `class Adapter {
  navigate(url) { cy.visit(url); }
  fill(selector, value) { cy.get(selector).clear().type(value); }
  click(selector) { cy.get(selector).click(); }
  getText(selector) { return cy.get(selector).invoke('text'); }
  isVisible(selector) { cy.get(selector).should('be.visible'); }
}`,
    robot: `*** Keywords ***
Navigate To URL
    [Arguments]    \${url}
    Go To    \${url}

Fill Field
    [Arguments]    \${locator}    \${value}
    Wait Until Element Is Visible    \${locator}    10s
    Input Text    \${locator}    \${value}

Click Element By Locator
    [Arguments]    \${locator}
    Wait Until Element Is Visible    \${locator}    10s
    Click Element    \${locator}

Get Element Text
    [Arguments]    \${locator}
    Wait Until Element Is Visible    \${locator}    10s
    \${text}=    Get Text    \${locator}
    RETURN    \${text}`,
  };

  const isRobot = framework === "robot";

  const stepDefExample = isRobot
    ? `*** Keywords ***
User Navigates To Login Page
    ${moduleName} Page.Navigate

User Logs In With Credentials
    [Arguments]    \${username}    \${password}
    ${moduleName} Page.Login    \${username}    \${password}

User Should See Error Message
    [Arguments]    \${message}
    ${moduleName} Page.Verify Error Message    \${message}`
    : `const { Given, When, Then } = require('@cucumber/cucumber');

Given('the user is on the login page', async function () {
  await this.${lower}Page.navigate();
});

When('the user logs in with username {string} and password {string}', async function (username, password) {
  await this.${lower}Page.login(username, password);
});

Then('the user should see error message {string}', async function (message) {
  await this.${lower}Page.verifyErrorMessage(message);
});`;

  const pageObjectExample = isRobot
    ? `*** Settings ***
Library    Collections
Resource   ../services/adapter.robot

*** Variables ***
\${USERNAME_SELECTOR}    id=user-name
\${PASSWORD_SELECTOR}    id=password
\${LOGIN_BTN_SELECTOR}   id=login-button
\${ERROR_SELECTOR}       css=.error-message-container.error

*** Keywords ***
Navigate
    Navigate To URL    /login

Login
    [Arguments]    \${username}    \${password}
    Fill Field    \${USERNAME_SELECTOR}    \${username}
    Fill Field    \${PASSWORD_SELECTOR}    \${password}
    Click Element By Locator    \${LOGIN_BTN_SELECTOR}

Verify Error Message
    [Arguments]    \${expected}
    \${text}=    Get Element Text    \${ERROR_SELECTOR}
    Should Contain    \${text}    \${expected}`
    : `class ${moduleName}Page {
  constructor(adapter) {
    this.adapter = adapter;
    this.selectors = {
      username: '#user-name',
      password: '#password',
      loginBtn: '#login-button',
      error: '.error-message-container.error'
    };
  }

  async navigate() {
    await this.adapter.navigate('/login');
  }

  async login(username, password) {
    await this.adapter.fill(this.selectors.username, username);
    await this.adapter.fill(this.selectors.password, password);
    await this.adapter.click(this.selectors.loginBtn);
  }

  async verifyLoginSuccess() {
    const visible = await this.adapter.isVisible('.inventory_list');
    if (!visible) throw new Error('Login failed');
  }

  async verifyErrorMessage(message) {
    const text = await this.adapter.getText(this.selectors.error);
    if (!text.includes(message)) throw new Error(\`Expected "\${message}" but got "\${text}"\`);
  }
}

module.exports = ${moduleName}Page;`;

  const worldExample = isRobot
    ? `*** Settings ***
Library    SeleniumLibrary
Resource   pages/${lower}.page.robot
Resource   services/adapter.robot

*** Variables ***
\${BROWSER}    chrome
\${BASE_URL}   http://localhost:3000

*** Keywords ***
Initialize World
    Open Browser    \${BASE_URL}    \${BROWSER}
    Maximize Browser Window`
    : `const { setWorldConstructor } = require('@cucumber/cucumber');
const Adapter = require('./services/adapter');
const ${moduleName}Page = require('./pages/${lower}.page');

class CustomWorld {
  constructor() {
    this.adapter = new Adapter(/* driver/page instance */);
    this.${lower}Page = new ${moduleName}Page(this.adapter);
  }
}

setWorldConstructor(CustomWorld);`;

  const hooksExample = isRobot
    ? `*** Settings ***
Resource    world.robot

*** Keywords ***
Suite Setup Hook
    Initialize World

Suite Teardown Hook
    Close All Browsers

Test Setup Hook
    Delete All Cookies

Test Teardown Hook
    Capture Page Screenshot`
    : `const { Before, After, BeforeAll, AfterAll } = require('@cucumber/cucumber');

Before(async function () {
  // Initialize browser & adapter before each scenario
  // this.adapter.init();
});

After(async function (scenario) {
  if (scenario.result.status === 'FAILED') {
    // Take screenshot on failure
  }
  // Cleanup after each scenario
});

BeforeAll(async function () {
  // Global setup
});

AfterAll(async function () {
  // Global teardown
});`;

  const configExample = isRobot
    ? `*** Variables ***
\${DEFAULT_TIMEOUT}    10s
\${IMPLICIT_WAIT}     5s
\${BASE_URL}          http://localhost:3000
\${BROWSER}           chrome
\${HEADLESS}          false`
    : `module.exports = {
  defaultTimeout: 10000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  browser: process.env.BROWSER || 'chrome',
  headless: process.env.HEADLESS === 'true',
};`;

  const envExample = isRobot
    ? `*** Variables ***
# Environment: dev | staging | prod
\${ENV}               dev

# Environment-specific URLs
\${DEV_URL}           http://localhost:3000
\${STAGING_URL}       https://staging.example.com
\${PROD_URL}          https://www.example.com

*** Keywords ***
Get Base URL
    IF    '\${ENV}' == 'dev'
        RETURN    \${DEV_URL}
    ELSE IF    '\${ENV}' == 'staging'
        RETURN    \${STAGING_URL}
    ELSE
        RETURN    \${PROD_URL}
    END`
    : `const environments = {
  dev: { baseUrl: 'http://localhost:3000' },
  staging: { baseUrl: 'https://staging.example.com' },
  prod: { baseUrl: 'https://www.example.com' },
};

const currentEnv = process.env.TEST_ENV || 'dev';

module.exports = {
  current: currentEnv,
  ...environments[currentEnv],
};`;

  return `
You are a senior BDD automation architect generating a PRODUCTION-GRADE Cucumber project structure.

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

## PROJECT STRUCTURE TO GENERATE

features/
  ui/*.feature (already provided as input)
  step_definitions/ui.steps.${isRobot ? 'robot' : 'js'}
support/
  pages/${lower}.page.${isRobot ? 'robot' : 'js'}
  services/adapter.${isRobot ? 'robot' : 'js'}
  world.${isRobot ? 'robot' : 'js'}
  hooks.${isRobot ? 'robot' : 'js'}
  config.${isRobot ? 'robot' : 'js'}
  env.${isRobot ? 'robot' : 'js'}
data/testData.json

## CRITICAL RULES

### RULE 1: STEP CONSOLIDATION (MANDATORY)
Merge semantically similar steps into ONE definition using regex alternation.
"clicks login" + "submits form" + "proceeds to login" → ONE step with regex.

### RULE 2: HIGH-LEVEL BUSINESS STEPS ONLY
NEVER generate atomic steps (enter username, enter password, click login separately).
ALWAYS prefer ONE business-level step: login(username, password).

### RULE 3: STRICT PARAMETERIZATION
NEVER hardcode values. Use {string}, {int} parameters.

### RULE 4: ZERO DUPLICATION
No duplicate step definitions. No duplicate page object methods.

### RULE 5: CLEAN SEPARATION
- Step Definitions → call ONLY Page Object methods via this.${lower}Page
- Page Object → call ONLY Adapter methods via this.adapter
- Adapter → ONLY layer that knows about ${framework}

### RULE 6: NAMING
Page Object methods: navigate(), login(), verifyLoginSuccess(), verifyErrorMessage()
NO: doLogin(), performLogin(), loginUser()

## LAYER DESCRIPTIONS

### 1. STEP DEFINITIONS (features/step_definitions/ui.steps)
${stepDefExample}

### 2. PAGE OBJECT (support/pages/${lower}.page)
Contains business logic + selectors. Calls adapter only.
${pageObjectExample}

### 3. ADAPTER (support/services/adapter)
Single swappable interface for ${framework}.
${adapterExamples[framework]}

### 4. WORLD (support/world)
Initializes adapter and page objects. Dependency injection.
${worldExample}

### 5. HOOKS (support/hooks)
Before/After scenario lifecycle management.
${hooksExample}

### 6. CONFIG (support/config)
Default settings: timeout, baseUrl, browser, headless.
${configExample}

### 7. ENV (support/env)
Environment switching: dev, staging, prod.
${envExample}

## OUTPUT FORMAT
Output exactly with these separators. No markdown fences. No extra text.

===STEP_DEFINITIONS_START===
// Step definitions code
===STEP_DEFINITIONS_END===

===PAGE_OBJECT_START===
// Page object code
===PAGE_OBJECT_END===

===ADAPTER_START===
// Adapter code
===ADAPTER_END===

===WORLD_START===
// World code
===WORLD_END===

===HOOKS_START===
// Hooks code
===HOOKS_END===

===CONFIG_START===
// Config code
===CONFIG_END===

===ENV_START===
// Env code
===ENV_END===

===DATA_FILE_START===
// JSON test data
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
        model: "google/gemini-2.5-flash",
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

    const extract = (tag: string) => {
      const match = content.match(new RegExp(`===${tag}_START===([\\s\\S]*?)===${tag}_END===`));
      return match?.[1]?.trim() || '';
    };

    return new Response(
      JSON.stringify({
        stepDefinitions: extract('STEP_DEFINITIONS'),
        pageObject: extract('PAGE_OBJECT'),
        adapter: extract('ADAPTER'),
        world: extract('WORLD'),
        hooks: extract('HOOKS'),
        config: extract('CONFIG'),
        env: extract('ENV'),
        dataFile: extract('DATA_FILE'),
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
