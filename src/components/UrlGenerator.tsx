import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link, Wand2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UrlGeneratorProps {
  onGherkinGenerated: (gherkin: string) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
}

const UrlGenerator = ({ onGherkinGenerated, isGenerating, setIsGenerating }: UrlGeneratorProps) => {
  const [url, setUrl] = useState("");
  const [scenarioDesc, setScenarioDesc] = useState("");
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!url.trim() || !scenarioDesc.trim()) {
      toast({
        title: "Informasi Tidak Lengkap",
        description: "Mohon isi URL dan deskripsi skenario.",
        variant: "destructive",
      });
      return;
    }

    if (!url.startsWith('http')) {
      toast({
        title: "URL Tidak Valid",
        description: "URL harus dimulai dengan http atau https.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-gherkin', {
        body: { url, scenarioDesc }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const gherkinWithUrl = `# URL: ${url}\n${data.gherkin}`;
      onGherkinGenerated(gherkinWithUrl);
      
      toast({
        title: "Gherkin Berhasil Dibuat",
        description: "Skenario test telah di-generate menggunakan Gemini Flash.",
      });
    } catch (error) {
      console.error('Generate error:', error);
      toast({
        title: "Gagal Generate",
        description: "Terjadi kesalahan. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const templates = [
    "User registration and login flow with email verification",
    "E-commerce checkout process with payment gateway",
    "Form validation with error handling",
  ];

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center text-base">
          <Link className="h-5 w-5 mr-2 text-blue-400" />
          Generate dari URL
        </CardTitle>
        <CardDescription className="text-slate-400 text-sm">
          Masukkan URL dan deskripsi untuk generate skenario Gherkin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="url" className="text-white text-sm">Website URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="bg-slate-700 border-slate-600 text-white mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="desc" className="text-white text-sm">Deskripsi Skenario</Label>
          <Textarea
            id="desc"
            placeholder="Contoh: Test login flow dengan validasi email..."
            value={scenarioDesc}
            onChange={(e) => setScenarioDesc(e.target.value)}
            className="bg-slate-700 border-slate-600 text-white mt-1 min-h-[80px]"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {templates.map((template, i) => (
              <button
                key={i}
                onClick={() => setScenarioDesc(template)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                • {template.slice(0, 40)}...
              </button>
            ))}
          </div>
        </div>

        <Button 
          onClick={handleGenerate}
          disabled={isGenerating || !url.trim() || !scenarioDesc.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Generate Gherkin
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default UrlGenerator;
