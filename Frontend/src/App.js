import { useState } from 'react';
import './App.css';
import Form from './Form';
import { PaperManager, Navbar } from './PaperManager';
import ReactHtmlParser from 'html-react-parser';  // Import the parser
import LoginPage from './LoginPage';

function LoadingSkeleton() {
   return (
      <div className="loading-skeleton">
         <div className="skeleton-header"></div>
         <div className="skeleton-content">
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
         </div>
      </div>
   );
}

function App() {
  const [isPaperManagerOpen, setIsPaperManagerOpen] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('jwt'));

  // Helper function to strip out unwanted markdown (backticks) from the result
  const sanitizeHtmlContent = (content) => {
    // Remove ```html at the start and ``` at the end of the string
    return content.replace(/^```html\s*/g, '').replace(/\s*```$/g, '');
  };

  const handleAnalysisComplete = (results) => {
    setAnalysisResults(results);
    setIsAnalyzing(false);
  };

  const handleAnalysisStart = () => {
    setIsAnalyzing(true);
  };

  const handleToggleDarkMode = () => setDarkMode((prev) => !prev);

  const handleLogout = () => {
    localStorage.removeItem('jwt');
    setLoggedIn(false);
  };

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <div className={`app${darkMode ? ' dark' : ''}`}>
      <Navbar 
        onOpenPapers={() => setIsPaperManagerOpen(true)} 
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onLogout={handleLogout}
      />

      <div className="main-container">
        <div className="content-wrapper">
          {/* Left Column - Form Section */}
          <div className="form-section">
            <h2 className="section-title">Upload Data</h2>
            <Form 
              onAnalysisComplete={handleAnalysisComplete}
              onAnalysisStart={handleAnalysisStart}
              darkMode={darkMode}
            />
          </div>

          {/* Right Column - Clinical Analysis Section */}
          <div className="analysis-section">
            <h2 className="section-title">Fetal Health Assessment Clinical Analysis</h2>
            <div className="analysis-content">
              {isAnalyzing ? (
                <LoadingSkeleton />
              ) : analysisResults ? (
                <div className="analysis-results">
                  {ReactHtmlParser(sanitizeHtmlContent(analysisResults))}  {/* Parse the sanitized HTML safely */}
                </div>
              ) : (
                <div className="placeholder-message">
                  Clinical analysis results will appear here
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PaperManager 
        isOpen={isPaperManagerOpen} 
        onClose={() => setIsPaperManagerOpen(false)} 
        darkMode={darkMode}
      />
    </div>
  );
}

export default App;