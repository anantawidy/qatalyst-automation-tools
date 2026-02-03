import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Download, Code, FileText, ArrowRight, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CodeOutputProps {
  type: "gherkin" | "playwright";
  csvData: string[][];
  gherkinInput: string;
  generatedCode: string;
  onCodeGenerated: (code: string) => void;
  onConvertToPlaywright: () => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
}

const CodeOutput = ({ 
  type, 
  csvData, 
  gherkinInput,
  generatedCode, 
  onCodeGenerated,
  onConvertToPlaywright,
  isGenerating,
  setIsGenerating
}: CodeOutputProps) => {
  const [code, setCode] = useState(generatedCode);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setCode(generatedCode);
  }, [generatedCode]);

  useEffect(() => {
    if (!generatedCode && csvData.length > 0) {
      if (type === "gherkin") {
        generateGherkinFromCsv();
      } else if (type === "playwright") {
        if (gherkinInput) {
          generatePlaywrightFromGherkin(gherkinInput);
        } else {
          generatePlaywrightFromCsv();
        }
      }
    }
  }, [type, csvData, gherkinInput]);

  const generateGherkinFromCsv = () => {
    if (csvData.length < 2) return;
    
    const headers = csvData[0];
    const dataRows = csvData.slice(1);
    
    const testCaseIndex = headers.findIndex(h => h.trim() === 'Test Case');
    const preconditionsIndex = headers.findIndex(h => h.trim() === 'Preconditions');
    const stepsIndex = headers.findIndex(h => h.trim() === 'Test Steps');
    const expectedIndex = headers.findIndex(h => h.trim() === 'Expected Result');
    
    let allScenarios = `Feature: Automated Test Scenarios\n  As a user\n  I want to validate various functionality\n  So that the system works as expected\n\n`;

    dataRows.forEach((row, index) => {
      if (row.some(cell => cell.trim())) {
        const testCase = row[testCaseIndex] || `Test Case ${index + 1}`;
        const preconditions = row[preconditionsIndex] || '';
        const testSteps = row[stepsIndex] || '';
        const expectedResult = row[expectedIndex] || '';
        
        allScenarios += `  Scenario: ${testCase}\n`;
        
        if (preconditions.trim()) {
          const preconditionLines = preconditions.split(/[,;\n]/).map(p => p.trim()).filter(p => p);
          preconditionLines.forEach(precondition => {
            if (precondition.toLowerCase().includes('url:')) {
              const url = precondition.replace(/url:\s*/i, '').trim();
              allScenarios += `    Given I navigate to "${url}"\n`;
            } else {
              allScenarios += `    Given ${precondition}\n`;
            }
          });
        } else {
          allScenarios += `    Given the system is ready\n`;
        }
        
        if (testSteps.trim()) {
          const stepLines = testSteps.split(/[,;\n]|(?=\d+\.)/).map(s => s.trim()).map(s => s.replace(/^\d+\.\s*/, '')).filter(s => s);
          stepLines.forEach((step, stepIndex) => {
            allScenarios += stepIndex === 0 ? `    When ${step}\n` : `    And ${step}\n`;
          });
        } else {
          allScenarios += `    When I execute the test action\n`;
        }
        
        if (expectedResult.trim()) {
          const resultLines = expectedResult.split(/[,;\n]|(?=\d+\.)/).map(r => r.trim()).map(r => r.replace(/^\d+\.\s*/, '')).filter(r => r);
          resultLines.forEach((result, resultIndex) => {
            allScenarios += resultIndex === 0 ? `    Then ${result}\n` : `    And ${result}\n`;
          });
        } else {
          allScenarios += `    Then the system should work correctly\n`;
        }
        
        allScenarios += '\n';
      }
    });

    const finalGherkin = allScenarios.trim();
    setCode(finalGherkin);
    onCodeGenerated(finalGherkin);
    
    toast({
      title: "Gherkin Generated",
      description: `${dataRows.length} test case berhasil dikonversi ke Gherkin.`,
    });
  };

  const generatePlaywrightFromCsv = async () => {
    // First generate Gherkin, then convert to Playwright
    if (csvData.length < 2) return;
    
    // Generate Gherkin first
    const headers = csvData[0];
    const dataRows = csvData.slice(1);
    
    const testCaseIndex = headers.findIndex(h => h.trim() === 'Test Case');
    const preconditionsIndex = headers.findIndex(h => h.trim() === 'Preconditions');
    const stepsIndex = headers.findIndex(h => h.trim() === 'Test Steps');
    const expectedIndex = headers.findIndex(h => h.trim() === 'Expected Result');
    
    let tempGherkin = `Feature: Automated Test Scenarios\n\n`;

    dataRows.forEach((row, index) => {
      if (row.some(cell => cell.trim())) {
        const testCase = row[testCaseIndex] || `Test Case ${index + 1}`;
        const preconditions = row[preconditionsIndex] || '';
        const testSteps = row[stepsIndex] || '';
        const expectedResult = row[expectedIndex] || '';
        
        tempGherkin += `  Scenario: ${testCase}\n`;
        
        if (preconditions.trim()) {
          tempGherkin += `    Given ${preconditions.split(/[,;]/)[0].trim()}\n`;
        }
        if (testSteps.trim()) {
          tempGherkin += `    When ${testSteps.split(/[,;]/)[0].trim()}\n`;
        }
        if (expectedResult.trim()) {
          tempGherkin += `    Then ${expectedResult.split(/[,;]/)[0].trim()}\n`;
        }
        tempGherkin += '\n';
      }
    });

    await generatePlaywrightFromGherkin(tempGherkin);
  };

  const generatePlaywrightFromGherkin = async (gherkin: string) => {
    setIsGenerating(true);
    
    try {
      const scenarios = parseScenarios(gherkin);
      const featureUrl = gherkin.match(/# URL:(.*)/)?.[1]?.trim() || '';
      
      let allTests = `import { test, expect } from '@playwright/test';\n\n`;

      for (let i = 0; i < scenarios.length; i++) {
        const title = scenarios[i].match(/Scenario:\s*(.*)/)?.[1]?.trim() || `Scenario ${i + 1}`;
        
        try {
          const { data, error } = await supabase.functions.invoke('generate-playwright', {
            body: { scenarioText: scenarios[i], featureUrl }
          });

          if (error || data.error) {
            allTests += `// ❌ Error generating: ${title}\ntest('${title}', async () => {\n  // Failed to generate\n});\n\n`;
            continue;
          }

          const cleanedCode = data.code
            .replace(/```javascript/g, '')
            .replace(/```/g, '')
            .replace(/import\s+\{[^}]+\}\s+from\s+['"]@playwright\/test['"];/g, '')
            .trim();

          allTests += cleanedCode + '\n\n';
        } catch (err) {
          allTests += `// ❌ Error: ${title}\ntest('${title}', async () => {\n  // Error occurred\n});\n\n`;
        }
      }

      const finalCode = allTests.trim();
      setCode(finalCode);
      onCodeGenerated(finalCode);
      
      toast({
        title: "Playwright Generated",
        description: `${scenarios.length} test berhasil di-generate menggunakan Gemini Flash.`,
      });
    } catch (error) {
      console.error('Error generating Playwright:', error);
      toast({
        title: "Gagal Generate",
        description: "Terjadi kesalahan saat generate Playwright code.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const parseScenarios = (featureText: string) => {
    const lines = featureText.split('\n');
    const scenarios: string[] = [];
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Disalin!",
      description: "Code berhasil disalin ke clipboard.",
    });
  };

  const downloadCode = () => {
    const extension = type === "gherkin" ? "feature" : "spec.js";
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-automation.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "File Diunduh",
      description: `test-automation.${extension} berhasil diunduh.`,
    });
  };

  if (isGenerating) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-12 w-12 text-blue-400 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Generating {type === "gherkin" ? "Gherkin" : "Playwright"}...
            </h3>
            <p className="text-slate-400 text-sm">
              AI sedang memproses test case Anda. Mohon tunggu sebentar.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center text-base">
              {type === "gherkin" ? (
                <FileText className="h-5 w-5 mr-2 text-purple-400" />
              ) : (
                <Code className="h-5 w-5 mr-2 text-green-400" />
              )}
              {type === "gherkin" ? "Gherkin Scenarios" : "Playwright Code"}
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              {type === "gherkin" 
                ? "Edit skenario jika perlu, lalu konversi ke Playwright" 
                : "Code siap untuk digunakan dalam automation testing"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCode}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            onCodeGenerated(e.target.value);
          }}
          className={`bg-slate-900 border-slate-600 font-mono text-sm min-h-[300px] resize-none ${
            type === "gherkin" ? "text-purple-300" : "text-green-300"
          }`}
          placeholder={`Generated ${type} code will appear here...`}
        />
        
        {type === "gherkin" && code && (
          <Button 
            onClick={onConvertToPlaywright}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            <Code className="h-4 w-4 mr-2" />
            Konversi ke Playwright
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default CodeOutput;
