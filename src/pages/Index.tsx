import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Code, Sparkles, Play, TestTube, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";
import CsvUploader, { TestCaseData } from "@/components/CsvUploader";
import CodeOutput from "@/components/CodeOutput";
import BddCodeOutput from "@/components/BddCodeOutput";
import WorkflowSteps from "@/components/WorkflowSteps";

type OutputType = "gherkin" | "playwright" | "selenium" | "cypress" | "robot" | null;
type FrameworkType = "playwright" | "selenium" | "cypress" | "robot";

const Index = () => {
  const [testData, setTestData] = useState<TestCaseData | null>(null);
  const [outputType, setOutputType] = useState<OutputType>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [gherkinResult, setGherkinResult] = useState("");
  // Post-Gherkin BDD state
  const [frameworkAfterGherkin, setFrameworkAfterGherkin] = useState<FrameworkType | null>(null);
  const { toast } = useToast();

  const handleReset = () => {
    setTestData(null);
    setOutputType(null);
    setGeneratedCode("");
    setGherkinResult("");
    setFrameworkAfterGherkin(null);
  };

  const handleSelectOutput = (type: OutputType) => {
    setGeneratedCode("");
    setGherkinResult("");
    setFrameworkAfterGherkin(null);
    setOutputType(type);
  };

  const handleSelectFrameworkAfterGherkin = (type: FrameworkType) => {
    setFrameworkAfterGherkin(type);
  };

  const getCurrentStep = () => {
    if (!testData || testData.testCases.length === 0) return 1;
    if (!outputType) return 1;
    return 2;
  };

  const hasTestCases = testData && testData.testCases.length > 0;
  const gherkinGenerated = outputType === "gherkin" && gherkinResult.length > 0 && !isGenerating;
  const isClassicFramework = outputType && outputType !== "gherkin";

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
            
            {/* BDD Flow: Gherkin first */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">BDD Automation (Gherkin → Step Definitions → Actions → Adapter)</h3>
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

            {/* Classic: Direct framework */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Classic Automation (POM + Test + Data)</h3>
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
              {...(isClassicFramework ? {} : {})}
            />
          </div>
        )}

        {/* Step 3: After Gherkin → Select Framework for BDD Architecture (auto BDD mode) */}
        {gherkinGenerated && !frameworkAfterGherkin && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">3</div>
              <h2 className="text-lg font-semibold text-white">Select Framework for BDD Architecture</h2>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Generate Step Definitions → Actions → Adapter layered architecture from your Gherkin scenarios.
            </p>
            {frameworkButtons(handleSelectFrameworkAfterGherkin)}
          </div>
        )}

        {/* Step 3b: BDD framework output */}
        {frameworkAfterGherkin && testData && (
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
