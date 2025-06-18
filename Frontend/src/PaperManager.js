import { useState, useEffect, useRef } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
    getAllPapers, 
    uploadPaper, 
    refreshPapers, 
    removeDuplicates,
    removePaper,
    searchPapers,
    addSelectedPapers,
    downloadPapersWithOptions
} from './services/api';
import './PaperManager.css';

// Navbar component
function Navbar({ onOpenPapers }) {
    return (
        <div className="header-navbar">
            <div className="nav-brand">
                Fetal Health Prediction System
            </div>
            <div className="nav-actions">
                <button className="nav-button" onClick={onOpenPapers}>
                    <i className="fas fa-book-medical"></i>
                    Research Papers
                </button>
            </div>
        </div>
    );
}

// Main PaperManager component
function PaperManager({ isOpen, onClose }) {
    const [papers, setPapers] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [selectedPapers, setSelectedPapers] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showDownloadForm, setShowDownloadForm] = useState(false);
    const [newPaper, setNewPaper] = useState({ title: '', content: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);
    const [searchOptions, setSearchOptions] = useState({
        query: '',
        max_results: 10,
        start_date: '',
        end_date: '',
        start_index: 0
    });
    const [downloadOptions, setDownloadOptions] = useState({
        query: '',
        max_results: 10,
        start_date: '',
        end_date: '',
        start_index: 0
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [papersPerPage, setPapersPerPage] = useState(6);
    const [searchPage, setSearchPage] = useState(1);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadPapers();
        }
    }, [isOpen]);

    const showToast = (message, type = 'success') => {
        const toastOptions = {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            closeButton: false
        };

        switch (type) {
            case 'success':
                toast.success(message, toastOptions);
                break;
            case 'error':
                toast.error(message, toastOptions);
                break;
            default:
                toast(message, toastOptions);
        }
    };

    const loadPapers = async () => {
        try {
            setLoading(true);
            const response = await getAllPapers();
            // Sort papers by added_to_db timestamp, newest first
            const sortedPapers = response.papers.sort((a, b) => {
                const timestampA = a.added_to_db ? new Date(a.added_to_db).getTime() : 0;
                const timestampB = b.added_to_db ? new Date(b.added_to_db).getTime() : 0;
                return timestampB - timestampA; // Changed the order to show newest first
            });
            setPapers(sortedPapers);
        } catch (error) {
            showToast('Failed to load papers', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Get current papers for pagination
    const indexOfLastPaper = currentPage * papersPerPage;
    const indexOfFirstPaper = indexOfLastPaper - papersPerPage;
    // Since papers are already sorted newest first, we can just slice them
    const currentPapers = papers.slice(indexOfFirstPaper, indexOfLastPaper);
    const totalPages = Math.ceil(papers.length / papersPerPage);

    const paginate = (pageNumber) => {
        setCurrentPage(pageNumber);
        // Scroll to top when changing pages
        if (document.querySelector('.main-content')) {
            document.querySelector('.main-content').scrollTop = 0;
        }
    };

    const handleAddPaper = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
          showToast('Please select a file to upload', 'error');
          return;
        }
    
        try {
          setLoading(true);
          const result = await uploadPaper(selectedFile, newPaper.title);
    
          // Success case
          showToast(result.message);
          setNewPaper({ title: '', content: '' });
          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setShowAddForm(false);
          await loadPapers(); // Assuming this function loads the papers again
        } catch (error) {
          // Error case
          showToast(error.message || 'Failed to add paper', 'error');
        } finally {
          setLoading(false);
          setUploadProgress(0);
        }
      };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            // Auto-fill title with filename if title is empty
            if (!newPaper.title) {
                setNewPaper(prev => ({
                    ...prev,
                    title: file.name.replace(/\.[^/.]+$/, "") // Remove file extension
                }));
            }
        }
    };

    const handleRefresh = async () => {
        try {
            setLoading(true);
            const response = await refreshPapers();
            showToast(response.message);
            await loadPapers();
        } catch (error) {
            showToast('Failed to refresh papers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveDuplicates = async () => {
        try {
            setLoading(true);
            const response = await removeDuplicates();
            showToast(response.message);
            await loadPapers();
        } catch (error) {
            showToast('Failed to remove duplicates', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRemovePaper = async (paperHash) => {
        if (!window.confirm('Are you sure you want to remove this paper?')) {
            return;
        }
        
        try {
            setLoading(true);
            const response = await removePaper(paperHash);
            showToast(response.message);
            await loadPapers();
        } catch (error) {
            showToast('Failed to remove paper', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setIsSearching(true);
            const response = await searchPapers({
                ...searchOptions,
                start_index: (searchPage - 1) * searchOptions.max_results
            });
            setSearchResults(response.papers.map(paper => ({
                ...paper,
                exists_in_db: papers.some(p => p.hash === paper.hash)
            })));
        } catch (error) {
            showToast('Failed to search papers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPaper = (paperHash) => {
        setSelectedPapers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(paperHash)) {
                newSet.delete(paperHash);
            } else {
                newSet.add(paperHash);
            }
            return newSet;
        });
    };

    const handleAddSelected = async () => {
        if (selectedPapers.size === 0) {
            showToast('Please select at least one paper', 'error');
            return;
        }

        try {
            setLoading(true);
            const response = await addSelectedPapers(
                Array.from(selectedPapers),
                searchResults
            );
            showToast(response.message);
            await loadPapers();
            setSearchResults([]);
            setSelectedPapers(new Set());
            setIsSearching(false);
        } catch (error) {
            showToast('Failed to add selected papers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadWithOptions = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const response = await downloadPapersWithOptions(downloadOptions);
            showToast(response.message);
            setShowDownloadForm(false);
            await loadPapers();
        } catch (error) {
            showToast('Failed to download papers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const renderPagination = () => {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(
                <button
                    key={i}
                    onClick={() => paginate(i)}
                    className={`pagination-button ${currentPage === i ? 'active' : ''}`}
                >
                    {i}
                </button>
            );
        }
        return (
            <div className="pagination">
                <button
                    className="pagination-button"
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    Previous
                </button>
                {pages}
                <button
                    className="pagination-button"
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                >
                    Next
                </button>
            </div>
        );
    };

    return (
        <div className={`paper-manager-modal ${isOpen ? 'active' : ''}`}>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
                closeButton={false}
            />
            <div className="paper-manager">
                <button className="modal-close" onClick={onClose}>
                    <i className="fas fa-times"></i>
                </button>
                
                <div className="sidebar">
                    <h2>Research Papers</h2>
                    <div className="paper-manager-actions">
                        <button 
                            onClick={() => setShowAddForm(true)} 
                            className="action-button"
                            disabled={loading}
                        >
                            <i className="fas fa-plus"></i>
                            Add Paper
                        </button>
                        {/* <button 
                            onClick={handleRefresh} 
                            className="action-button"
                            disabled={loading}
                        >
                            <i className="fas fa-sync-alt"></i>
                            Refresh Papers
                        </button>
                        <button 
                            onClick={handleRemoveDuplicates} 
                            className="action-button"
                            disabled={loading}
                        >
                            <i className="fas fa-clone"></i>
                            Remove Duplicates
                        </button> */}
                    </div>
                </div>

                <div className="main-content">
                    <div className="search-bar">
                        <form onSubmit={handleSearch}>
                            <div className="search-inputs">
                                <input
                                    type="text"
                                    placeholder="Search papers by keyword..."
                                    value={searchOptions.query}
                                    onChange={(e) => setSearchOptions({ 
                                        ...searchOptions, 
                                        query: e.target.value 
                                    })}
                                />
                                <div className="search-controls">
                                    <div className="search-page-control">
                                        <label>Page:</label>
                                        <select
                                            value={searchPage}
                                            onChange={(e) => setSearchPage(parseInt(e.target.value))}
                                        >
                                            <option value={1}>1</option>
                                            <option value={2}>2</option>
                                            <option value={3}>3</option>
                                        </select>
                                    </div>
                                    <div className="search-results-control">
                                        <label>Results per page:</label>
                                        <select
                                            value={searchOptions.max_results}
                                            onChange={(e) => setSearchOptions({
                                                ...searchOptions,
                                                max_results: parseInt(e.target.value)
                                            })}
                                        >
                                            <option value={5}>5</option>
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="search-actions">
                                <button type="submit" disabled={loading}>
                                    <i className="fas fa-search"></i>
                                    Search
                                </button>
                                {isSearching && (
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setSearchResults([]);
                                            setSelectedPapers(new Set());
                                            setIsSearching(false);
                                            setSearchPage(1);
                                        }}
                                        className="clear-search"
                                    >
                                        <i className="fas fa-times"></i>
                                        Clear Search
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="papers-per-page">
                        <label>Papers per page:</label>
                        <select
                            value={papersPerPage}
                            onChange={(e) => {
                                setPapersPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                        >
                            <option value={6}>6</option>
                            <option value={12}>12</option>
                            <option value={24}>24</option>
                        </select>
                    </div>

                    {loading ? (
                        <div className="loading">Loading papers...</div>
                    ) : isSearching ? (
                        searchResults.length > 0 ? (
                            <div className="search-results">
                                <div className="search-results-header">
                                    <h3>Search Results ({searchResults.length})</h3>
                                    <button
                                        onClick={handleAddSelected}
                                        disabled={loading || selectedPapers.size === 0}
                                        className="add-selected-button"
                                    >
                                        <i className="fas fa-plus"></i>
                                        Add Selected ({selectedPapers.size})
                                    </button>
                                </div>
                                <div className="papers-grid">
                                    {searchResults.map((paper) => (
                                        <div key={paper.hash} className={`paper-item ${paper.exists_in_db ? 'exists' : ''}`}>
                                            <div className="paper-header">
                                                <div className="paper-title-section">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPapers.has(paper.hash)}
                                                        onChange={() => handleSelectPaper(paper.hash)}
                                                        disabled={paper.exists_in_db}
                                                    />
                                                    <h3>{paper.title}</h3>
                                                </div>
                                                {paper.exists_in_db && (
                                                    <span className="exists-badge">
                                                        <i className="fas fa-check"></i>
                                                        In Database
                                                    </span>
                                                )}
                                            </div>
                                            <div className="paper-content">
                                                <p>{paper.content}</p>
                                                {paper.similarity !== undefined && (
                                                    <div className="similarity-score">
                                                        <i className="fas fa-percentage"></i>
                                                        <span>Similarity: {paper.similarity}%</span>
                                                        <div className="score-bar">
                                                            <div 
                                                                className="score-fill"
                                                                style={{ 
                                                                    width: `${paper.similarity}%`,
                                                                    backgroundColor: paper.similarity >= 70 ? '#22c55e' : 
                                                                                   paper.similarity >= 50 ? '#eab308' : 
                                                                                   '#ef4444'
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                {paper.relevance_factors && paper.relevance_factors.length > 0 && (
                                                    <div className="relevance-factors">
                                                        <h4>Relevance Factors:</h4>
                                                        <ul>
                                                            {paper.relevance_factors.map((factor, index) => (
                                                                <li key={index}>
                                                                    <i className="fas fa-check-circle"></i>
                                                                    {factor}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {paper.added_to_db && (
                                                    <div className="paper-date">
                                                        <i className="fas fa-clock"></i>
                                                        Added: {new Date(paper.added_to_db).toLocaleDateString('en-US', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="no-results">No papers found matching your search.</div>
                        )
                    ) : papers.length === 0 ? (
                        <div className="no-papers">No papers in database</div>
                    ) : (
                        <>
                            <div className="papers-grid">
                                {currentPapers.map((paper) => (
                                    <div key={paper.hash} className="paper-item">
                                        <div className="paper-header">
                                            <h3>{paper.title}</h3>
                                            <button
                                                onClick={() => handleRemovePaper(paper.hash)}
                                                className="remove-button"
                                                disabled={loading}
                                            >
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </div>
                                        <div className="paper-content">
                                            <p>{paper.content}</p>
                                            {paper.similarity !== undefined && (
                                                <div className="similarity-score">
                                                    <i className="fas fa-percentage"></i>
                                                    <span>Similarity: {paper.similarity}%</span>
                                                    <div className="score-bar">
                                                        <div 
                                                            className="score-fill"
                                                            style={{ 
                                                                width: `${paper.similarity}%`,
                                                                backgroundColor: paper.similarity >= 70 ? '#22c55e' : 
                                                                               paper.similarity >= 50 ? '#eab308' : 
                                                                               '#ef4444'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            {paper.relevance_factors && paper.relevance_factors.length > 0 && (
                                                <div className="relevance-factors">
                                                    <h4>Relevance Factors:</h4>
                                                    <ul>
                                                        {paper.relevance_factors.map((factor, index) => (
                                                            <li key={index}>
                                                                <i className="fas fa-check-circle"></i>
                                                                {factor}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {paper.added_to_db && (
                                                <div className="paper-date">
                                                    <i className="fas fa-clock"></i>
                                                    Added: {new Date(paper.added_to_db).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {renderPagination()}
                        </>
                    )}
                </div>
            </div>

            {/* Add Paper Modal Overlay */}
            {showAddForm && (
                <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
                    <div className="add-paper-modal" onClick={e => e.stopPropagation()}>
                        <div className="add-paper-header">
                            <h3>Add New Paper</h3>
                            <button 
                                onClick={() => {
                                    setShowAddForm(false);
                                    setNewPaper({ title: '', content: '' });
                                    setSelectedFile(null);
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                    }
                                }}
                                className="close-modal-button"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <form onSubmit={handleAddPaper}>
                            <div className="upload-form-content">
                                <div className="file-upload-container">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="file-input"
                                        onChange={handleFileSelect}
                                        accept=".pdf,.doc,.docx,.csv,.txt"
                                    />
                                    <div className="upload-icon">
                                        <i className="fas fa-cloud-upload-alt"></i>
                                        <span>Drag & drop a file or click to browse</span>
                                        <small>Supported formats: PDF, DOC, DOCX, CSV, TXT</small>
                                    </div>
                                    {selectedFile && (
                                        <div className="selected-file">
                                            <i className="fas fa-file-alt"></i>
                                            <span className="file-name">{selectedFile.name}</span>
                                            <button
                                                type="button"
                                                className="remove-file-button"
                                                onClick={() => {
                                                    setSelectedFile(null);
                                                    if (fileInputRef.current) {
                                                        fileInputRef.current.value = '';
                                                    }
                                                }}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Paper Title</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={newPaper.title}
                                        onChange={(e) => setNewPaper({ ...newPaper, title: e.target.value })}
                                        placeholder="Enter paper title or leave blank to use filename"
                                    />
                                </div>

                                {uploadProgress > 0 && (
                                    <div className="upload-progress">
                                        <div 
                                            className="progress-bar"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                        <span>{uploadProgress}%</span>
                                    </div>
                                )}
                            </div>

                            <div className="form-actions">
                                <button type="submit" disabled={loading || !selectedFile}>
                                    {loading ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin"></i>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-plus"></i>
                                            Add Paper
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export { PaperManager, Navbar }; 