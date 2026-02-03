import { useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Download, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';

interface CsvUploaderProps {
  onCsvLoaded: (data: string[][]) => void;
  csvData: string[][];
  onReset: () => void;
}

const CsvUploader = ({ onCsvLoaded, csvData, onReset }: CsvUploaderProps) => {
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
          onCsvLoaded(filteredData);
          
          toast({
            title: "CSV Berhasil Diupload",
            description: `File "${file.name}" telah diparse dengan ${filteredData.length - 1} test case.`,
          });
        },
        header: false,
        skipEmptyLines: 'greedy',
        error: (error) => {
          console.error('CSV parsing error:', error);
          toast({
            title: "Error Parsing",
            description: "Gagal membaca file CSV. Periksa format file.",
            variant: "destructive",
          });
        }
      });
    } else {
      toast({
        title: "File Tidak Valid",
        description: "Mohon upload file dengan format CSV.",
        variant: "destructive",
      });
    }
    // Reset input value so same file can be uploaded again
    event.target.value = '';
  }, [onCsvLoaded, toast]);

  const downloadTemplate = () => {
    const template = `No,Test Case,Test Case Description,Preconditions,Test Steps,Expected Result
1,User Login,Successful user login functionality,"URL: https://example.com/login, Login credentials available","Enter username and password, Click login button","User should be redirected to dashboard, Welcome message should be displayed"
2,Form Validation,Validate form input validation,"URL: https://example.com/form, Form is accessible","Leave required field empty, Click submit button","Error message should be displayed, Form should not be submitted"`;

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
      title: "Template Diunduh",
      description: "Ikuti format template untuk hasil terbaik.",
    });
  };

  if (csvData.length > 0) {
    const headers = csvData[0];
    const dataRows = csvData.slice(1);
    
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center text-base">
                <FileText className="h-5 w-5 mr-2 text-blue-400" />
                CSV Loaded
              </CardTitle>
              <CardDescription className="text-slate-400 text-sm">
                {dataRows.length} test case siap diproses
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <X className="h-4 w-4 mr-1" />
              Hapus
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-48 overflow-auto rounded-lg border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-700 sticky top-0">
                <tr>
                  {headers.slice(0, 4).map((header, i) => (
                    <th key={i} className="text-left p-2 text-slate-300 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-slate-700">
                    {row.slice(0, 4).map((cell, j) => (
                      <td key={j} className="p-2 text-slate-400 truncate max-w-[150px]">
                        {cell || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
                {dataRows.length > 5 && (
                  <tr className="border-t border-slate-700">
                    <td colSpan={4} className="p-2 text-center text-slate-500 text-xs">
                      ... dan {dataRows.length - 5} test case lainnya
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
    <Card className="bg-slate-800 border-slate-700 border-dashed">
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
            <Upload className="h-8 w-8 text-blue-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Upload File CSV</h3>
          <p className="text-slate-400 text-sm mb-4 max-w-sm">
            Upload file CSV berisi test case. Pastikan format sesuai template.
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
              <Button asChild className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Pilih File CSV
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
