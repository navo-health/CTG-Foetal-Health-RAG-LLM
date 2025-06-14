import { useState } from 'react';
import './App.css';
import Form from './Form';
import { PaperManager, Navbar } from './PaperManager';

function App() {
  const [isPaperManagerOpen, setIsPaperManagerOpen] = useState(false);

  return (
    <div className="app">
      <Navbar onOpenPapers={() => setIsPaperManagerOpen(true)} />
      
      <div className="main-container">
        <Form />
      </div>

      <PaperManager 
        isOpen={isPaperManagerOpen} 
        onClose={() => setIsPaperManagerOpen(false)} 
      />
    </div>
  );
}

export default App;
