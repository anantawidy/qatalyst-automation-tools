import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const validationError = validateAutomationPayload(body);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { testCases, locators, testData } = sanitizePayload(body);

    console.log('Generating Robot Framework code for', testCases.length, 'test cases');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Service configuration error. Please try again later.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `You are an expert Robot Framework automation engineer generating enterprise-grade, production-ready automation code.

INPUT DATA:
Test Cases: ${JSON.stringify(testCases, null, 2)}
Locators: ${JSON.stringify(locators, null, 2)}
Test Data: ${JSON.stringify(testData, null, 2)}

CRITICAL INSTRUCTIONS — FOLLOW EVERY RULE EXACTLY:

OUTPUT THREE sections with these EXACT markers (no other text outside markers):

===DATA_FILE_START===
(testdata.py content)
===DATA_FILE_END===

===KEYWORDS_START===
(keywords.robot content)
===KEYWORDS_END===

===ROBOT_TEST_START===
(tests.robot content)
===ROBOT_TEST_END===

────────────────────────────────────────
SECTION 1: DATA FILE (testdata.py)
────────────────────────────────────────
- Python variables file for Robot Framework (imported via Variables testdata.py)
- FLAT structure only — no dicts, no lists, no nesting
- ALL locators stored as variables using ONLY these valid formats:
    id:xxx        → ID_USERNAME = "id:user-name"
    css=xxx       → CSS_TITLE = "css=.title"
    css=#xxx      → CSS_CONTAINER = "css=#inventory_container"
    xpath:xxx     → XPATH_CART = "xpath://div[@class='cart']"
    name:xxx      → NAME_EMAIL = "name:email"
- NEVER use invalid formats like "class:xxx" or "className:xxx"
- ALL test data stored here: URLs, credentials, expected texts, error messages
- Consistent naming: PREFIX_ELEMENTNAME (e.g., ID_USERNAME, CSS_LOGIN_BTN, VALID_USER, ERR_MSG_LOCKED)

────────────────────────────────────────
SECTION 2: KEYWORDS FILE (keywords.robot)
────────────────────────────────────────
*** Settings ***
Library    SeleniumLibrary
Variables    testdata.py

*** Keywords ***
- Create a reusable keyword for EVERY UI interaction
- Keywords MUST accept [Arguments] for dynamic data
- MANDATORY: Before EVERY click, input, or interaction, add:
    Wait Until Element Is Visible    \${LOCATOR_VAR}    10s
- Do NOT duplicate waits (one wait per interaction, not two)
- Use Title Case keyword names: "Input Username", "Click Login Button", "Verify Error Message"
- NEVER hardcode locators — always use \${VAR} from testdata.py
- NEVER hardcode test data inside keywords — pass via arguments
- Assertions MUST be inside keywords (e.g., "Verify Page Title", "Verify Error Message Is Displayed")
- For URL verification prefer:
    Wait Until Location Contains    expected-path    10s
  instead of strict full URL equality
- Example:
    Input Username
        [Arguments]    \${username}
        Wait Until Element Is Visible    \${ID_USERNAME}    10s
        Input Text    \${ID_USERNAME}    \${username}

    Verify Error Message Is Displayed
        [Arguments]    \${expected_message}
        Wait Until Element Is Visible    \${CSS_ERROR_MSG}    10s
        Element Text Should Be    \${CSS_ERROR_MSG}    \${expected_message}

────────────────────────────────────────
SECTION 3: TEST FILE (tests.robot)
────────────────────────────────────────
*** Settings ***
Resource    keywords.robot
Variables    testdata.py
Suite Teardown    Close All Browsers

*** Test Cases ***
- Human-readable test case names derived from test description
- Add [Documentation] and [Tags] for each test case
- Test steps MUST ONLY call keywords — NO raw SeleniumLibrary commands in test cases
- Pass test data from testdata.py as keyword arguments: e.g., Input Username    \${VALID_USER}
- Include Suite Teardown to safely close browsers
- Example:
    Successful Login With Valid Credentials
        [Documentation]    Verify user can login with valid credentials
        [Tags]    smoke    login
        Open Browser To Login Page
        Input Username    \${VALID_USER}
        Input Password    \${VALID_PASS}
        Click Login Button
        Verify Products Page Is Displayed

STYLE RULES:
- 4-space indentation throughout
- Title Case for all keyword names
- Code must be executable without ANY modification
- No hardcoded locators or data anywhere except testdata.py
- Clean, readable, production-ready code

Generate ONLY the code with the markers. No explanations, no markdown fences.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI Generation limit reached. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to generate code. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content?.trim() || '';

    if (!generatedText) {
      console.error('No content received from AI');
      return new Response(
        JSON.stringify({ error: 'Failed to generate code. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generated text length:', generatedText.length);

    const extractSection = (text: string, startMarker: string, endMarker: string): string => {
      const startIdx = text.indexOf(startMarker);
      const endIdx = text.indexOf(endMarker);
      if (startIdx === -1 || endIdx === -1) return '';
      return text.substring(startIdx + startMarker.length, endIdx).trim();
    };

    const robotTest = extractSection(generatedText, '===ROBOT_TEST_START===', '===ROBOT_TEST_END===');
    const keywords = extractSection(generatedText, '===KEYWORDS_START===', '===KEYWORDS_END===');
    const dataFile = extractSection(generatedText, '===DATA_FILE_START===', '===DATA_FILE_END===');

    // Fallback if markers weren't found
    if (!robotTest && !keywords && !dataFile) {
      console.warn('Markers not found in AI output, returning raw text as testFile');
      return new Response(
        JSON.stringify({
          pageObject: '# Keywords could not be parsed separately\n# Please review the test file for all content',
          testFile: generatedText,
          dataFile: '# No data file was generated',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        pageObject: keywords || '# No keywords generated',
        testFile: robotTest || '# No test file generated',
        dataFile: dataFile || '# No data file generated',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating Robot Framework code:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate code. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
