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
   const [chatMessages, setChatMessages] = useState([]);
   const [inputMessage, setInputMessage] = useState('');
   const [isThinking, setIsThinking] = useState(false);

   if (!isOpen || !analysisResults) return null;

   // Helper function to strip out unwanted markdown (backticks) from the result
   const sanitizeHtmlContent = (content) => {
      // Remove ```html at the start and ``` at the end of the string
      return content.replace(/^```html\s*/g, '').replace(/\s*```$/g, '');
   };

   const handleSendMessage = async () => {
      if (!inputMessage.trim()) return;

      // Add user message to chat
      const userMessage = {
         id: Date.now(),
         type: 'user',
         content: inputMessage,
         timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      setIsThinking(true);

      // Simulate AI response delay
      setTimeout(() => {
         const aiMessage = {
            id: Date.now() + 1,
            type: 'assistant',
            content: "Based on the CTG data analysis, I can help explain the fetal health assessment. The report shows various parameters including baseline fetal heart rate, accelerations, decelerations, and variability patterns. These measurements help determine the overall fetal well-being and identify any potential concerns that may require medical attention.",
            timestamp: new Date()
         };
         
         setChatMessages(prev => [...prev, aiMessage]);
         setIsThinking(false);
      }, 2000);
   };

   const handleKeyPress = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
         e.preventDefault();
         handleSendMessage();
      }
   };

   return (
      <div className="modal-overlay" onClick={onClose}>
         <div className="analysis-modal" onClick={e => e.stopPropagation()}>
            <div className="analysis-modal-header">
               <h3>Fetal Health Analysis Report</h3>
               <button className="close-modal-button" onClick={onClose}>
                  <i className="fas fa-times"></i>
               </button>
            </div>
            <div className="analysis-modal-content-wrapper">
               <div className="analysis-modal-content">
                  {ReactHtmlParser(sanitizeHtmlContent(analysisResults))}
               </div>

               {/* Chat Interface */}
               <div className="chat-section">
                  <div className="chat-header">
                     <h4>Ask about the Fetal Health Report</h4>
                     <p>Explanations, Analysis and Prediction insights</p>
                  </div>
                  
                  <div className="chat-messages">
                     {chatMessages.length === 0 && (
                        <div className="chat-welcome">
                           <i className="fas fa-robot"></i>
                           <p>Hello! I can help explain your CTG report. Ask me anything about the fetal health analysis.</p>
                        </div>
                     )}
                     
                     {chatMessages.map((message) => (
                        <div key={message.id} className={`chat-message ${message.type}`}>
                           <div className="message-avatar">
                              {message.type === 'user' ? (
                                 <i className="fas fa-user"></i>
                              ) : (
                                 <i className="fas fa-robot"></i>
                              )}
                           </div>
                           <div className="message-content">
                              <p>{message.content}</p>
                              <span className="message-time">
                                 {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                           </div>
                        </div>
                     ))}
                     
                     {isThinking && (
                        <div className="chat-message assistant">
                           <div className="message-avatar">
                              <i className="fas fa-robot"></i>
                           </div>
                           <div className="message-content">
                              <div className="thinking-indicator">
                                 <span></span>
                                 <span></span>
                                 <span></span>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
                  
                  <div className="chat-input-container">
                     <div className="chat-input-wrapper">
                        <textarea
                           value={inputMessage}
                           onChange={(e) => setInputMessage(e.target.value)}
                           onKeyPress={handleKeyPress}
                           placeholder="Ask about your CTG report..."
                           className="chat-input"
                           rows="1"
                           disabled={isThinking}
                        />
                        <button
                           onClick={handleSendMessage}
                           disabled={!inputMessage.trim() || isThinking}
                           className="send-button"
                        >
                           <i className="fas fa-paper-plane"></i>
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}

// Image Modal Component
function ImageModal({ isOpen, onClose, imageSrc, imageAlt, darkMode }) {
   if (!isOpen) return null;

   return (
      <div className="modal-overlay" onClick={onClose}>
         <div className="image-modal" onClick={e => e.stopPropagation()}>
            <div className="image-modal-header">
               <h3>{imageAlt}</h3>
               <button className="close-modal-button" onClick={onClose}>
                  <i className="fas fa-times"></i>
               </button>
            </div>
            <div className="image-modal-content">
               <img src={imageSrc} alt={imageAlt} className="enlarged-image" />
            </div>
         </div>
      </div>
   );
}

// Help Modal Component
function HelpModal({ isOpen, onClose, darkMode }) {
   const [imageModal, setImageModal] = useState({ isOpen: false, src: '', alt: '' });

   if (!isOpen) return null;

   // Mapping of field names to their corresponding images
   const fieldImageMap = {
      'Baseline Fetal Heart Rate (FHR)': 'Baseline-Fetal-Heart-Rate.jpg',
      'Accelerations': 'Acceleration.jpg',
      'Fetal Movement': 'Normal-CTG-Placeholder.png',
      'Uterine Contractions': 'Uterine-Contractions.jpg',
      'Light Decelerations': 'Early-Decelerations.jpg',
      'Severe Decelerations': 'Variable-Decelerations.jpg',
      'Prolonged Decelerations': 'Prolonged-Deceleration.jpg',
      'Abnormal Short-term Variability': 'Variability.jpg',
      'Mean Short-term Variability': 'Variability.jpg',
      '% Time with Abnormal Long-term Variability': 'Variability.jpg',
      'Mean Long-term Variability': 'Variability.jpg',
      'Histogram Width': 'Normal-CTG-Placeholder.png',
      'Histogram Minimum': 'Normal-CTG-Placeholder.png',
      'Histogram Maximum': 'Normal-CTG-Placeholder.png',
      'Histogram Number of Peaks': 'Normal-CTG-Placeholder.png',
      'Histogram Number of Zeroes': 'Normal-CTG-Placeholder.png',
      'Histogram Mode': 'Normal-CTG-Placeholder.png',
      'Histogram Mean': 'Normal-CTG-Placeholder.png',
      'Histogram Median': 'Normal-CTG-Placeholder.png',
      'Histogram Variance': 'Normal-CTG-Placeholder.png',
      'Histogram Tendency': 'Normal-CTG-Placeholder.png'
   };

   const handleImageClick = (fieldName) => {
      const imageName = fieldImageMap[fieldName] || 'Normal-CTG-Placeholder.png';
      setImageModal({
         isOpen: true,
         src: `${process.env.PUBLIC_URL}/${imageName}`,
         alt: fieldName
      });
   };

   return (
      <>
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
                  <div className="field-text">
                     <h4>Baseline Fetal Heart Rate (FHR)</h4>
                     <p>Average heart rate of the fetus</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Baseline Fetal Heart Rate (FHR)')}>
                     <img src={`${process.env.PUBLIC_URL}/Baseline-Fetal-Heart-Rate.jpg`} alt="Baseline Fetal Heart Rate" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Accelerations</h4>
                     <p>Count of fetal heart rate accelerations (temporary increases in FHR above baseline)</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Accelerations')}>
                     <img src={`${process.env.PUBLIC_URL}/Acceleration.jpg`} alt="Accelerations" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Fetal Movement</h4>
                     <p>Number of fetal movements</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Fetal Movement')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Fetal Movement" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Uterine Contractions</h4>
                     <p>Number of uterine contractions</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Uterine Contractions')}>
                     <img src={`${process.env.PUBLIC_URL}/Uterine-Contractions.jpg`} alt="Uterine Contractions" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Light Decelerations</h4>
                     <p>Count of light decelerations (temporary decreases in FHR below baseline)</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Light Decelerations')}>
                     <img src={`${process.env.PUBLIC_URL}/Early-Decelerations.jpg`} alt="Light Decelerations" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Severe Decelerations</h4>
                     <p>Count of severe decelerations (significant decreases in FHR below baseline)</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Severe Decelerations')}>
                     <img src={`${process.env.PUBLIC_URL}/Variable-Decelerations.jpg`} alt="Severe Decelerations" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Prolonged Decelerations</h4>
                     <p>Count of prolonged decelerations (extended decreases in FHR below baseline)</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Prolonged Decelerations')}>
                     <img src={`${process.env.PUBLIC_URL}/Prolonged-Deceleration.jpg`} alt="Prolonged Decelerations" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Abnormal Short-term Variability</h4>
                     <p>Percentage of time with abnormal short-term heart rate variability.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Abnormal Short-term Variability')}>
                     <img src={`${process.env.PUBLIC_URL}/Variability.jpg`} alt="Abnormal Short-term Variability" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Mean Short-term Variability</h4>
                     <p>Average value of short-term heart rate variability measurements.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Mean Short-term Variability')}>
                     <img src={`${process.env.PUBLIC_URL}/Variability.jpg`} alt="Mean Short-term Variability" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>% Time with Abnormal Long-term Variability</h4>
                     <p>Percentage of monitoring time with abnormal long-term heart rate variability.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('% Time with Abnormal Long-term Variability')}>
                     <img src={`${process.env.PUBLIC_URL}/Variability.jpg`} alt="Long-term Variability" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Mean Long-term Variability</h4>
                     <p>Average value of long-term heart rate variability measurements.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Mean Long-term Variability')}>
                     <img src={`${process.env.PUBLIC_URL}/Variability.jpg`} alt="Mean Long-term Variability" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Histogram Width</h4>
                     <p>Width of the heart rate histogram distribution.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Histogram Width')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Histogram Width" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Histogram Minimum</h4>
                     <p>Minimum value in the heart rate histogram.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Histogram Minimum')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Histogram Minimum" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Histogram Maximum</h4>
                     <p>Maximum value in the heart rate histogram.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Histogram Maximum')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Histogram Maximum" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Histogram Number of Peaks</h4>
                     <p>Number of peaks detected in the heart rate histogram.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Histogram Number of Peaks')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Histogram Number of Peaks" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Histogram Number of Zeroes</h4>
                     <p>Number of zero values in the heart rate histogram.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Histogram Number of Zeroes')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Histogram Number of Zeroes" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Histogram Mode</h4>
                     <p>Most frequent value in the heart rate histogram.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Histogram Mode')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Histogram Mode" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Histogram Mean</h4>
                     <p>Average value of the heart rate histogram.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Histogram Mean')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Histogram Mean" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Histogram Median</h4>
                     <p>Median value of the heart rate histogram.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Histogram Median')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Histogram Median" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Histogram Variance</h4>
                     <p>Variance of the heart rate histogram distribution.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Histogram Variance')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Histogram Variance" />
                  </div>
               </div>
               <div className="field-description">
                  <div className="field-text">
                     <h4>Histogram Tendency</h4>
                     <p>Tendency of the heart rate histogram distribution.</p>
                  </div>
                  <div className="field-thumbnail" onClick={() => handleImageClick('Histogram Tendency')}>
                     <img src={`${process.env.PUBLIC_URL}/Normal-CTG-Placeholder.png`} alt="Histogram Tendency" />
                  </div>
               </div>
            </div>
         </div>
      </div>

      <ImageModal 
        isOpen={imageModal.isOpen} 
        onClose={() => setImageModal({ isOpen: false, src: '', alt: '' })} 
        imageSrc={imageModal.src}
        imageAlt={imageModal.alt}
        darkMode={darkMode}
      />
      </>
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