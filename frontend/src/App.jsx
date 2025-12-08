import { useState, useEffect } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Shield, 
  Upload, 
  Github, 
  FileCode, 
  AlertTriangle, 
  CheckCircle, 
  Download, 
  Loader2,
  Terminal,
  Upload as LinkIcon,
  Sparkles, // <--- NEW: Icon for AI
  Bot       // <--- NEW: Icon for AI
} from 'lucide-react';

// Get API URL from environment variables or default to localhost
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [scanType, setScanType] = useState('file'); 
  const [file, setFile] = useState(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [issues, setIssues] = useState([]);
  const [trustScore, setTrustScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [statusText, setStatusText] = useState("Initializing...");
  
  // --- NEW: AI Explanation State ---
  const [explainingIndex, setExplainingIndex] = useState(null); // Which card is expanding?
  const [aiResponse, setAiResponse] = useState(""); // The text from Groq
  const [isExplaining, setIsExplaining] = useState(false); // Loading state for AI

  // Cycle through status messages while loading
  useEffect(() => {
    if (!loading) return;
    const messages = [
      "Connecting to analysis engine...",
      "Parsing Abstract Syntax Tree (AST)...",
      "Scanning for hardcoded secrets...",
      "Analyzing control flow graphs...",
      "Calculating repository trust score...",
      "Generating security report..."
    ];
    let i = 0;
    setStatusText(messages[0]);
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setStatusText(messages[i]);
    }, 800);
    return () => clearInterval(interval);
  }, [loading]);

  const getSeverityColor = (severity) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'bg-red-500/10 text-red-400 border-red-500/50';
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-blue-500/10 text-blue-400 border-blue-500/50';
      default: return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50';
    }
  };

  const downloadCSV = () => {
    if (issues.length === 0) return;
    const headers = ["Filename", "Line", "Severity", "Issue"];
    const rows = issues.map(issue => 
      `"${issue.filename}","${issue.line}","${issue.severity}","${issue.issue}"`
    );
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "scan_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Report downloaded successfully!");
  };

  // --- NEW: Handle AI Explanation ---
  const handleExplain = async (index, issue) => {
    // If clicking the same button, toggle it off
    if (explainingIndex === index) {
        setExplainingIndex(null);
        setAiResponse("");
        return;
    }

    setExplainingIndex(index);
    setIsExplaining(true);
    setAiResponse("");

    try {
        const res = await axios.post(`${API_BASE}/explain`, {
            code: issue.code || "Code snippet unavailable",
            issue: issue.issue
        });
        setAiResponse(res.data.explanation);
    } catch (err) {
        console.error(err);
        setAiResponse("Error: Could not connect to AI service.");
        toast.error("AI Analysis Failed");
    } finally {
        setIsExplaining(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setIssues([]); 
    setTrustScore(null);
    setHasScanned(false);
    setExplainingIndex(null); // Reset AI view

    try {
      let res;
      if (scanType === 'file') {
        if (!file) {
          toast.error("Please select a file first!");
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        res = await axios.post(`${API_BASE}/analyze_file`, formData);
      } else {
        if (!repoUrl) {
          toast.error("Please enter a GitHub URL!");
          setLoading(false);
          return;
        }
        if (!repoUrl.includes("github.com")) {
            toast.error("Invalid URL. Must be a GitHub repository.");
            setLoading(false);
            return;
        }
        res = await axios.post(`${API_BASE}/analyze_repo`, { url: repoUrl });
        
        if (res.data.trust) {
            setTrustScore(res.data.trust);
        }
      }

      setIssues(res.data.issues);
      setHasScanned(true);
      
      if (res.data.issues.length === 0) {
        toast.success("Scan Complete: System Secure!");
      } else {
        toast("Scan Complete: Vulnerabilities Found.", {
            icon: '⚠️',
            style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
            },
        });
      }

    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 413) toast.error("File is too large (Max 1MB).");
      else if (err.response && err.response.status === 400) toast.error(err.response.data.detail);
      else toast.error("Connection failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-blue-500/30">
      <Toaster 
        position="top-right"
        toastOptions={{
            style: {
                background: '#1f2937',
                color: '#fff',
                border: '1px solid #374151',
            },
        }}
      />

      {/* HEADER - UPDATED NAME */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Git<span className="text-blue-500">Sec</span> Scanner
            </h1>
          </div>
          <div className="text-xs font-mono text-gray-500 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            SYSTEM ONLINE
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-12">
        
        {/* MAIN CARD */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden mb-10">
          
          {/* TABS */}
          <div className="flex border-b border-gray-800">
            <button 
              onClick={() => setScanType('file')}
              className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                scanType === 'file' 
                  ? 'bg-gray-800 text-white border-b-2 border-blue-500' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <FileCode className="w-4 h-4" /> Upload File
            </button>
            <button 
              onClick={() => setScanType('github')}
              className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                scanType === 'github' 
                  ? 'bg-gray-800 text-white border-b-2 border-purple-500' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Github className="w-4 h-4" /> GitHub Repo
            </button>
          </div>

          {/* INPUT FORM */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {scanType === 'file' ? (
                <div className="relative group">
                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center transition-colors group-hover:border-blue-500/50 bg-gray-950/30">
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files[0])}
                      accept=".py,.js"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-gray-800 rounded-full group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-500 mt-1">Python (.py) or JavaScript (.js)</p>
                      </div>
                      {file && (
                        <div className="mt-2 px-3 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                          Selected: {file.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Github className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="https://github.com/username/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                  loading 
                    ? 'bg-gray-800 cursor-wait' 
                    : scanType === 'file' 
                      ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' 
                      : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20'
                }`}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> {statusText}</>
                ) : (
                  <><Terminal className="w-5 h-5" /> Initiate Scan</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* RESULTS SECTION */}
        {hasScanned && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* TRUST SCORE CARD */}
            {trustScore && (
              <div className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl flex flex-col md:flex-row gap-6 items-center">
                 <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-gray-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                      <path className={trustScore.score >= 80 ? "text-emerald-500" : trustScore.score >= 60 ? "text-blue-500" : trustScore.score >= 40 ? "text-yellow-500" : "text-red-500"} strokeDasharray={`${trustScore.score}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-3xl font-bold text-white">{trustScore.score}</span>
                      <span className="text-[10px] text-gray-500 font-mono tracking-widest">TRUST</span>
                    </div>
                 </div>
                 <div className="flex-1 text-left w-full">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-white">{trustScore.grade}</h3>
                        {trustScore.score >= 80 && <CheckCircle className="w-5 h-5 text-emerald-500"/>}
                    </div>
                    <p className="text-gray-400 mb-4 text-sm">{trustScore.details}</p>
                    <div className="bg-blue-900/10 border border-blue-500/20 p-3 rounded-lg flex gap-3">
                       <Shield className="w-5 h-5 text-blue-400 shrink-0" />
                       <p className="text-xs text-blue-300/80 leading-relaxed">
                          <strong>Disclaimer:</strong> This score is calculated based on repository metadata (age, stars, activity). It does not guarantee the code is safe.
                       </p>
                    </div>
                 </div>
              </div>
            )}

            {/* SCAN FINDINGS */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                Scan Findings
                <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-full border border-gray-700">
                  {issues.length}
                </span>
              </h2>
              {issues.length > 0 && (
                <button 
                  onClick={downloadCSV}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/20"
                >
                  <Download className="w-4 h-4" /> Export Report
                </button>
              )}
            </div>

            {issues.length === 0 ? (
              <div className="p-8 bg-gray-900/50 border border-gray-800 rounded-xl text-center">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-white">System Clean</h3>
                <p className="text-gray-500">No security vulnerabilities detected.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map((issue, i) => (
                  <div 
                    key={i} 
                    className={`rounded-xl border bg-gray-900/80 backdrop-blur-sm transition-all hover:border-gray-600 overflow-hidden ${getSeverityColor(issue.severity).replace('text-', 'border-')}`}
                  >
                    <div className="p-4 flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${getSeverityColor(issue.severity)}`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold text-gray-200">
                            {issue.issue}
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${getSeverityColor(issue.severity)}`}>
                            {issue.severity}
                          </span>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 font-mono mb-3">
                          {repoUrl ? (
                             <a 
                               href={`${repoUrl}/blob/main/${issue.filename}#L${issue.line}`}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="flex items-center gap-1 hover:text-blue-400 hover:underline transition-colors"
                             >
                               <span>FILE: {issue.filename}</span>
                               <LinkIcon className="w-3 h-3 rotate-45" /> 
                             </a>
                          ) : (
                             <span>FILE: {issue.filename}</span>
                          )}
                          <span>LINE: {issue.line}</span>
                        </div>

                        {/* CODE SNIPPET */}
                        {issue.code && (
                            <div className="bg-black/50 rounded-lg p-3 border border-gray-800 font-mono text-sm text-gray-300 overflow-x-auto mb-3">
                                <div className="flex gap-3">
                                    <span className="text-gray-600 select-none border-r border-gray-700 pr-3">{issue.line}</span>
                                    <code className="text-red-300/90 whitespace-pre">{issue.code}</code>
                                </div>
                            </div>
                        )}

                        {/* AI BUTTON & EXPLANATION */}
                        <div>
                            <button
                                onClick={() => handleExplain(i, issue)}
                                className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors font-medium"
                            >
                                <Sparkles className="w-3 h-3" />
                                {explainingIndex === i ? "Close AI Analysis" : "Ask AI to Explain & Fix"}
                            </button>
                            
                            {/* THE AI BOX */}
                            {explainingIndex === i && (
                                <div className="mt-3 p-4 bg-purple-900/10 border border-purple-500/30 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 mb-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                                        <Bot className="w-4 h-4" />
                                        GitSec AI Architect
                                    </div>
                                    {isExplaining ? (
                                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Analyzing vulnerability vector...
                                        </div>
                                    ) : (
                                        <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                                            {aiResponse}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

export default App;