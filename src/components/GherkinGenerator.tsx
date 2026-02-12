
import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Copy, Upload, FileText, X, Play, Link, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Papa from 'papaparse';

interface GherkinGeneratorProps {
  onGherkinGenerated?: (gherkin: string, title: string) => void;
  onNavigateToPlaywright?: () => void;
  generatedGherkin?: string;
  onGherkinChange?: (gherkin: string) => void;
}

const GherkinGenerator = ({ 
  onGherkinGenerated, 
  onNavigateToPlaywright,
  generatedGherkin: initialGherkin = "",
  onGherkinChange
}: GherkinGeneratorProps) => {
  const [url, setUrl] = useState("");
  const [scenarioDesc, setScenarioDesc] = useState("");
  const [generatedGherkin, setGeneratedGherkin] = useState(initialGherkin);
  const [isGenerating, setIsGenerating] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const { toast } = useToast();

  const handleGherkinChange = (newGherkin: string) => {
    setGeneratedGherkin(newGherkin);
    onGherkinChange?.(newGherkin);
  };

  const extractScenarioTitle = (gherkin: string) => {
    const lines = gherkin.split('\n');
    const featureLine = lines.find(line => line.trim().startsWith('Feature:'));
    if (featureLine) {
      return featureLine.replace('Feature:', '').trim();
    }
    const scenarioLine = lines.find(line => line.trim().startsWith('Scenario:'));
    if (scenarioLine) {
      return scenarioLine.replace('Scenario:', '').trim();
    }
    return 'Generated Test Case';
  };

  const generateGherkinFromAI = async (url: string, scenarioDesc: string) => {
    const { data, error } = await supabase.functions.invoke('generate-gherkin', {
      body: { url, scenarioDesc }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error('AI_ERROR');
    }

    if (data.error) {
      console.error('AI error:', data.error);
      if (data.error.includes('Rate limit')) {
        throw new Error('RATE_LIMIT');
      }
      if (data.error.includes('Payment')) {
        throw new Error('PAYMENT_REQUIRED');
      }
      throw new Error('AI_ERROR');
    }

    return data.gherkin;
  };

  const generateFromUrl = async () => {
    if (!url.trim() || !scenarioDesc.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both URL and scenario description.",
        variant: "destructive",
      });
      return;
    }

    if (!url.startsWith('http')) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL starting with http or https.",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    try {
      const gherkin = await generateGherkinFromAI(url, scenarioDesc);
      const gherkinWithComment = `# URL: ${url}\n${gherkin}`;
      
      handleGherkinChange(gherkinWithComment);
      const title = extractScenarioTitle(gherkin);
      onGherkinGenerated?.(gherkinWithComment, title);
      
      toast({
        title: "Gherkin Generated",
        description: "Test scenarios have been successfully generated using Gemini Flash!",
      });
    } catch (error) {
      console.error('AI API Error:', error);
      
      if (error.message === 'RATE_LIMIT') {
        toast({
          title: "Rate Limit Exceeded",
          description: "Too many requests. Please try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      
      if (error.message === 'PAYMENT_REQUIRED') {
        toast({
          title: "Credits Required",
          description: "Please add credits to continue using AI features.",
          variant: "destructive",
        });
        return;
      }
      
      const mockGherkin = `# URL: ${url}
Feature: ${scenarioDesc}
  As a user
  I want to test the functionality at ${url}
  So that I can ensure it works correctly

  Scenario: Page loads successfully
    Given I navigate to "${url}"
    When the page loads
    Then I should see the main content
    And the page should be responsive

  Scenario: ${scenarioDesc}
    Given I am on "${url}"
    When I interact with the page elements
    Then the expected functionality should work
    And no errors should be displayed`;

      handleGherkinChange(mockGherkin);
      const title = extractScenarioTitle(mockGherkin);
      onGherkinGenerated?.(mockGherkin, title);
      
      toast({
        title: "Gherkin Generated (Fallback)",
        description: "Test scenarios generated using fallback method.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFromCsv = async () => {
    if (!csvData.length) return;
    
    setIsGenerating(true);
    try {
      const headers = csvData[0];
      const dataRows = csvData.slice(1);
      
      // Build structured text from CSV for AI transformation
      const structuredLines: string[] = [];
      
      dataRows.forEach((row) => {
        if (row.some(cell => cell && cell.trim())) {
          const getCol = (name: string) => {
            const idx = headers.findIndex(h => h.trim().toLowerCase().includes(name.toLowerCase()));
            return idx >= 0 ? (row[idx] || '').trim() : '';
          };
          
          const id = getCol('No') || getCol('ID') || getCol('Test Case ID');
          const testCase = getCol('Test Case');
          const description = getCol('Description');
          const preconditions = getCol('Preconditions');
          const steps = getCol('Steps');
          const expected = getCol('Expected');
          const locators = getCol('Locator') || getCol('Selector');
          const testData = getCol('Data') || getCol('Input');

          structuredLines.push(`---`);
          if (id) structuredLines.push(`Test Case ID: ${id}`);
          if (testCase) structuredLines.push(`Test Case: ${testCase}`);
          if (description) structuredLines.push(`Description: ${description}`);
          if (preconditions) structuredLines.push(`Preconditions: ${preconditions}`);
          if (steps) structuredLines.push(`Test Steps: ${steps}`);
          if (expected) structuredLines.push(`Expected Result: ${expected}`);
          if (locators) structuredLines.push(`Locators: ${locators}`);
          if (testData) structuredLines.push(`Test Data: ${testData}`);
        }
      });

      const scenarioDesc = structuredLines.join('\n');
      
      // Extract URL from preconditions if available
      let extractedUrl = 'https://application-under-test.com';
      for (const row of dataRows) {
        const precIdx = headers.findIndex(h => h.trim().toLowerCase().includes('preconditions'));
        if (precIdx >= 0 && row[precIdx]) {
          const urlMatch = row[precIdx].match(/https?:\/\/[^\s,;]+/);
          if (urlMatch) {
            extractedUrl = urlMatch[0];
            break;
          }
        }
      }

      const gherkin = await generateGherkinFromAI(extractedUrl, scenarioDesc);
      
      handleGherkinChange(gherkin);
      const title = extractScenarioTitle(gherkin);
      onGherkinGenerated?.(gherkin, title);
      
      toast({
        title: "Gherkin Generated from CSV",
        description: `${dataRows.length} test cases transformed into BDD scenarios using AI.`,
      });
    } catch (error) {
      console.error('CSV Gherkin generation error:', error);
      
      if (error instanceof Error && error.message === 'RATE_LIMIT') {
        toast({
          title: "Rate Limit Exceeded",
          description: "Too many requests. Please try again in a moment.",
          variant: "destructive",
        });
      } else if (error instanceof Error && error.message === 'PAYMENT_REQUIRED') {
        toast({
          title: "Credits Required",
          description: "Please add credits to continue using AI features.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: "Failed to generate Gherkin from CSV. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadCsvTemplate = () => {
    const template = `No,Test Case,Test Case Description,Preconditions,Test Steps,Expected Result
1,User Login,Successful user login functionality,"URL: https://example.com/login, Login credentials available","Enter username and password, Click login button","User should be redirected to dashboard, Welcome message should be displayed"
2,Form Validation,Validate form input validation,"URL: https://example.com/form, Form is accessible","Leave required field empty, Click submit button","Error message should be displayed, Form should not be submitted"
3,Navigation Test,Test main navigation functionality,"URL: https://example.com, User is on homepage","Click on navigation menu items, Verify page loads","Each page should load correctly, URL should change appropriately"`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test-case-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Template Downloaded",
      description: "CSV template has been downloaded. Follow the format for best results.",
    });
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
      
      Papa.parse(file, {
        complete: (results) => {
          const parsedData = results.data as string[][];
          // Filter out empty rows
          const filteredData = parsedData.filter(row => 
            row.some(cell => cell && cell.trim())
          );
          setCsvData(filteredData);
          
          toast({
            title: "CSV Uploaded",
            description: `File "${file.name}" has been uploaded and parsed successfully.`,
          });
        },
        header: false,
        skipEmptyLines: 'greedy',
        error: (error) => {
          console.error('CSV parsing error:', error);
          toast({
            title: "Parsing Error",
            description: "Failed to parse CSV file. Please check the format.",
            variant: "destructive",
          });
        }
      });
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a valid CSV file.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const removeFile = () => {
    setCsvFile(null);
    setCsvData([]);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedGherkin);
    toast({
      title: "Copied",
      description: "Gherkin scenarios copied to clipboard!",
    });
  };

  const createPlaywright = () => {
    if (generatedGherkin) {
      onNavigateToPlaywright?.();
      toast({
        title: "Navigating to Playwright",
        description: "Opening Playwright generator with your Gherkin scenarios.",
      });
    }
  };

  const clearUrlForm = () => {
    setUrl("");
    setScenarioDesc("");
  };

  const clearCsvData = () => {
    setCsvFile(null);
    setCsvData([]);
  };

  const clearGeneratedGherkin = () => {
    handleGherkinChange("");
  };

  // Helper function to format multi-line content for display
  const formatMultiLineContent = (content: string) => {
    if (!content || content.trim() === '') return '-';
    
    // For Test Steps and Expected Result, split by line breaks first, then by other delimiters
    const lines = content
      .split(/\n/)  // Split by actual line breaks first
      .flatMap(line => line.split(/[,;]|(?=\d+\.)/))  // Then split by other delimiters
      .map(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, ''))  // Remove numbering
      .filter(line => line);
    
    return lines.length > 1 ? lines : [content.trim()];
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Wand2 className="h-5 w-5 mr-2 text-blue-400" />
            Gherkin Generator
          </CardTitle>
          <CardDescription className="text-slate-400">
            Generate test scenarios from URL or CSV data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="url" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 bg-slate-700">
              <TabsTrigger value="url">From URL</TabsTrigger>
              <TabsTrigger value="csv">From CSV</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-white text-sm font-medium">URL Input Form</Label>
                {(url || scenarioDesc) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearUrlForm}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div>
                <Label htmlFor="url" className="text-white">Website URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                />
              </div>
              <div>
                <Label htmlFor="scenarioDesc" className="text-white">Scenario Description</Label>
                <div className="mt-2 mb-2">
                  <p className="text-xs text-slate-400 mb-2">Template examples:</p>
                  <div className="space-y-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setScenarioDesc("User registration and login flow with email verification")}
                      className="block text-left text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      • "User registration and login flow with email verification"
                    </button>
                    <button
                      type="button"
                      onClick={() => setScenarioDesc("E-commerce checkout process with payment gateway")}
                      className="block text-left text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      • "E-commerce checkout process with payment gateway"
                    </button>
                    <button
                      type="button"
                      onClick={() => setScenarioDesc("Admin dashboard CRUD operations for user management")}
                      className="block text-left text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      • "Admin dashboard CRUD operations for user management"
                    </button>
                    <button
                      type="button"
                      onClick={() => setScenarioDesc("Form validation and error handling scenarios")}
                      className="block text-left text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      • "Form validation and error handling scenarios"
                    </button>
                  </div>
                </div>
                <Textarea
                  id="scenarioDesc"
                  placeholder="Describe the scenario you want to test (e.g., 'User registration and login flow')"
                  value={scenarioDesc}
                  onChange={(e) => setScenarioDesc(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-2 min-h-[100px]"
                />
              </div>
              <Button 
                onClick={generateFromUrl}
                disabled={!url.trim() || !scenarioDesc.trim() || isGenerating}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <Link className="h-4 w-4 mr-2" />
                {isGenerating ? "Generating from URL..." : "Generate from URL"}
              </Button>
            </TabsContent>
            
            <TabsContent value="csv" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-white text-sm font-medium">CSV Upload</Label>
                {csvFile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearCsvData}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                onClick={downloadCsvTemplate}
                variant="outline"
                className="w-full border-slate-600 text-black hover:bg-slate-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                Download CSV Template
              </Button>
              
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
                {!csvFile ? (
                  <div>
                    <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <span className="text-blue-400 hover:text-blue-300">Click to upload</span>
                      <span className="text-slate-400"> your CSV file</span>
                    </label>
                    <input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-slate-700 p-3 rounded">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-green-400" />
                      <span className="text-white text-sm">{csvFile.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              {csvData.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-white font-medium text-sm">Preview ({csvData.length - 1} data rows)</h4>
                  <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                    <div className="overflow-auto max-h-80">
                      <div className="min-w-full">
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${csvData[0]?.length || 1}, minmax(150px, 1fr))` }}>
                          {/* Header Row */}
                          {csvData[0]?.map((header, index) => (
                            <div key={`header-${index}`} className="bg-slate-800 border border-slate-600 p-3 rounded font-semibold text-blue-400 text-sm">
                              {header}
                            </div>
                          ))}
                          
                          {/* Data Rows - Show actual CSV data aligned with headers */}
                          {csvData.slice(1).map((row, rowIndex) => (
                            csvData[0].map((header, cellIndex) => {
                              const cellContent = row[cellIndex] || '-';
                              const isTestSteps = header.trim() === 'Test Steps';
                              const isExpectedResult = header.trim() === 'Expected Result';
                              
                              if (isTestSteps || isExpectedResult) {
                                const formattedLines = formatMultiLineContent(cellContent);
                                
                                return (
                                  <div 
                                    key={`cell-${rowIndex}-${cellIndex}`} 
                                    className="bg-slate-800/50 border border-slate-700 p-3 rounded text-slate-300 text-sm"
                                    title={cellContent}
                                  >
                                    {Array.isArray(formattedLines) && formattedLines.length > 1 ? (
                                      <div className="space-y-1">
                                        {formattedLines.map((line, lineIndex) => (
                                          <div key={lineIndex} className="break-words">
                                            {lineIndex + 1}. {line}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="break-words">{cellContent === '-' ? '-' : formattedLines[0] || cellContent}</div>
                                    )}
                                  </div>
                                );
                              }
                              
                              return (
                                <div 
                                  key={`cell-${rowIndex}-${cellIndex}`} 
                                  className="bg-slate-800/50 border border-slate-700 p-3 rounded text-slate-300 text-sm break-words"
                                  title={cellContent}
                                >
                                  {cellContent}
                                </div>
                              );
                            })
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <Button 
                onClick={generateFromCsv}
                disabled={!csvData.length || isGenerating}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isGenerating ? "Processing CSV..." : "Generate from CSV"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Generated Gherkin</CardTitle>
            <CardDescription className="text-slate-400">
              Your Gherkin scenarios are ready for review and editing
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
              disabled={!generatedGherkin.trim()}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              onClick={clearGeneratedGherkin}
              variant="outline"
              size="sm"
              className="border-slate-600 text-black hover:bg-slate-700"
            >
              Clear
            </Button>
            <Button
              onClick={() => onNavigateToPlaywright?.()}
              disabled={!generatedGherkin.trim()}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            >
              Generate Playwright
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={generatedGherkin}
            onChange={(e) => handleGherkinChange(e.target.value)}
            placeholder="Generated Gherkin scenarios will appear here..."
            className="bg-slate-900 border-slate-600 text-green-400 font-mono min-h-[300px] resize-none"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default GherkinGenerator;
