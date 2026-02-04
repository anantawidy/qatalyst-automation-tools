import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Code, Sparkles, Play, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";
import CsvUploader, { TestCaseData } from "@/components/CsvUploader";
import CodeOutput from "@/components/CodeOutput";
import WorkflowSteps from "@/components/WorkflowSteps";

type OutputType = "gherkin" | "playwright" | "selenium" | "cypress" | null;

const Index = () => {
  const [testData, setTestData] = useState<TestCaseData | null>(null);
  const [outputType, setOutputType] = useState<OutputType>(null);
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleReset = () => {
    setTestData(null);
    setOutputType(null);
    setGeneratedCode("");
  };

  const handleSelectOutput = (type: OutputType) => {
    setGeneratedCode("");
    setOutputType(type);
  };

  const getCurrentStep = () => {
    if (!testData || testData.testCases.length === 0) return 1;
    if (!outputType) return 1;
    return 2;
  };

  const hasTestCases = testData && testData.testCases.length > 0;

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
            
            {/* Documentation / BDD */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Documentation / BDD</h3>
              <Button 
                onClick={() => handleSelectOutput("gherkin")}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                size="lg"
              >
                <FileText className="h-5 w-5 mr-2" />
                Generate Gherkin
              </Button>
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
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Output */}
        {outputType && testData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">3</div>
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
              onCodeGenerated={setGeneratedCode}
              isGenerating={isGenerating}
              setIsGenerating={setIsGenerating}
            />
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Index;
