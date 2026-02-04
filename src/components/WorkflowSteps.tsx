import { Upload, Sparkles, Play } from "lucide-react";

interface WorkflowStepsProps {
  currentStep: number;
}

const WorkflowSteps = ({ currentStep }: WorkflowStepsProps) => {
  const steps = [
    {
      number: 1,
      title: "Upload Test Case",
      subtitle: "CSV",
      icon: <Upload className="h-5 w-5" />,
    },
    {
      number: 2,
      title: "AI Generates Automation",
      subtitle: "",
      icon: <Sparkles className="h-5 w-5" />,
    },
    {
      number: 3,
      title: "Run & View Report",
      subtitle: "",
      icon: <Play className="h-5 w-5" />,
    },
  ];

  return (
    <div className="flex items-center justify-center gap-4 mb-8">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
            currentStep >= step.number 
              ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
              : 'bg-slate-800/50 border-slate-700 text-slate-500'
          }`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep >= step.number 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-700 text-slate-400'
            }`}>
              {step.number}
            </div>
            <div>
              <div className={`text-sm font-medium ${
                currentStep >= step.number ? 'text-white' : 'text-slate-400'
              }`}>
                {step.title}
              </div>
              {step.subtitle && (
                <div className="text-xs text-slate-500">({step.subtitle})</div>
              )}
            </div>
          </div>
          
          {index < steps.length - 1 && (
            <div className={`w-8 h-0.5 mx-2 ${
              currentStep > step.number ? 'bg-blue-500' : 'bg-slate-700'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default WorkflowSteps;
