import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Download, X, Database, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';

export interface TestCaseData {
  testCases: { id: string; description: string; step: string; expected: string }[];
  locators: { locator: string; value: string }[];
  testData: { name: string; value: string }[];
}

interface CsvUploaderProps {
  onDataLoaded: (data: TestCaseData) => void;
  testData: TestCaseData | null;
  onReset: () => void;
}

const CsvUploader = ({ onDataLoaded, testData, onReset }: CsvUploaderProps) => {
  const [activeTab, setActiveTab] = useState<"testcases" | "locators" | "testdata">("testcases");
  const { toast } = useToast();

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: "testcases" | "locators" | "testdata") => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      Papa.parse(file, {
        complete: (results) => {
          const parsedData = results.data as string[][];
          const filteredData = parsedData.filter(row => 
            row.some(cell => cell && cell.trim())
          );
          
          const headers = filteredData[0];
          const dataRows = filteredData.slice(1);

          let newData: TestCaseData = testData || { testCases: [], locators: [], testData: [] };

          if (type === "testcases") {
            const idIdx = headers.findIndex(h => h.toLowerCase().includes('id'));
            const descIdx = headers.findIndex(h => h.toLowerCase().includes('description'));
            const stepIdx = headers.findIndex(h => h.toLowerCase().includes('step'));
            const expectedIdx = headers.findIndex(h => h.toLowerCase().includes('expected'));
            
            newData.testCases = dataRows.map(row => ({
              id: row[idIdx] || '',
              description: row[descIdx] || '',
              step: row[stepIdx] || '',
              expected: row[expectedIdx] || ''
            }));
          } else if (type === "locators") {
            const locatorIdx = headers.findIndex(h => h.toLowerCase().includes('locator'));
            const valueIdx = headers.findIndex(h => h.toLowerCase().includes('value'));
            
            newData.locators = dataRows.map(row => ({
              locator: row[locatorIdx] || '',
              value: row[valueIdx] || ''
            }));
          } else {
            const nameIdx = headers.findIndex(h => h.toLowerCase().includes('name') || h.toLowerCase().includes('data'));
            const valueIdx = headers.findIndex(h => h.toLowerCase().includes('value'));
            
            newData.testData = dataRows.map(row => ({
              name: row[nameIdx] || '',
              value: row[valueIdx] || ''
            }));
          }

          onDataLoaded(newData);
          
          toast({
            title: "CSV Uploaded Successfully",
            description: `File "${file.name}" has been parsed.`,
          });
        },
        header: false,
        skipEmptyLines: 'greedy',
        error: (error) => {
          console.error('CSV parsing error:', error);
          toast({
            title: "Parsing Error",
            description: "Failed to read CSV file. Check the format.",
            variant: "destructive",
          });
        }
      });
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
    }
    event.target.value = '';
  }, [onDataLoaded, testData, toast]);

  const downloadTemplate = (type: "testcases" | "locators" | "testdata") => {
    let template = '';
    let filename = '';
    
    if (type === "testcases") {
      template = `ID,Description,Step,Expected
TC001,User Login,Enter credentials and click login,User should be logged in successfully
TC002,Form Validation,Submit empty form,Error messages should be displayed`;
      filename = 'testcases-template.csv';
    } else if (type === "locators") {
      template = `Locator,Value
username_input,#username
password_input,#password
login_button,button[type="submit"]
error_message,.error-text`;
      filename = 'locators-template.csv';
    } else {
      template = `Test Data,Value
Username,testuser@example.com
Password,SecurePass123
Invalid Email,invalid-email
Empty String,`;
      filename = 'testdata-template.csv';
    }

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Template Downloaded",
      description: `${filename} has been downloaded.`,
    });
  };

  const renderUploadArea = (type: "testcases" | "locators" | "testdata", icon: React.ReactNode, title: string, description: string) => {
    const data = type === "testcases" ? testData?.testCases : type === "locators" ? testData?.locators : testData?.testData;
    
    if (data && data.length > 0) {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-400 font-medium">
              ✓ {data.length} items loaded
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (testData) {
                  const newData = { ...testData };
                  if (type === "testcases") newData.testCases = [];
                  else if (type === "locators") newData.locators = [];
                  else newData.testData = [];
                  onDataLoaded(newData);
                }
              }}
              className="text-slate-400 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-32 overflow-auto rounded border border-slate-700 bg-slate-900">
            <table className="w-full text-xs">
              <tbody>
                {(data as any[]).slice(0, 3).map((item, i) => (
                  <tr key={i} className="border-b border-slate-700 last:border-0">
                    <td className="p-2 text-slate-400">
                      {type === "testcases" 
                        ? `${(item as any).id}: ${(item as any).description?.slice(0, 30)}...`
                        : type === "locators"
                        ? `${(item as any).locator}: ${(item as any).value}`
                        : `${(item as any).name}: ${(item as any).value}`
                      }
                    </td>
                  </tr>
                ))}
                {data.length > 3 && (
                  <tr>
                    <td className="p-2 text-center text-slate-500">
                      +{data.length - 3} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center text-center py-6">
        <div className="h-12 w-12 rounded-full bg-slate-700 flex items-center justify-center mb-3">
          {icon}
        </div>
        <h4 className="text-sm font-medium text-white mb-1">{title}</h4>
        <p className="text-slate-400 text-xs mb-3">{description}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadTemplate(type)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Template
          </Button>
          <label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e, type)}
              className="hidden"
            />
            <Button asChild className="bg-blue-600 hover:bg-blue-700 cursor-pointer text-xs" size="sm">
              <span>
                <Upload className="h-3 w-3 mr-1" />
                Upload
              </span>
            </Button>
          </label>
        </div>
      </div>
    );
  };

  const hasAnyData = testData && (testData.testCases.length > 0 || testData.locators.length > 0 || testData.testData.length > 0);

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-4">
        {hasAnyData && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-white font-medium">Test Data Loaded</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3 bg-slate-700 mb-4">
            <TabsTrigger value="testcases" className="data-[state=active]:bg-blue-600 text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Test Cases
            </TabsTrigger>
            <TabsTrigger value="locators" className="data-[state=active]:bg-blue-600 text-xs">
              <Database className="h-3 w-3 mr-1" />
              Locators
            </TabsTrigger>
            <TabsTrigger value="testdata" className="data-[state=active]:bg-blue-600 text-xs">
              <TestTube className="h-3 w-3 mr-1" />
              Test Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="testcases">
            {renderUploadArea(
              "testcases",
              <FileText className="h-6 w-6 text-blue-400" />,
              "Test Cases",
              "ID | Description | Step | Expected"
            )}
          </TabsContent>

          <TabsContent value="locators">
            {renderUploadArea(
              "locators",
              <Database className="h-6 w-6 text-purple-400" />,
              "Locators",
              "Locator | Value"
            )}
          </TabsContent>

          <TabsContent value="testdata">
            {renderUploadArea(
              "testdata",
              <TestTube className="h-6 w-6 text-orange-400" />,
              "Test Data",
              "Data Name | Value"
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CsvUploader;
