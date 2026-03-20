import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Download, Loader2, Check, FileCode, Database, AlertTriangle, Layers, Plug, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TestCaseData } from "./CsvUploader";

type FrameworkType = "playwright" | "selenium" | "cypress" | "robot";

interface BddGeneratedCode {
  stepDefinitions: string;
  actions: string;
  adapter: string;
  dataFile: string;
}

interface BddCodeOutputProps {
  framework: FrameworkType;
  testData: TestCaseData;
  gherkinScenarios: string;
}

const BddCodeOutput = ({ framework, testData, gherkinScenarios }: BddCodeOutputProps) => {
  const [code, setCode] = useState<BddGeneratedCode>({ stepDefinitions: '', actions: '', adapter: '', dataFile: '' });
  const [activeTab, setActiveTab] = useState<keyof BddGeneratedCode>("stepDefinitions");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    generateBddCode();
  }, [framework]);

  const deriveModuleName = (): string => {
    if (!testData.testCases.length) return "Page";
    const firstId = testData.testCases[0].id || "";
    const idMatch = firstId.match(/^TC[_-]([A-Za-z]+)/i);
    if (idMatch) {
      const raw = idMatch[1].toLowerCase();
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    const desc = testData.testCases[0].description || "";
    const descWord = desc.split(/[\s_-]+/).find(w => w.length > 2);
    if (descWord) {
      const clean = descWord.replace(/[^a-zA-Z]/g, '');
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }
    return "Page";
  };

  const generateBddCode = async () => {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-bdd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          framework,
          gherkinScenarios,
          testCases: testData.testCases,
          locators: testData.locators,
          testData: testData.testData,
          moduleName: deriveModuleName(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data?.error) throw new Error(data.error);

      const clean = (s: string) => s
        .replace(/```(?:javascript|typescript|json|js|robot|python)?\n?/g, '')
        .replace(/\n?```$/g, '')
        .trim();

      setCode({
        stepDefinitions: clean(data.stepDefinitions || ''),
        actions: clean(data.actions || ''),
        adapter: clean(data.adapter || ''),
        dataFile: clean(data.dataFile || ''),
      });

      toast({
        title: "BDD Code Generated",
        description: `Step Definitions, Actions, Adapter, and Data generated for ${framework}.`,
      });
    } catch (err: any) {
      console.error("BDD generation error:", err);
      if (err.name === 'AbortError') {
        setErrorMessage('Request timed out. Please try again.');
      } else {
        setErrorMessage(err.message || 'Failed to generate BDD code.');
      }
      toast({ title: "Generation Failed", description: "An error occurred.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, tab: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
    toast({ title: "Copied!", description: "Code copied to clipboard." });
  };

  const downloadCode = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: `${filename} downloaded.` });
  };

  const moduleName = deriveModuleName();
  const lower = moduleName.toLowerCase();

  const fileNames: Record<string, Record<keyof BddGeneratedCode, string>> = {
    playwright: {
      stepDefinitions: `${lower}.steps.ts`,
      actions: `${lower}Actions.ts`,
      adapter: `${lower}Adapter.ts`,
      dataFile: "testData.json",
    },
    selenium: {
      stepDefinitions: `${lower}.steps.js`,
      actions: `${lower}Actions.js`,
      adapter: `${lower}Adapter.js`,
      dataFile: "testData.json",
    },
    cypress: {
      stepDefinitions: `${lower}.steps.js`,
      actions: `${lower}Actions.js`,
      adapter: `${lower}Adapter.js`,
      dataFile: "testData.json",
    },
    robot: {
      stepDefinitions: `${lower}_steps.robot`,
      actions: `${lower}_actions.robot`,
      adapter: `${lower}_adapter.robot`,
      dataFile: "testdata.py",
    },
  };

  const fNames = fileNames[framework];

  const tabConfig: { key: keyof BddGeneratedCode; label: string; icon: React.ReactNode; folder: string }[] = [
    { key: "stepDefinitions", label: "Step Definitions", icon: <BookOpen className="h-4 w-4 mr-1" />, folder: `step-definitions/` },
    { key: "actions", label: "Actions", icon: <Layers className="h-4 w-4 mr-1" />, folder: `core/actions/` },
    { key: "adapter", label: "Adapter", icon: <Plug className="h-4 w-4 mr-1" />, folder: `adapters/${framework}/` },
    { key: "dataFile", label: "Data", icon: <Database className="h-4 w-4 mr-1" />, folder: `data/` },
  ];

  const frameworkColors: Record<string, string> = {
    playwright: "text-green-300",
    selenium: "text-orange-300",
    cypress: "text-cyan-300",
    robot: "text-rose-300",
  };

  if (errorMessage) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <AlertTitle className="text-red-300 font-semibold">Generation Failed</AlertTitle>
            <AlertDescription className="text-red-200 mt-2">{errorMessage}</AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-center">
            <Button onClick={generateBddCode} className="bg-blue-600 hover:bg-blue-700">Try Again</Button>
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
              Generating BDD Architecture for {framework.charAt(0).toUpperCase() + framework.slice(1)}...
            </h3>
            <p className="text-slate-400 text-sm">
              Creating Step Definitions → Actions → Adapter layers. Please wait.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-white flex items-center text-base">
            <Layers className="h-5 w-5 text-indigo-400 mr-2" />
            BDD Architecture — {framework.charAt(0).toUpperCase() + framework.slice(1)}
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Steps → Actions → Adapter → Framework | Fully layered, framework-agnostic
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as keyof BddGeneratedCode)}>
          <TabsList className="grid w-full grid-cols-4 bg-slate-700 mb-4">
            {tabConfig.map(t => (
              <TabsTrigger key={t.key} value={t.key} className="data-[state=active]:bg-indigo-600 text-xs sm:text-sm">
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {tabConfig.map(t => (
            <TabsContent key={t.key} value={t.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400 font-mono">{t.folder}{fNames[t.key]}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(code[t.key], t.key)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    {copiedTab === t.key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCode(code[t.key], fNames[t.key])}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={code[t.key]}
                onChange={(e) => setCode(prev => ({ ...prev, [t.key]: e.target.value }))}
                className={`bg-slate-900 border-slate-600 font-mono text-sm min-h-[300px] resize-none ${
                  t.key === "dataFile" ? "text-yellow-300" : frameworkColors[framework]
                }`}
                placeholder={`${t.label} code will appear here...`}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default BddCodeOutput;
