import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Code, Sparkles, Play, TestTube, Bot, Layers, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";
import CsvUploader, { TestCaseData } from "@/components/CsvUploader";
import CodeOutput from "@/components/CodeOutput";
import BddCodeOutput from "@/components/BddCodeOutput";
import WorkflowSteps from "@/components/WorkflowSteps";

type OutputType = "gherkin" | "playwright" | "selenium" | "cypress" | "robot" | null;
type FrameworkType = "playwright" | "selenium" | "cypress" | "robot";
type AutomationMode = "classic" | "bdd" | null;

const Index = () => {
  const [testData, setTestData] = useState<TestCaseData | null>(null);
  const [outputType, setOutputType] = useState<OutputType>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [gherkinResult, setGherkinResult] = useState("");
  // Post-Gherkin state
  const [automationMode, setAutomationMode] = useState<AutomationMode>(null);
  const [frameworkAfterGherkin, setFrameworkAfterGherkin] = useState<FrameworkType | null>(null);
  const [frameworkCode, setFrameworkCode] = useState("");
  const [isGeneratingFramework, setIsGeneratingFramework] = useState(false);
  const { toast } = useToast();

  const handleReset = () => {
    setTestData(null);
    setOutputType(null);
    setGeneratedCode("");
    setGherkinResult("");
    setAutomationMode(null);
    setFrameworkAfterGherkin(null);
    setFrameworkCode("");
  };

  const handleSelectOutput = (type: OutputType) => {
    setGeneratedCode("");
    setGherkinResult("");
    setAutomationMode(null);
    setFrameworkAfterGherkin(null);
    setFrameworkCode("");
    setOutputType(type);
  };

  const handleSelectFrameworkAfterGherkin = (type: FrameworkType) => {
    setFrameworkCode("");
    setFrameworkAfterGherkin(type);
  };

  const getCurrentStep = () => {
    if (!testData || testData.testCases.length === 0) return 1;
    if (!outputType) return 1;
    return 2;
  };

  const hasTestCases = testData && testData.testCases.length > 0;
  const gherkinGenerated = outputType === "gherkin" && gherkinResult.length > 0 && !isGenerating;

  const frameworkButtons = (onClick: (fw: FrameworkType) => void) => (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => onClick("playwright")} className="bg-green-600 hover:bg-green-700 text-white" size="lg">
        <Code className="h-5 w-5 mr-2" /> Playwright
      </Button>
      <Button onClick={() => onClick("selenium")} className="bg-orange-600 hover:bg-orange-700 text-white" size="lg">
        <TestTube className="h-5 w-5 mr-2" /> Selenium
      </Button>
      <Button onClick={() => onClick("cypress")} className="bg-cyan-600 hover:bg-cyan-700 text-white" size="lg">
        <Play className="h-5 w-5 mr-2" /> Cypress
      </Button>
      <Button onClick={() => onClick("robot")} className="bg-rose-600 hover:bg-rose-700 text-white" size="lg">
        <Bot className="h-5 w-5 mr-2" /> Robot Framework
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-14 w-14 rounded-lg overflow-hidden">
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
            <div className="flex items-center space-x-2 text-base text-emerald-400">
              <Sparkles className="h-5 w-5" />
              <span className="font-medium">Powered by Gemini Flash</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <WorkflowSteps currentStep={getCurrentStep()} />

        {/* Step 1: Upload */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">1</div>
            <h2 className="text-lg font-semibold text-white">Upload Test Case (CSV)</h2>
          </div>
          <CsvUploader onDataLoaded={setTestData} testData={testData} onReset={handleReset} />
        </div>

        {/* Step 2: Select Output Type */}
        {hasTestCases && !outputType && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">2</div>
              <h2 className="text-lg font-semibold text-white">Select Output Type</h2>
            </div>
            
            {/* Documentation */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Documentation / BDD</h3>
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => handleSelectOutput("gherkin")}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  size="lg"
                >
                  <FileText className="h-5 w-5 mr-2" />
                  Generate Gherkin
                </Button>
              </div>
            </div>

            {/* Direct Automation Framework */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Automation Framework (Classic)</h3>
              {frameworkButtons((fw) => handleSelectOutput(fw))}
            </div>
          </div>
        )}

        {/* Generated Output (Gherkin or Classic Framework) */}
        {outputType && testData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">2</div>
                <h2 className="text-lg font-semibold text-white">Generated Output</h2>
              </div>
              <Button 
                variant="outline" size="sm"
                onClick={() => setOutputType(null)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Back to Selection
              </Button>
            </div>

            <CodeOutput
              type={outputType}
              testData={testData}
              generatedCode={generatedCode}
              onCodeGenerated={(code) => {
                setGeneratedCode(code);
                if (outputType === "gherkin") setGherkinResult(code);
              }}
              isGenerating={isGenerating}
              setIsGenerating={setIsGenerating}
            />
          </div>
        )}

        {/* Step 3: After Gherkin → Choose Mode */}
        {gherkinGenerated && !automationMode && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">3</div>
              <h2 className="text-lg font-semibold text-white">Select Automation Mode</h2>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Choose how to generate automation code from your Gherkin scenarios.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setAutomationMode("classic")}
                className="p-5 rounded-lg border-2 border-slate-600 bg-slate-800/50 hover:border-blue-500 hover:bg-slate-800 transition-all text-left group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="h-6 w-6 text-blue-400" />
                  <h3 className="text-white font-semibold text-base">Classic Automation</h3>
                </div>
                <p className="text-slate-400 text-sm">
                  Generate Page Object Model (POM) with test file and data file. Direct test scripts integrated with Gherkin.
                </p>
              </button>
              <button
                onClick={() => setAutomationMode("bdd")}
                className="p-5 rounded-lg border-2 border-slate-600 bg-slate-800/50 hover:border-indigo-500 hover:bg-slate-800 transition-all text-left group relative"
              >
                <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">NEW</span>
                <div className="flex items-center gap-3 mb-2">
                  <Layers className="h-6 w-6 text-indigo-400" />
                  <h3 className="text-white font-semibold text-base">BDD Automation</h3>
                </div>
                <p className="text-slate-400 text-sm">
                  Full BDD architecture: Step Definitions → Abstraction Layer → Framework Adapter. True framework-agnostic engine.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step 3b: Framework selection (both modes) */}
        {gherkinGenerated && automationMode && !frameworkAfterGherkin && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">3</div>
                <h2 className="text-lg font-semibold text-white">
                  {automationMode === "bdd" ? "Select Framework for BDD Architecture" : "Select Framework (Classic + Gherkin)"}
                </h2>
              </div>
              <Button 
                variant="outline" size="sm"
                onClick={() => setAutomationMode(null)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Back to Mode Selection
              </Button>
            </div>
            {frameworkButtons(handleSelectFrameworkAfterGherkin)}
          </div>
        )}

        {/* Step 3c: Classic framework output */}
        {frameworkAfterGherkin && automationMode === "classic" && testData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">3</div>
                <h2 className="text-lg font-semibold text-white">Framework Code (Classic + Gherkin)</h2>
              </div>
              <Button 
                variant="outline" size="sm"
                onClick={() => setFrameworkAfterGherkin(null)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Back to Framework Selection
              </Button>
            </div>
            <CodeOutput
              type={frameworkAfterGherkin}
              testData={testData}
              generatedCode={frameworkCode}
              onCodeGenerated={setFrameworkCode}
              isGenerating={isGeneratingFramework}
              setIsGenerating={setIsGeneratingFramework}
              gherkinContext={gherkinResult}
            />
          </div>
        )}

        {/* Step 3c: BDD framework output */}
        {frameworkAfterGherkin && automationMode === "bdd" && testData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">3</div>
                <h2 className="text-lg font-semibold text-white">BDD Architecture — {frameworkAfterGherkin.charAt(0).toUpperCase() + frameworkAfterGherkin.slice(1)}</h2>
              </div>
              <Button 
                variant="outline" size="sm"
                onClick={() => setFrameworkAfterGherkin(null)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Back to Framework Selection
              </Button>
            </div>
            <BddCodeOutput
              framework={frameworkAfterGherkin}
              testData={testData}
              gherkinScenarios={gherkinResult}
            />
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Index;
