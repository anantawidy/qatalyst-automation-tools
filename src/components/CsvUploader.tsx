import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';

export interface TestCase {
  id: string;
  description: string;
  steps: string;
  expected: string;
  locator: string;
  testData: string;
}

export interface TestCaseData {
  testCases: TestCase[];
  locators: { locator: string; value: string }[];
  testData: { name: string; value: string }[];
}

interface CsvUploaderProps {
  onDataLoaded: (data: TestCaseData) => void;
  testData: TestCaseData | null;
  onReset: () => void;
}

const CsvUploader = ({ onDataLoaded, testData, onReset }: CsvUploaderProps) => {
  const { toast } = useToast();

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      Papa.parse(file, {
        complete: (results) => {
          const parsedData = results.data as string[][];
          const filteredData = parsedData.filter(row => 
            row.some(cell => cell && cell.trim())
          );
          
          const headers = filteredData[0]?.map(h => h.toLowerCase().trim()) || [];
          const dataRows = filteredData.slice(1);

          // Find column indices
          const idIdx = headers.findIndex(h => h.includes('id') || h.includes('test case'));
          const descIdx = headers.findIndex(h => h.includes('description') || h.includes('desc'));
          const stepsIdx = headers.findIndex(h => h.includes('step'));
          const expectedIdx = headers.findIndex(h => h.includes('expected'));
          const locatorIdx = headers.findIndex(h => h.includes('locator') || h.includes('selector'));
          const testDataIdx = headers.findIndex(h => h.includes('data') || h.includes('input'));

          const testCases: TestCase[] = dataRows.map(row => ({
            id: row[idIdx] || '',
            description: row[descIdx] || '',
            steps: row[stepsIdx] || '',
            expected: row[expectedIdx] || '',
            locator: row[locatorIdx] || '',
            testData: row[testDataIdx] || ''
          })).filter(tc => tc.id || tc.steps);

          // Extract unique locators
          const locatorsMap = new Map<string, string>();
          testCases.forEach(tc => {
            if (tc.locator) {
              const parts = tc.locator.split(',').map(p => p.trim());
              parts.forEach(part => {
                const [name, value] = part.split(':').map(s => s.trim());
                if (name && value) {
                  locatorsMap.set(name, value);
                } else if (name) {
                  locatorsMap.set(name, name);
                }
              });
            }
          });

          // Extract unique test data
          const testDataMap = new Map<string, string>();
          testCases.forEach(tc => {
            if (tc.testData) {
              const parts = tc.testData.split(',').map(p => p.trim());
              parts.forEach(part => {
                const [name, value] = part.split(':').map(s => s.trim());
                if (name && value) {
                  testDataMap.set(name, value);
                }
              });
            }
          });

          const newData: TestCaseData = {
            testCases,
            locators: Array.from(locatorsMap.entries()).map(([locator, value]) => ({ locator, value })),
            testData: Array.from(testDataMap.entries()).map(([name, value]) => ({ name, value }))
          };

          onDataLoaded(newData);
          
          toast({
            title: "CSV Uploaded Successfully",
            description: `${testCases.length} test cases loaded from "${file.name}".`,
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
  }, [onDataLoaded, toast]);

  const downloadTemplate = () => {
    const template = `Test Case ID,Test Description,Test Steps,Expected Result,Locators,Test Data
TC001,Verify successful login with valid credentials,Navigate to login page and enter credentials,User should be logged in successfully,usernameInput:#username;passwordInput:#password;loginBtn:button[type=submit],username:testuser@example.com;password:SecurePass123
TC002,Verify error message on empty form submission,Submit empty login form,Error message should be displayed,errorMessage:.error-text,
TC003,Verify validation for invalid email format,Enter invalid email format,Validation error should appear,emailInput:#email;validationMsg:.validation-error,email:invalid-email
TC004,Verify forgot password link navigation,Click forgot password link,Password reset page should open,forgotLink:a.forgot-password,`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'testcase-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Template Downloaded",
      description: "testcase-template.csv has been downloaded.",
    });
  };

  const hasData = testData && testData.testCases.length > 0;

  if (hasData) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-emerald-400 font-medium">
                ✓ {testData.testCases.length} test cases loaded
              </span>
              {testData.locators.length > 0 && (
                <span className="text-xs text-slate-400">
                  ({testData.locators.length} locators)
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          
          <div className="max-h-48 overflow-auto rounded border border-slate-700 bg-slate-900">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 sticky top-0">
                <tr>
                  <th className="p-2 text-left text-slate-400 font-medium">ID</th>
                  <th className="p-2 text-left text-slate-400 font-medium">Steps</th>
                  <th className="p-2 text-left text-slate-400 font-medium">Expected</th>
                </tr>
              </thead>
              <tbody>
                {testData.testCases.slice(0, 5).map((tc, i) => (
                  <tr key={i} className="border-b border-slate-700 last:border-0">
                    <td className="p-2 text-blue-400 font-mono">{tc.id}</td>
                    <td className="p-2 text-slate-300 truncate max-w-[200px]">{tc.steps}</td>
                    <td className="p-2 text-slate-300 truncate max-w-[200px]">{tc.expected}</td>
                  </tr>
                ))}
                {testData.testCases.length > 5 && (
                  <tr>
                    <td colSpan={3} className="p-2 text-center text-slate-500">
                      +{testData.testCases.length - 5} more test cases
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-full bg-slate-700 flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-blue-400" />
          </div>
          <h4 className="text-base font-medium text-white mb-2">Upload Test Cases</h4>
          <p className="text-slate-400 text-sm mb-1">
            Single CSV file with all test data
          </p>
          <p className="text-slate-500 text-xs mb-4">
            Columns: Test Case ID | Test Description | Test Steps | Expected Result | Locators | Test Data
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button asChild className="bg-blue-600 hover:bg-blue-700 cursor-pointer" size="sm">
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </span>
              </Button>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CsvUploader;
