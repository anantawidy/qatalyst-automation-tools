import { Github, Mail, Linkedin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-slate-900 border-t border-slate-700 mt-12">
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* About Us */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">About QAtalyst</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              QAtalyst is an AI-powered test automation platform that transforms your testing workflow. 
              Generate, manage, and execute automated tests with artificial intelligence.
            </p>
          </div>

          {/* Connect With Us */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Connect With Us</h3>
            <div className="flex space-x-4">
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Github className="h-5 w-5 text-slate-400 hover:text-white" />
              </a>
              <a 
                href="https://linkedin.com/in/ananta-widy"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Linkedin className="h-5 w-5 text-slate-400 hover:text-blue-400" />
              </a>
              <a 
                href="mailto:qatalyst.project@gmail.com"
                className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Mail className="h-5 w-5 text-slate-400 hover:text-green-400" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-8 pt-6">
          <p className="text-slate-400 text-sm text-center">
            © 2024 QAtalyst. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
