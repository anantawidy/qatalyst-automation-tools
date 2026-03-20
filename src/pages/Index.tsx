import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Code, Sparkles, Play, TestTube, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";
import CsvUploader, { TestCaseData } from "@/components/CsvUploader";
import CodeOutput from "@/components/CodeOutput";
import WorkflowSteps from "@/components/WorkflowSteps";

type OutputType = "gherkin" | "playwright" | "selenium" | "cypress" | "robot" | null;
type FrameworkType = "playwright" | "selenium" | "cypress" | "robot" | null;

const Index = () => {
  const [testData, setTestData] = useState<TestCaseData | null>(null);
  const [outputType, setOutputType] = useState<OutputType>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [gherkinResult, setGherkinResult] = useState("");
  const [frameworkAfterGherkin, setFrameworkAfterGherkin] = useState<FrameworkType>(null);
  const [frameworkCode, setFrameworkCode] = useState("");
  const [isGeneratingFramework, setIsGeneratingFramework] = useState(false);
  const { toast } = useToast();

  const handleReset = () => {
    setTestData(null);
    setOutputType(null);
    setGeneratedCode("");
    setGherkinResult("");
    setFrameworkAfterGherkin(null);
    setFrameworkCode("");
  };

  const handleSelectOutput = (type: OutputType) => {
    setGeneratedCode("");
    setGherkinResult("");
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
        {/* Workflow Steps */}
        <WorkflowSteps currentStep={getCurrentStep()} />

        {/* Step 1: Upload */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">1</div>
            <h2 className="text-lg font-semibold text-white">Upload Test Case (CSV)</h2>
          </div>
          
          <CsvUploader 
            onDataLoaded={setTestData}
            testData={testData}
            onReset={handleReset}
          />
        </div>

        {/* Step 2: Generate Options */}
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

            {/* Automation Framework */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Automation Framework</h3>
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => handleSelectOutput("playwright")}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <Code className="h-5 w-5 mr-2" />
                  Generate Playwright
                </Button>
                <Button 
                  onClick={() => handleSelectOutput("selenium")}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  size="lg"
                >
                  <TestTube className="h-5 w-5 mr-2" />
                  Generate Selenium
                </Button>
                <Button 
                  onClick={() => handleSelectOutput("cypress")}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  size="lg"
                >
                  <Play className="h-5 w-5 mr-2" />
                  Generate Cypress
                </Button>
                <Button 
                  onClick={() => handleSelectOutput("robot")}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  size="lg"
                  title="Keyword-driven automation, ideal for QA and non-developers."
                >
                  <Bot className="h-5 w-5 mr-2" />
                  Generate Robot Framework
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Output */}
        {outputType && testData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">2</div>
                <h2 className="text-lg font-semibold text-white">Generated Output</h2>
              </div>
              <Button 
                variant="outline" 
                size="sm"
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
                if (outputType === "gherkin") {
                  setGherkinResult(code);
                }
              }}
              isGenerating={isGenerating}
              setIsGenerating={setIsGenerating}
            />
          </div>
        )}

        {/* Step 3b: After Gherkin → Generate Framework */}
        {gherkinGenerated && !frameworkAfterGherkin && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">3</div>
              <h2 className="text-lg font-semibold text-white">Generate Automation Framework (with Gherkin Integration)</h2>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Generate automation framework code that integrates with the Gherkin scenarios above. The POM will be ready to use with your BDD step definitions.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => handleSelectFrameworkAfterGherkin("playwright")}
                className="bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <Code className="h-5 w-5 mr-2" />
                Generate Playwright
              </Button>
              <Button 
                onClick={() => handleSelectFrameworkAfterGherkin("selenium")}
                className="bg-orange-600 hover:bg-orange-700 text-white"
                size="lg"
              >
                <TestTube className="h-5 w-5 mr-2" />
                Generate Selenium
              </Button>
              <Button 
                onClick={() => handleSelectFrameworkAfterGherkin("cypress")}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                size="lg"
              >
                <Play className="h-5 w-5 mr-2" />
                Generate Cypress
              </Button>
              <Button 
                onClick={() => handleSelectFrameworkAfterGherkin("robot")}
                className="bg-rose-600 hover:bg-rose-700 text-white"
                size="lg"
              >
                <Bot className="h-5 w-5 mr-2" />
                Generate Robot Framework
              </Button>
            </div>
          </div>
        )}

        {/* Step 3c: Framework output after Gherkin */}
        {frameworkAfterGherkin && testData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">3</div>
                <h2 className="text-lg font-semibold text-white">Framework Code (Gherkin-Integrated)</h2>
              </div>
              <Button 
                variant="outline" 
                size="sm"
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
      </div>
      <Footer />
    </div>
  );
};

export default Index;
