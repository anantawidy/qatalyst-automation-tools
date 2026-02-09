import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestCase {
  id: string;
  description?: string;
  steps: string;
  expected: string;
}

interface RequestBody {
  testCases: TestCase[];
  locators: Record<string, string>;
  testData: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { testCases, locators, testData }: RequestBody = await req.json();
    
    console.log('Generating Robot Framework code for', testCases.length, 'test cases');
    console.log('Locators:', JSON.stringify(locators));
    console.log('Test Data:', JSON.stringify(testData));

    const prompt = `You are an expert Robot Framework automation engineer. Generate Robot Framework automation code based on the following test cases, locators, and test data.

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
   (data file content as Robot Framework variables)
   ===DATA_FILE_END===

2. ROBOT TEST FILE (tests.robot):
   - Include *** Settings *** section with Library SeleniumLibrary and Resource keywords.robot and Variables testdata.py
   - Include *** Test Cases *** section
   - Each test case must have a clear, human-readable name based on the test description
   - Test steps must ONLY call reusable keywords from the keywords file
   - Do NOT include direct SeleniumLibrary calls in test cases
   - Add [Documentation] for each test case
   - Add [Tags] for categorization

3. KEYWORDS FILE (keywords.robot):
   - Include *** Keywords *** section
   - Create reusable keywords for ALL UI interactions
   - Keywords must accept arguments for dynamic test data
   - Use clear, descriptive keyword names (e.g., "Input Username", "Click Login Button", "Verify Error Message")
   - Do NOT hardcode any test data or locators inside keywords
   - Include proper documentation for each keyword
   - Use SeleniumLibrary keywords properly (Input Text, Click Button, Wait Until Element Is Visible, etc.)

4. DATA FILE (testdata.py):
   - Create a Python variables file for Robot Framework
   - Store all test data as Python variables
   - Use a flat structure, not nested
   - Include variables for: valid credentials, invalid credentials, error messages, URLs
   - Example structure:
     USERNAME = ""
     PASSWORD = ""
     INVALID_USERNAME = ""
     INVALID_PASSWORD = ""
     ERROR_MESSAGE = ""
     BASE_URL = ""

5. STYLE REQUIREMENTS:
   - Use 4-space indentation for Robot Framework
   - Use clear, readable keyword names in Title Case
   - Follow Robot Framework best practices
   - Make the code executable without modification

Generate ONLY the code with the markers. No explanations.`;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      
      if (response.status === 429 || errorText.includes('quota') || errorText.includes('rate')) {
        return new Response(
          JSON.stringify({ error: 'AI Generation limit reached. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('Generated text length:', generatedText.length);

    // Parse the generated code
    const extractSection = (text: string, startMarker: string, endMarker: string): string => {
      const startIdx = text.indexOf(startMarker);
      const endIdx = text.indexOf(endMarker);
      if (startIdx === -1 || endIdx === -1) return '';
      return text.substring(startIdx + startMarker.length, endIdx).trim();
    };

    const robotTest = extractSection(generatedText, '===ROBOT_TEST_START===', '===ROBOT_TEST_END===');
    const keywords = extractSection(generatedText, '===KEYWORDS_START===', '===KEYWORDS_END===');
    const dataFile = extractSection(generatedText, '===DATA_FILE_START===', '===DATA_FILE_END===');

    console.log('Parsed sections - Robot Test:', robotTest.length, 'Keywords:', keywords.length, 'Data:', dataFile.length);

    return new Response(
      JSON.stringify({
        pageObject: keywords, // Keywords file (reusable keywords)
        testFile: robotTest,  // Test file
        dataFile: dataFile,   // Data variables file
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating Robot Framework code:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate Robot Framework code' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
