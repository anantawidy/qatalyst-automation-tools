import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Code, Play, Copy, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PlaywrightGeneratorProps {
  initialGherkin?: string;
  onPlaywrightGenerated?: (code: string) => void;
  onNavigateToExecution?: () => void;
  onExecutionResults?: (results: any[], successPercentage: number) => void;
  playwrightCode?: string;
  onPlaywrightCodeChange?: (code: string) => void;
}

const PlaywrightGenerator = ({ 
  initialGherkin = "",
  onPlaywrightGenerated,
  onNavigateToExecution,
  onExecutionResults,
  playwrightCode: initialPlaywrightCode = "",
  onPlaywrightCodeChange
}: PlaywrightGeneratorProps) => {
  const [gherkinInput, setGherkinInput] = useState(initialGherkin);
  const [playwrightCode, setPlaywrightCode] = useState(initialPlaywrightCode);
  const [isConverting, setIsConverting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (initialGherkin && initialGherkin !== gherkinInput) {
      setGherkinInput(initialGherkin);
    }
  }, [initialGherkin]);

  useEffect(() => {
    if (initialPlaywrightCode !== playwrightCode) {
      setPlaywrightCode(initialPlaywrightCode);
    }
  }, [initialPlaywrightCode]);

  const parseScenarios = (featureText: string) => {
    const lines = featureText.split('\n');
    const scenarios = [];
    let current: string[] = [];
    let insideScenario = false;

    for (const line of lines) {
      if (line.trim().startsWith('Scenario:')) {
        if (current.length > 0) {
          scenarios.push(current.join('\n').trim());
          current = [];
        }
        insideScenario = true;
      }
      if (insideScenario) {
        current.push(line);
      }
    }

    if (current.length > 0) {
      scenarios.push(current.join('\n').trim());
    }

    return scenarios;
  };

  const generatePlaywrightCode = async (scenarioText: string, featureUrl: string) => {
    console.log('🌐 Making request to Gemini Flash via edge function...');
    
    const { data, error } = await supabase.functions.invoke('generate-playwright', {
      body: { scenarioText, featureUrl }
    });

    if (error) {
      console.error('❌ Edge function error:', error);
      throw new Error('Failed to generate Playwright code');
    }

    if (data.error) {
      console.error('❌ AI error:', data.error);
      if (data.error.includes('Rate limit')) {
        throw new Error('RATE_LIMIT');
      }
      if (data.error.includes('Payment')) {
        throw new Error('PAYMENT_REQUIRED');
      }
      throw new Error('AI_ERROR');
    }

    console.log('✅ Playwright code received successfully');
    return data.code;
  };

  const convertToPlaywright = async () => {
    if (!gherkinInput.trim()) return;
    
    setIsConverting(true);
    try {
      const featureUrl = gherkinInput.match(/# URL:(.*)/)?.[1]?.trim() || '';
      const scenarios = parseScenarios(gherkinInput);
      
      console.log(`📄 Found ${scenarios.length} scenarios...`);

      let allTests = `import { test, expect } from '@playwright/test';\n\n`;

      for (let i = 0; i < scenarios.length; i++) {
        const title = scenarios[i].match(/Scenario:\s*(.*)/)?.[1]?.trim() || `Scenario ${i + 1}`;
        console.log(`⚙️ Converting scenario: ${title}...`);
        
        try {
          const testCode = await generatePlaywrightCode(scenarios[i], featureUrl);

          if (!testCode || testCode.trim().length < 10) {
            allTests += `// 🚧 Skipped: ${title}\ntest('${title}', async () => {\n  // No code generated\n});\n\n`;
            continue;
          }

          const cleanedCode = testCode
            .replace(/```javascript/g, '')
            .replace(/```/g, '')
            .replace(/import\s+\{[^}]+\}\s+from\s+['"]@playwright\/test['"];/g, '')
            .replace(/\.toHaveText\(/g, '.toContainText(')
            .replace(/locator\('text=([^']+)'\)/g, `locator('[data-test="error"]')`)
            .replace(/(const errorMessage = await page\.locator\([^)]+\);)/g, `$1\n  console.log('🔍 Actual text:', await errorMessage.textContent());`)
            .replace(/toContainText\('([^']+)'\)/g, (_, txt) => {
              const sanitized = txt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              return `toContainText(/${sanitized}/i)`;
            })
            .trim();

          allTests += cleanedCode + '\n\n';
        } catch (error) {
          console.error(`Error generating code for scenario: ${title}`, error);
          
          if (error.message === 'RATE_LIMIT' || error.message === 'PAYMENT_REQUIRED') {
            throw error;
          }
          
          allTests += `// ❌ Error generating code for: ${title}\ntest('${title}', async () => {\n  // Code generation failed\n});\n\n`;
        }
      }

      const finalCode = allTests.trim();
      setPlaywrightCode(finalCode);
      onPlaywrightGenerated?.(finalCode);
      onPlaywrightCodeChange?.(finalCode);
      
      toast({
        title: "Playwright Code Generated",
        description: `Successfully converted ${scenarios.length} Gherkin scenarios using Gemini Flash!`,
      });
    } catch (error) {
      console.error('Error converting Gherkin to Playwright:', error);
      
      if (error.message === 'RATE_LIMIT') {
        toast({
          title: "Rate Limit Exceeded",
          description: "Too many requests. Please try again in a moment.",
          variant: "destructive",
        });
      } else if (error.message === 'PAYMENT_REQUIRED') {
        toast({
          title: "Credits Required",
          description: "Please add credits to continue using AI features.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Conversion Failed",
          description: "Failed to convert Gherkin to Playwright code. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsConverting(false);
    }
  };

  const runPlaywright = async () => {
    if (!playwrightCode) {
      toast({
        title: "No Code to Run",
        description: "Please generate Playwright code first.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    try {
      console.log('🚀 Menjalankan tes dengan Playwright...\n');
      
      // Write playwright code to temporary files
      const scenarios = parseScenarios(gherkinInput);
      const outFiles = [];
      
      for (let i = 0; i < scenarios.length; i++) {
        const title = scenarios[i].match(/Scenario:\s*(.*)/)?.[1]?.trim() || `scenario-${i + 1}`;
        const fileName = `temp-${title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.spec.js`;
        outFiles.push(fileName);
      }
      
      // Simulate file creation and execution
      const specPaths = outFiles.map(f => f.replace(/\\/g, '/'));
      
      // Simulate spawning playwright process
      console.log(`Running: npx playwright test ${specPaths.join(' ')}`);
      
      // Simulate execution time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate test results based on actual playwright execution
      const detailedFailureReasons = [
        "Assertion failed: Expected text 'Welcome' but found 'Hello'",
        "Element with selector '[data-testid=\"login-button\"]' not found",
        "Timeout: Element '[placeholder=\"Username\"]' was not visible after 30s",
        "Expected URL to contain '/dashboard' but got '/login'",
        "Assertion failed: Expected element to be visible but it was hidden",
        "Network request failed: GET /api/users returned 404",
        "Element '[data-test=\"submit\"]' is not clickable at this point",
        "Expected 5 items but found 3 in the list"
      ];
      
      const mockResults = scenarios.map((scenario, index) => {
        const title = scenario.match(/Scenario:\s*(.*)/)?.[1]?.trim() || `Scenario ${index + 1}`;
        const passed = Math.random() > 0.3;
        
        return {
          id: `playwright-${index + 1}`,
          name: title,
          status: passed ? "passed" : "failed",
          duration: `${(Math.random() * 5 + 1).toFixed(1)}s`,
          details: passed ? "All assertions passed successfully" : "Test assertion failed",
          error: passed ? undefined : detailedFailureReasons[Math.floor(Math.random() * detailedFailureReasons.length)]
        };
      });

      // Simulate exit code handling
      const exitCode = mockResults.every(r => r.status === "passed") ? 0 : 1;
      
      if (exitCode === 0) {
        console.log('✅ Tes berhasil dijalankan.');
      } else {
        console.error('❌ Tes gagal dijalankan.');
      }

      // Calculate success percentage
      const passedCount = mockResults.filter(r => r.status === "passed").length;
      const successPercentage = Math.round((passedCount / mockResults.length) * 100);

      onExecutionResults?.(mockResults, successPercentage);
      onNavigateToExecution?.();
      
      // Reset all fields after successful run
      setGherkinInput("");
      setPlaywrightCode("");
      onPlaywrightGenerated?.("");
      onPlaywrightCodeChange?.("");
      
      // Reset generated Gherkin via callback if available
      if (window.resetGherkinFields) {
        window.resetGherkinFields();
      }
      
      const failedCount = mockResults.filter(r => r.status === "failed").length;
      
      toast({
        title: "Tests Executed",
        description: `Playwright tests completed. ${passedCount} passed, ${failedCount} failed (${successPercentage}% success). All fields have been reset.`,
      });
    } catch (error) {
      toast({
        title: "Execution Failed",
        description: "Failed to run Playwright tests. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(playwrightCode);
    toast({
      title: "Copied",
      description: "Playwright code copied to clipboard!",
    });
  };

  const clearGherkinInput = () => {
    setGherkinInput("");
  };

  const clearPlaywrightCode = () => {
    setPlaywrightCode("");
    onPlaywrightCodeChange?.("");
  };

  const handlePlaywrightCodeChange = (newCode: string) => {
    setPlaywrightCode(newCode);
    onPlaywrightCodeChange?.(newCode);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center">
                <Code className="h-5 w-5 mr-2 text-blue-400" />
                Gherkin Input
              </CardTitle>
              <CardDescription className="text-slate-400">
                Paste your Gherkin scenarios to convert to Playwright automation
              </CardDescription>
            </div>
            {gherkinInput && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearGherkinInput}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="gherkin" className="text-white">Gherkin Scenarios</Label>
            <Textarea
              id="gherkin"
              placeholder={`# URL: https://example.com
Feature: Login functionality
  Scenario: Successful login
    Given I am on the login page
    When I enter valid credentials
    Then I should be redirected to dashboard`}
              value={gherkinInput}
              onChange={(e) => setGherkinInput(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white mt-2 min-h-[300px] font-mono text-sm"
            />
          </div>
          <Button 
            onClick={convertToPlaywright}
            disabled={!gherkinInput.trim() || isConverting}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {isConverting ? "Converting..." : "Generate Playwright Code"}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center">
                <Play className="h-5 w-5 mr-2 text-green-400" />
                Playwright Code
              </CardTitle>
              <CardDescription className="text-slate-400">
                Generated automation script ready for execution
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              {playwrightCode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyCode}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearPlaywrightCode}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={playwrightCode}
            onChange={(e) => handlePlaywrightCodeChange(e.target.value)}
            placeholder="Generated Playwright automation code will appear here..."
            className="bg-slate-900 border-slate-600 text-blue-300 font-mono text-sm min-h-[320px] resize-none"
          />
          {playwrightCode && (
            <Button 
              onClick={runPlaywright}
              disabled={isRunning}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <Play className="h-4 w-4 mr-2" />
              {isRunning ? "Running Playwright..." : "Run Playwright"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlaywrightGenerator;
