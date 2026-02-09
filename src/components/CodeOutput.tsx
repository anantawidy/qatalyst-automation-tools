import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Download, Code, FileText, Loader2, Check, FileCode, Database, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TestCaseData } from "./CsvUploader";

type OutputType = "gherkin" | "playwright" | "selenium" | "cypress";

interface GeneratedCode {
  pageObject: string;
  testFile: string;
  dataFile: string;
}

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
  const [pomCode, setPomCode] = useState<GeneratedCode>({ pageObject: '', testFile: '', dataFile: '' });
  const [gherkinCode, setGherkinCode] = useState(generatedCode);
  const [activeTab, setActiveTab] = useState<"pageObject" | "testFile" | "dataFile">("pageObject");
  const [copiedPO, setCopiedPO] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);
  const [copiedData, setCopiedData] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (type === "gherkin") {
      setGherkinCode(generatedCode);
    }
  }, [generatedCode, type]);

  useEffect(() => {
    if (!generatedCode && testData.testCases.length > 0) {
      generateCode();
    }
  }, [type, testData]);

  const generateCode = async () => {
    if (testData.testCases.length === 0) return;
    
    setIsGenerating(true);
    setErrorMessage(null);
    
    try {
      if (type === "gherkin") {
        generateGherkin();
      } else {
        await generateAutomationCode();
      }
    } catch (error: any) {
      console.error('Error generating code:', error);
      const errorMsg = error?.message?.toLowerCase() || '';
      
      if (errorMsg.includes('rate limit') || errorMsg.includes('quota') || errorMsg.includes('429') || errorMsg.includes('limit')) {
        setErrorMessage("AI Generation limit reached. Please try again later or use another model.");
      } else {
        setErrorMessage("An error occurred while generating code. Please try again.");
      }
      
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
      gherkin += `  Scenario: ${tc.id} - ${tc.steps?.split(' ').slice(0, 5).join(' ') || 'Test scenario'}
    Given the system is ready
    When ${tc.steps || 'I execute the test action'}
    Then ${tc.expected || 'the expected result should occur'}

`;
    });

    const finalCode = gherkin.trim();
    setGherkinCode(finalCode);
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

      if (error) {
        throw new Error(error.message || 'Unknown error');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const cleanCode = (code: string) => code
        .replace(/```javascript/g, '')
        .replace(/```typescript/g, '')
        .replace(/```json/g, '')
        .replace(/```js/g, '')
        .replace(/```/g, '')
        .trim();

      const pageObject = cleanCode(data.pageObject || '');
      const testFile = cleanCode(data.testFile || '');
      const dataFile = cleanCode(data.dataFile || '');

      setPomCode({ pageObject, testFile, dataFile });
      onCodeGenerated(JSON.stringify({ pageObject, testFile, dataFile }));
      
      toast({
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Generated`,
        description: `Page Object, Test file, and Data file generated successfully.`,
      });
    } catch (err: any) {
      console.error(`Error generating ${type}:`, err);
      throw err;
    }
  };

  const copyToClipboard = (code: string, which: "po" | "test" | "data" | "gherkin") => {
    navigator.clipboard.writeText(code);
    if (which === "po") {
      setCopiedPO(true);
      setTimeout(() => setCopiedPO(false), 2000);
    } else if (which === "test") {
      setCopiedTest(true);
      setTimeout(() => setCopiedTest(false), 2000);
    } else if (which === "data") {
      setCopiedData(true);
      setTimeout(() => setCopiedData(false), 2000);
    }
    toast({
      title: "Copied!",
      description: "Code copied to clipboard.",
    });
  };

  const downloadCode = (code: string, filename: string) => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "File Downloaded",
      description: `${filename} downloaded.`,
    });
  };

  const getFileNames = () => {
    switch (type) {
      case "playwright":
        return { pageObject: "LoginPage.ts", testFile: "login.spec.ts", dataFile: "testData.json" };
      case "selenium":
        return { pageObject: "LoginPage.js", testFile: "login.test.js", dataFile: "testData.json" };
      case "cypress":
        return { pageObject: "commands.js", testFile: "login.cy.js", dataFile: "testData.json" };
      default:
        return { pageObject: "page.js", testFile: "test.js", dataFile: "testData.json" };
    }
  };

  const getTypeInfo = () => {
    switch (type) {
      case "gherkin":
        return { icon: <FileText className="h-5 w-5 text-purple-400" />, title: "Gherkin Scenarios", color: "text-purple-300" };
      case "playwright":
        return { icon: <Code className="h-5 w-5 text-green-400" />, title: "Playwright (POM)", color: "text-green-300" };
      case "selenium":
        return { icon: <Code className="h-5 w-5 text-orange-400" />, title: "Selenium (POM + Mocha)", color: "text-orange-300" };
      case "cypress":
        return { icon: <Code className="h-5 w-5 text-cyan-400" />, title: "Cypress (Mocha + Commands)", color: "text-cyan-300" };
    }
  };

  const typeInfo = getTypeInfo();
  const fileNames = getFileNames();

  // Error state
  if (errorMessage) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <AlertTitle className="text-red-300 font-semibold">Generation Failed</AlertTitle>
            <AlertDescription className="text-red-200 mt-2">
              {errorMessage}
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-center">
            <Button 
              onClick={() => {
                setErrorMessage(null);
                generateCode();
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

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

  // Gherkin output (single file)
  if (type === "gherkin") {
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
                BDD scenarios ready for use
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(gherkinCode, "gherkin")}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCode(gherkinCode, "test.feature")}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={gherkinCode}
            onChange={(e) => {
              setGherkinCode(e.target.value);
              onCodeGenerated(e.target.value);
            }}
            className={`bg-slate-900 border-slate-600 font-mono text-sm min-h-[300px] resize-none ${typeInfo.color}`}
            placeholder="Generated Gherkin code will appear here..."
          />
        </CardContent>
      </Card>
    );
  }

  // POM output (three files)
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
              Page Object Model with separate test and data files
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3 bg-slate-700 mb-4">
            <TabsTrigger value="pageObject" className="data-[state=active]:bg-blue-600">
              <FileCode className="h-4 w-4 mr-2" />
              {type === "cypress" ? "Commands" : "Page Object"}
            </TabsTrigger>
            <TabsTrigger value="testFile" className="data-[state=active]:bg-blue-600">
              <Code className="h-4 w-4 mr-2" />
              Test File
            </TabsTrigger>
            <TabsTrigger value="dataFile" className="data-[state=active]:bg-blue-600">
              <Database className="h-4 w-4 mr-2" />
              Data File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pageObject" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-mono">{fileNames.pageObject}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(pomCode.pageObject, "po")}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {copiedPO ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCode(pomCode.pageObject, fileNames.pageObject)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Textarea
              value={pomCode.pageObject}
              onChange={(e) => setPomCode(prev => ({ ...prev, pageObject: e.target.value }))}
              className={`bg-slate-900 border-slate-600 font-mono text-sm min-h-[300px] resize-none ${typeInfo.color}`}
              placeholder={`${type === "cypress" ? "Custom commands" : "Page Object"} code will appear here...`}
            />
          </TabsContent>

          <TabsContent value="testFile" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-mono">{fileNames.testFile}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(pomCode.testFile, "test")}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {copiedTest ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCode(pomCode.testFile, fileNames.testFile)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Textarea
              value={pomCode.testFile}
              onChange={(e) => setPomCode(prev => ({ ...prev, testFile: e.target.value }))}
              className={`bg-slate-900 border-slate-600 font-mono text-sm min-h-[300px] resize-none ${typeInfo.color}`}
              placeholder="Test file code will appear here..."
            />
          </TabsContent>

          <TabsContent value="dataFile" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-mono">/data/{fileNames.dataFile}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(pomCode.dataFile, "data")}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {copiedData ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCode(pomCode.dataFile, fileNames.dataFile)}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Textarea
              value={pomCode.dataFile}
              onChange={(e) => setPomCode(prev => ({ ...prev, dataFile: e.target.value }))}
              className={`bg-slate-900 border-slate-600 font-mono text-sm min-h-[300px] resize-none text-yellow-300`}
              placeholder="JSON data file will appear here..."
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CodeOutput;
