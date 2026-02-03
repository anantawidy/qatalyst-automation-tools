import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Play, Settings, FileText, Download, GitBranch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AuthenticationCard from "@/components/AuthenticationCard";
import GherkinGenerator from "@/components/GherkinGenerator";
import PlaywrightGenerator from "@/components/PlaywrightGenerator";
import TestCaseManager from "@/components/TestCaseManager";
import ExecutionEngine from "@/components/ExecutionEngine";
import ExportManager from "@/components/ExportManager";
import Homepage from "@/components/Homepage";
import Footer from "@/components/Footer";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Auto-authenticated with Gemini
  const [showHomepage, setShowHomepage] = useState(true);
  const [activeTab, setActiveTab] = useState("generator");
  const [generatedGherkin, setGeneratedGherkin] = useState("");
  const [playwrightCode, setPlaywrightCode] = useState("");
  const [testCases, setTestCases] = useState<any[]>([]);
  const [executionResults, setExecutionResults] = useState<any[]>([]);
  const [successPercentage, setSuccessPercentage] = useState(0);
  const [isHeadlessMode, setIsHeadlessMode] = useState(true);
  const [runningTestCases, setRunningTestCases] = useState<string[]>([]);
  const { toast } = useToast();

  const handleGetStarted = () => {
    setShowHomepage(false);
  };

  const extractScenariosFromGherkin = (gherkin: string) => {
    const lines = gherkin.split('\n');
    const scenarios = [];
    let currentScenario = null;
    let scenarioContent = [];
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Scenario:')) {
        if (currentScenario) {
          scenarios.push({
            title: currentScenario,
            content: scenarioContent.join('\n')
          });
        }
        currentScenario = trimmedLine.replace('Scenario:', '').trim();
        scenarioContent = [line];
      } else if (currentScenario) {
        scenarioContent.push(line);
      }
    });
    
    if (currentScenario) {
      scenarios.push({
        title: currentScenario,
        content: scenarioContent.join('\n')
      });
    }
    
    return scenarios;
  };

  const handleGherkinGenerated = (gherkin: string, title: string) => {
    setGeneratedGherkin(gherkin);
    
    // Extract individual scenarios from Gherkin
    const scenarios = extractScenariosFromGherkin(gherkin);
    
    // Create test cases for each scenario with updated status type
    const newTestCases = scenarios.map(scenario => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: scenario.title,
      status: "active" as const,
      type: "gherkin" as const,
      lastModified: new Date().toISOString().split('T')[0],
      description: `Auto-generated from ${title}`,
      content: scenario.content
    }));
    
    // Add new test cases to existing ones (don't replace)
    setTestCases(prev => [...prev, ...newTestCases]);
    
    toast({
      title: "Test Cases Created",
      description: `Generated ${scenarios.length} test case(s) from Gherkin scenarios.`,
    });
  };

  const handlePlaywrightGenerated = (code: string) => {
    setPlaywrightCode(code);
  };

  const handleResetGherkinFields = () => {
    setGeneratedGherkin("");
  };

  // Make reset function available globally for PlaywrightGenerator
  useEffect(() => {
    window.resetGherkinFields = handleResetGherkinFields;
    return () => {
      delete window.resetGherkinFields;
    };
  }, []);

  const handleExecutionResults = (results: any[], percentage: number) => {
    setExecutionResults(results);
    setSuccessPercentage(percentage);
    // Auto-navigate to Execute tab
    setActiveTab("execution");
  };

  const handleExecutionResultsUpdate = (results: any[], percentage: number) => {
    setExecutionResults(results);
    setSuccessPercentage(percentage);
  };

  const handleRunSelectedTests = async (selectedTestIds: string[]) => {
    const selectedTests = testCases.filter(tc => selectedTestIds.includes(tc.id) && tc.status === "active");
    
    if (selectedTests.length === 0) {
      toast({
        title: "No Active Tests Selected",
        description: "Please select active test cases to run.",
        variant: "destructive",
      });
      return;
    }

    // Check if we have valid Playwright code for execution
    if (!playwrightCode || playwrightCode.trim() === "") {
      toast({
        title: "No Playwright Code",
        description: "Please generate Playwright code first before running tests.",
        variant: "destructive",
      });
      return;
    }

    // Create test results for selected tests
    const testResults = selectedTests.map(testCase => ({
      id: testCase.id,
      name: testCase.name,
      status: "running" as const,
      duration: "0s",
      details: "Test is running...",
      type: testCase.type
    }));

    setExecutionResults(testResults);
    setRunningTestCases(selectedTestIds);
    
    // Auto-navigate to Execute tab
    setActiveTab("execution");
    
    toast({
      title: "Tests Running",
      description: `${selectedTests.length} test case(s) are now executing automatically.`,
    });

    // Simulate automatic execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    
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

    // Execute all tests in parallel instead of sequentially
    const finalResults = await Promise.all(
      selectedTests.map(async (testCase, index) => {
        // Simulate execution time
        await new Promise(resolve => setTimeout(resolve, 2000 + index * 100));
        
        const passed = Math.random() > 0.3;
        const errorMessage = passed ? undefined : detailedFailureReasons[Math.floor(Math.random() * detailedFailureReasons.length)];
        
        return {
          id: testCase.id,
          name: testCase.name,
          status: passed ? "passed" as const : "failed" as const,
          duration: `${(Math.random() * 5 + 1).toFixed(1)}s`,
          details: passed ? "Test passed successfully" : "Test failed - assertion error",
          error: errorMessage,
          type: testCase.type
        };
      })
    );
    
    // Update results all at once
    setExecutionResults(finalResults);
    
    // Calculate final success percentage
    const passedCount = finalResults.filter(r => r.status === "passed").length;
    const newSuccessPercentage = Math.round((passedCount / finalResults.length) * 100);
    setSuccessPercentage(newSuccessPercentage);
    
    setRunningTestCases([]);
    
    toast({
      title: "Execution Complete",
      description: `${finalResults.length} test case(s) executed. Success rate: ${newSuccessPercentage}%`,
    });
  };

  const handleNavigateToGenerator = () => {
    setActiveTab("generator");
  };

  if (showHomepage) {
    return (
      <>
        <Homepage onGetStarted={handleGetStarted} />
        <Footer />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setShowHomepage(true)}>
              <div className="h-16 w-16 rounded-lg overflow-hidden">
                <img
                  src="/lovable-uploads/269d3e8a-a51d-4e23-9146-715eea456ae5.png" 
                  alt="QAtalyst Logo" 
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                QAtalyst
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 text-sm text-green-400">
                <div className="h-2 w-2 rounded-full bg-green-400"></div>
                <span>Gemini Flash Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-slate-800 border-slate-700">
            <TabsTrigger value="generator" className="data-[state=active]:bg-blue-600">
              <FileText className="h-4 w-4 mr-2" />
              Generator
            </TabsTrigger>
            <TabsTrigger value="playwright" className="data-[state=active]:bg-blue-600">
              <Play className="h-4 w-4 mr-2" />
              Playwright
            </TabsTrigger>
            <TabsTrigger value="management" className="data-[state=active]:bg-blue-600">
              <Settings className="h-4 w-4 mr-2" />
              Test Cases
            </TabsTrigger>
            <TabsTrigger value="execution" className="data-[state=active]:bg-blue-600">
              <Play className="h-4 w-4 mr-2" />
              Execute
            </TabsTrigger>
            <TabsTrigger value="export" className="data-[state=active]:bg-blue-600">
              <GitBranch className="h-4 w-4 mr-2" />
              Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generator">
            <GherkinGenerator 
              onGherkinGenerated={handleGherkinGenerated}
              onNavigateToPlaywright={() => setActiveTab("playwright")}
              generatedGherkin={generatedGherkin}
              onGherkinChange={setGeneratedGherkin}
            />
          </TabsContent>

          <TabsContent value="playwright">
            <PlaywrightGenerator 
              initialGherkin={generatedGherkin}
              onPlaywrightGenerated={handlePlaywrightGenerated}
              onNavigateToExecution={() => setActiveTab("execution")}
              onExecutionResults={handleExecutionResults}
              playwrightCode={playwrightCode}
              onPlaywrightCodeChange={setPlaywrightCode}
            />
          </TabsContent>

          <TabsContent value="management">
            <TestCaseManager 
              testCases={testCases} 
              onTestCasesChange={setTestCases}
              onNavigateToGenerator={handleNavigateToGenerator}
              onRunSelectedTests={handleRunSelectedTests}
            />
          </TabsContent>

          <TabsContent value="execution">
            <ExecutionEngine 
              executionResults={executionResults}
              successPercentage={successPercentage}
              isHeadlessMode={isHeadlessMode}
              onHeadlessModeChange={setIsHeadlessMode}
              onExecutionResults={handleExecutionResultsUpdate}
              testCases={testCases}
              runningTestCases={runningTestCases}
            />
          </TabsContent>

          <TabsContent value="export">
            <ExportManager 
              gherkinContent={generatedGherkin}
              playwrightCode={playwrightCode}
              testCases={testCases}
              executionResults={executionResults}
              successPercentage={successPercentage}
            />
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default Index;
