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

// Analysis Modal Component
function AnalysisModal({ isOpen, onClose, analysisResults, darkMode }) {
   if (!isOpen || !analysisResults) return null;

   // Helper function to strip out unwanted markdown (backticks) from the result
   const sanitizeHtmlContent = (content) => {
      // Remove ```html at the start and ``` at the end of the string
      return content.replace(/^```html\s*/g, '').replace(/\s*```$/g, '');
   };

   return (
      <div className="modal-overlay" onClick={onClose}>
         <div className="help-modal" onClick={e => e.stopPropagation()}>
            <div className="help-modal-header">
               <h3>Fetal Health Analysis Report</h3>
               <button className="close-modal-button" onClick={onClose}>
                  <i className="fas fa-times"></i>
               </button>
            </div>
            <div className="help-modal-content">
               <div className="analysis-modal-content">
                  {ReactHtmlParser(sanitizeHtmlContent(analysisResults))}
               </div>
            </div>
         </div>
      </div>
   );
}

// Help Modal Component
function HelpModal({ isOpen, onClose, darkMode }) {
   if (!isOpen) return null;

   return (
      <div className="modal-overlay" onClick={onClose}>
         <div className="help-modal" onClick={e => e.stopPropagation()}>
            <div className="help-modal-header">
               <h3>CTG Data Field Descriptions</h3>
               <button className="close-modal-button" onClick={onClose}>
                  <i className="fas fa-times"></i>
               </button>
            </div>
            <div className="help-modal-content">
               <div className="field-description">
                  <h4>Baseline Fetal Heart Rate (FHR)</h4>
                  <p>Average heart rate of the fetus</p>
               </div>
               <div className="field-description">
                  <h4>Accelerations</h4>
                  <p>Count of fetal heart rate accelerations (temporary increases in FHR above baseline)</p>
               </div>
               <div className="field-description">
                  <h4>Fetal Movement</h4>
                  <p>Number of fetal movements</p>
               </div>
               <div className="field-description">
                  <h4>Uterine Contractions</h4>
                  <p>Number of uterine contractions</p>
               </div>
               <div className="field-description">
                  <h4>Light Decelerations</h4>
                  <p>Count of light decelerations (temporary decreases in FHR below baseline)</p>
               </div>
               <div className="field-description">
                  <h4>Severe Decelerations</h4>
                  <p>Count of severe decelerations (significant decreases in FHR below baseline)</p>
               </div>
               <div className="field-description">
                  <h4>Prolonged Decelerations</h4>
                  <p>Count of prolonged decelerations (extended decreases in FHR below baseline)</p>
               </div>
               <div className="field-description">
                  <h4>Abnormal Short-term Variability</h4>
                  <p>Percentage of time with abnormal short-term heart rate variability.</p>
               </div>
               <div className="field-description">
                  <h4>Mean Short-term Variability</h4>
                  <p>Average value of short-term heart rate variability measurements.</p>
               </div>
               <div className="field-description">
                  <h4>% Time with Abnormal Long-term Variability</h4>
                  <p>Percentage of monitoring time with abnormal long-term heart rate variability.</p>
               </div>
               <div className="field-description">
                  <h4>Mean Long-term Variability</h4>
                  <p>Average value of long-term heart rate variability measurements.</p>
               </div>
               <div className="field-description">
                  <h4>Histogram Width</h4>
                  <p>Width of the heart rate histogram distribution.</p>
               </div>
               <div className="field-description">
                  <h4>Histogram Minimum</h4>
                  <p>Minimum value in the heart rate histogram.</p>
               </div>
               <div className="field-description">
                  <h4>Histogram Maximum</h4>
                  <p>Maximum value in the heart rate histogram.</p>
               </div>
               <div className="field-description">
                  <h4>Histogram Number of Peaks</h4>
                  <p>Number of peaks detected in the heart rate histogram.</p>
               </div>
               <div className="field-description">
                  <h4>Histogram Number of Zeroes</h4>
                  <p>Number of zero values in the heart rate histogram.</p>
               </div>
               <div className="field-description">
                  <h4>Histogram Mode</h4>
                  <p>Most frequent value in the heart rate histogram.</p>
               </div>
               <div className="field-description">
                  <h4>Histogram Mean</h4>
                  <p>Average value of the heart rate histogram.</p>
               </div>
               <div className="field-description">
                  <h4>Histogram Median</h4>
                  <p>Median value of the heart rate histogram.</p>
               </div>
               <div className="field-description">
                  <h4>Histogram Variance</h4>
                  <p>Variance of the heart rate histogram distribution.</p>
               </div>
               <div className="field-description">
                  <h4>Histogram Tendency</h4>
                  <p>Tendency of the heart rate histogram distribution.</p>
               </div>
            </div>
         </div>
      </div>
   );
}

function App() {
  const [isPaperManagerOpen, setIsPaperManagerOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
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
            <div className="section-title-container">
              <h2 className="section-title">Cardiotocography (CTG) Data</h2>
              <button 
                className="help-button" 
                onClick={() => setIsHelpModalOpen(true)}
                title="Help with form fields"
              >
                <i className="fas fa-question"></i>
              </button>
            </div>
            <Form 
              onAnalysisComplete={handleAnalysisComplete}
              onAnalysisStart={handleAnalysisStart}
              darkMode={darkMode}
            />
          </div>

          {/* Right Column - Clinical Analysis Section */}
          <div className="analysis-section">
            <h2 className="section-title">Fetal Health Analysis Report</h2>
            <div className="analysis-content">
              {isAnalyzing ? (
                <LoadingSkeleton />
              ) : analysisResults ? (
                <div 
                  className="analysis-results clickable"
                  onClick={() => setIsAnalysisModalOpen(true)}
                  style={{ cursor: 'pointer' }}
                >
                  {ReactHtmlParser(sanitizeHtmlContent(analysisResults))}  {/* Parse the sanitized HTML safely */}
                </div>
              ) : (
                <div className="placeholder-message">
                  Analysis report will appear here once CTG data processed.
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

      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
        darkMode={darkMode}
      />

      <AnalysisModal 
        isOpen={isAnalysisModalOpen} 
        onClose={() => setIsAnalysisModalOpen(false)} 
        analysisResults={analysisResults}
        darkMode={darkMode}
      />
    </div>
  );
}

export default App;