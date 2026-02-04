import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Download, Code, FileText, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TestCaseData } from "./CsvUploader";

type OutputType = "gherkin" | "playwright" | "selenium" | "cypress";

interface CodeOutputProps {
  type: OutputType;
  testData: TestCaseData;
  generatedCode: string;
  onCodeGenerated: (code: string) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
}

const CodeOutput = ({ 
  type, 
  testData,
  generatedCode, 
  onCodeGenerated,
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
    if (!generatedCode && testData.testCases.length > 0) {
      generateCode();
    }
  }, [type, testData]);

  const generateCode = async () => {
    if (testData.testCases.length === 0) return;
    
    setIsGenerating(true);
    
    try {
      if (type === "gherkin") {
        generateGherkin();
      } else {
        await generateAutomationCode();
      }
    } catch (error) {
      console.error('Error generating code:', error);
      toast({
        title: "Generation Failed",
        description: "An error occurred while generating code.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateGherkin = () => {
    let gherkin = `Feature: Automated Test Scenarios
  As a tester
  I want to validate the system functionality
  So that the application works correctly

`;

    testData.testCases.forEach((tc) => {
      gherkin += `  Scenario: ${tc.description || tc.id}
    Given the system is ready
    When ${tc.step || 'I execute the test action'}
    Then ${tc.expected || 'the expected result should occur'}

`;
    });

    const finalCode = gherkin.trim();
    setCode(finalCode);
    onCodeGenerated(finalCode);
    
    toast({
      title: "Gherkin Generated",
      description: `${testData.testCases.length} test cases converted to Gherkin.`,
    });
  };

  const generateAutomationCode = async () => {
    const functionName = type === "playwright" ? "generate-playwright" : 
                         type === "selenium" ? "generate-selenium" : "generate-cypress";
    
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          testCases: testData.testCases,
          locators: testData.locators,
          testData: testData.testData
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Unknown error');
      }

      const cleanedCode = data.code
        .replace(/```javascript/g, '')
        .replace(/```typescript/g, '')
        .replace(/```/g, '')
        .trim();

      setCode(cleanedCode);
      onCodeGenerated(cleanedCode);
      
      toast({
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Generated`,
        description: `Code generated successfully using Gemini Flash.`,
      });
    } catch (err) {
      console.error(`Error generating ${type}:`, err);
      throw err;
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard.",
    });
  };

  const downloadCode = () => {
    const extensions: Record<OutputType, string> = {
      gherkin: "feature",
      playwright: "spec.js",
      selenium: "test.js",
      cypress: "cy.js"
    };
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-automation.${extensions[type]}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "File Downloaded",
      description: `test-automation.${extensions[type]} downloaded.`,
    });
  };

  const getTypeInfo = () => {
    switch (type) {
      case "gherkin":
        return { icon: <FileText className="h-5 w-5 text-purple-400" />, title: "Gherkin Scenarios", color: "text-purple-300" };
      case "playwright":
        return { icon: <Code className="h-5 w-5 text-green-400" />, title: "Playwright Code", color: "text-green-300" };
      case "selenium":
        return { icon: <Code className="h-5 w-5 text-orange-400" />, title: "Selenium Code", color: "text-orange-300" };
      case "cypress":
        return { icon: <Code className="h-5 w-5 text-cyan-400" />, title: "Cypress Code", color: "text-cyan-300" };
    }
  };

  const typeInfo = getTypeInfo();

  if (isGenerating) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-12 w-12 text-blue-400 animate-spin mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Generating {typeInfo.title}...
            </h3>
            <p className="text-slate-400 text-sm">
              AI is processing your test cases. Please wait.
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
              {typeInfo.icon}
              <span className="ml-2">{typeInfo.title}</span>
            </CardTitle>
            <CardDescription className="text-slate-400 text-sm">
              Ready for use in your automation testing
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
          className={`bg-slate-900 border-slate-600 font-mono text-sm min-h-[300px] resize-none ${typeInfo.color}`}
          placeholder={`Generated ${type} code will appear here...`}
        />
      </CardContent>
    </Card>
  );
};

export default CodeOutput;
