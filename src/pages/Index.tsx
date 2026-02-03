import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Code, Wand2, ArrowRight, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Homepage from "@/components/Homepage";
import Footer from "@/components/Footer";
import CsvUploader from "@/components/CsvUploader";
import UrlGenerator from "@/components/UrlGenerator";
import CodeOutput from "@/components/CodeOutput";

type OutputType = "gherkin" | "playwright" | null;

const Index = () => {
  const [showHomepage, setShowHomepage] = useState(true);
  const [activeInput, setActiveInput] = useState<"csv" | "url">("csv");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [outputType, setOutputType] = useState<OutputType>(null);
  const [generatedGherkin, setGeneratedGherkin] = useState("");
  const [generatedPlaywright, setGeneratedPlaywright] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGetStarted = () => {
    setShowHomepage(false);
  };

  const handleReset = () => {
    setCsvData([]);
    setOutputType(null);
    setGeneratedGherkin("");
    setGeneratedPlaywright("");
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
              <div className="h-12 w-12 rounded-lg overflow-hidden">
                <img
                  src="/lovable-uploads/269d3e8a-a51d-4e23-9146-715eea456ae5.png" 
                  alt="QAtalyst Logo" 
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                QAtalyst
              </h1>
            </div>
            <div className="flex items-center space-x-2 text-sm text-emerald-400">
              <Sparkles className="h-4 w-4" />
              <span>Powered by Gemini Flash</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-5xl">
        {/* Step 1: Input Source */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">1</div>
            <h2 className="text-lg font-semibold text-white">Pilih Sumber Test Case</h2>
          </div>
          
          <Tabs value={activeInput} onValueChange={(v) => setActiveInput(v as "csv" | "url")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800 mb-4">
              <TabsTrigger value="csv" className="data-[state=active]:bg-blue-600">
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </TabsTrigger>
              <TabsTrigger value="url" className="data-[state=active]:bg-blue-600">
                <FileText className="h-4 w-4 mr-2" />
                URL & Deskripsi
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv">
              <CsvUploader 
                onCsvLoaded={setCsvData} 
                csvData={csvData}
                onReset={handleReset}
              />
            </TabsContent>

            <TabsContent value="url">
              <UrlGenerator
                onGherkinGenerated={(gherkin) => {
                  setGeneratedGherkin(gherkin);
                  setOutputType("gherkin");
                }}
                isGenerating={isGenerating}
                setIsGenerating={setIsGenerating}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Step 2: Generate Options (only for CSV) */}
        {activeInput === "csv" && csvData.length > 0 && !outputType && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">2</div>
              <h2 className="text-lg font-semibold text-white">Pilih Output yang Diinginkan</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card 
                className="bg-slate-800 border-slate-700 hover:border-purple-500 transition-colors cursor-pointer group"
                onClick={() => setOutputType("gherkin")}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center text-base">
                    <Wand2 className="h-5 w-5 mr-2 text-purple-400" />
                    Generate Gherkin
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-sm">
                    Buat skenario Gherkin (BDD) dari test case CSV. Cocok untuk dokumentasi dan kolaborasi tim.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 group-hover:bg-purple-500">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Gherkin
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              <Card 
                className="bg-slate-800 border-slate-700 hover:border-green-500 transition-colors cursor-pointer group"
                onClick={() => setOutputType("playwright")}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center text-base">
                    <Code className="h-5 w-5 mr-2 text-green-400" />
                    Generate Playwright
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-sm">
                    Langsung buat script Playwright dari test case CSV. Siap untuk automation testing.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-green-600 hover:bg-green-700 group-hover:bg-green-500">
                    <Code className="h-4 w-4 mr-2" />
                    Generate Playwright
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 3: Output */}
        {outputType && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {activeInput === "csv" ? "3" : "2"}
                </div>
                <h2 className="text-lg font-semibold text-white">
                  {outputType === "gherkin" ? "Hasil Gherkin" : "Hasil Playwright"}
                </h2>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleReset}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Mulai Ulang
              </Button>
            </div>

            <CodeOutput
              type={outputType}
              csvData={csvData}
              gherkinInput={generatedGherkin}
              generatedCode={outputType === "gherkin" ? generatedGherkin : generatedPlaywright}
              onCodeGenerated={(code) => {
                if (outputType === "gherkin") {
                  setGeneratedGherkin(code);
                } else {
                  setGeneratedPlaywright(code);
                }
              }}
              onConvertToPlaywright={() => {
                setOutputType("playwright");
              }}
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
