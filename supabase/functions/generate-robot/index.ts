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

    const prompt = `You are an expert Robot Framework automation engineer. Generate enterprise-grade Robot Framework automation code based on the following test cases, locators, and test data.

TEST CASES:
${JSON.stringify(testCases, null, 2)}

LOCATORS:
${JSON.stringify(locators, null, 2)}

TEST DATA:
${JSON.stringify(testData, null, 2)}

REQUIREMENTS:
1. Generate THREE separate sections with these EXACT markers:
   ===ROBOT_TEST_START===
   (robot test file content)
   ===ROBOT_TEST_END===
   
   ===KEYWORDS_START===
   (keywords file content)
   ===KEYWORDS_END===
   
   ===DATA_FILE_START===
   (data file content)
   ===DATA_FILE_END===

2. DATA FILE (testdata.py):
   - Python variables file for Robot Framework
   - Flat structure, not nested
   - ALL locators must be stored here as variables (e.g., ID_USERNAME = "id:user-name", CSS_TITLE = "css=.title", XPATH_CART = "xpath://div[@class='cart']")
   - ALL test data must be stored here (credentials, URLs, error messages, expected texts)
   - Use ONLY valid locator formats: id:xxx, css=xxx, xpath:xxx, name:xxx
   - Do NOT use invalid formats like "class:xxx"
   - Example:
     URL = "https://example.com"
     ID_USERNAME = "id:user-name"
     ID_PASSWORD = "id:password"
     CSS_LOGIN_BTN = "css=.btn-login"
     VALID_USER = "standard_user"
     VALID_PASS = "secret_sauce"
     ERR_MSG_INVALID = "Epic sadface: Username and password do not match"

3. ROBOT KEYWORDS FILE (keywords.robot):
   - Include *** Settings *** with Library SeleniumLibrary and Variables testdata.py
   - Include *** Keywords ***
   - Create reusable keywords for ALL UI interactions
   - Keywords must accept arguments for dynamic test data
   - EVERY UI interaction must use "Wait Until Element Is Visible" with timeout=10s BEFORE interacting
   - Use clear, descriptive Title Case keyword names (e.g., "Input Username", "Click Login Button")
   - Do NOT hardcode ANY locators or test data inside keywords — reference variables from testdata.py (e.g., \${ID_USERNAME})
   - Assertions must be implemented inside reusable keywords (e.g., "Verify Page Title", "Verify Error Message")
   - Do NOT use raw SeleniumLibrary commands in test cases
   - Example keyword:
     Input Username
         [Arguments]    \${username}
         Wait Until Element Is Visible    \${ID_USERNAME}    timeout=10s
         Input Text    \${ID_USERNAME}    \${username}

4. ROBOT TEST FILE (tests.robot):
   - Include *** Settings *** with Resource keywords.robot and Variables testdata.py
   - Include *** Test Cases ***
   - Human-readable test case names based on test description
   - Test steps must ONLY call reusable keywords from the keywords file
   - Do NOT include direct SeleniumLibrary calls in test cases
   - Add [Documentation] and [Tags] for each test case
   - Pass test data from testdata.py variables as arguments to keywords

5. STYLE:
   - 4-space indentation
   - Title Case keyword names
   - Executable without modification
   - No hardcoded locators or data in keywords or test cases

Generate ONLY the code with the markers. No explanations.`;

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
