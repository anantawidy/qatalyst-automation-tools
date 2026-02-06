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
You are a senior QA automation engineer expert in Selenium WebDriver.

Given this test data:

Test Cases:
${JSON.stringify(testCases, null, 2)}

Locators:
${JSON.stringify(locators, null, 2)}

Test Data:
${JSON.stringify(testData, null, 2)}

Generate Selenium WebDriver test code using Page Object Model (POM) pattern with Mocha. Output TWO separate files:

**REQUIREMENTS:**
1. Use Selenium WebDriver with Mocha test runner
2. Create a Page Object class with:
   - Constructor that accepts driver instance
   - All locators as class properties using By.css(), By.id(), By.xpath()
   - Reusable action methods (login, fillForm, clickButton, waitForElement, etc.)
   - Proper async/await handling
3. Create a Test file with:
   - Single WebDriver instance created in before() hook
   - Driver quit in after() hook
   - All test cases share the same driver instance
   - Use describe() and it() blocks
   - Import and instantiate Page Object
   - Call Page Object methods instead of direct interactions
4. Use proper explicit waits with until.elementLocated()
5. Include proper assertions with assert or chai

**OUTPUT FORMAT:**
Output exactly in this format with the separators:

===PAGE_OBJECT_START===
// Page Object file content here
===PAGE_OBJECT_END===

===TEST_FILE_START===
// Test file content here
===TEST_FILE_END===

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
      throw new Error("Failed to generate Selenium code from AI");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("No content received from AI");
    }

    // Parse the two files from the response
    const pageObjectMatch = content.match(/===PAGE_OBJECT_START===([\s\S]*?)===PAGE_OBJECT_END===/);
    const testFileMatch = content.match(/===TEST_FILE_START===([\s\S]*?)===TEST_FILE_END===/);

    const pageObject = pageObjectMatch?.[1]?.trim() || '';
    const testFile = testFileMatch?.[1]?.trim() || '';

    return new Response(
      JSON.stringify({ pageObject, testFile }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-selenium error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
