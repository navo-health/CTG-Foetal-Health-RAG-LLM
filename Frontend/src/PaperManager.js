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
import JSZip from 'jszip';

// Navbar component
function Navbar({ onOpenPapers, darkMode, onToggleDarkMode }) {
    return (
        <div className="navbar">
            <a href="/" className="navbar-brand">
                <img src={`${process.env.PUBLIC_URL}/logo.svg`} className="navbar-icon" />
                <div>NAVO <i>Fetal Health AI&nbsp;</i></div>
            </a>
            <div className="navbar-actions">
                <button className="navbar-button" onClick={onOpenPapers}>
                    <i className="fas fa-book-medical"></i>
                    <div>Research Papers</div>
                </button>
                <button className="darkmode-toggle" onClick={onToggleDarkMode} title="Toggle dark mode">
                    <i className={darkMode ? "fas fa-moon" : "fas fa-sun"}></i>
                </button>
            </div>
        </div>
    );
}

// Main PaperManager component
function PaperManager({ isOpen, onClose, darkMode }) {
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
    const [isDragOver, setIsDragOver] = useState(false);
    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
    const [showBulkAddModal, setShowBulkAddModal] = useState(false);
    // Chunk-level pagination state: a map of paper title to current chunk page
    const [chunkPageMap, setChunkPageMap] = useState({});
    const CHUNKS_PER_PAPER_PAGE = 3;
    const [titleFilter, setTitleFilter] = useState("");
    const [searching, setSearching] = useState(false);

    // Helper to get current chunk page for a paper
    const getChunkPage = (title) => chunkPageMap[title] || 1;
    const setChunkPage = (title, page) => setChunkPageMap(prev => ({ ...prev, [title]: page }));

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

    // Filter out initialization/minimal document before pagination
    const filteredAllPapers = papers.filter(
        paper => paper.content !== 'Initialize vector store dimensions' && paper.content && paper.content.trim() !== ''
    );

    // Group papers by title
    const groupByTitle = (items) => {
        const map = new Map();
        for (const item of items) {
            if (!item.title) continue;
            if (!map.has(item.title)) map.set(item.title, []);
            map.get(item.title).push(item);
        }
        return Array.from(map.entries()).map(([title, chunks]) => ({ title, chunks }));
    };

    // Grouped papers
    const filteredGroupedPapers = groupByTitle(
        filteredAllPapers.filter(paper =>
            !titleFilter.trim() || paper.title.toLowerCase().includes(titleFilter.trim().toLowerCase())
        )
    );
    const totalPaperGroups = filteredGroupedPapers.length;
    const totalPages = Math.ceil(totalPaperGroups / papersPerPage);
    const indexOfLastPaper = currentPage * papersPerPage;
    const indexOfFirstPaper = indexOfLastPaper - papersPerPage;
    const currentPaperGroups = filteredGroupedPapers.slice(indexOfFirstPaper, indexOfLastPaper);

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
          if (error.message && error.message.includes('Maximum allowed size')) {
            showToast(error.message, 'error');
          } else if (error.message && error.message.includes('Rate limit')) {
            showToast(error.message, 'error');
          } else {
            showToast(error.message || 'Failed to add paper', 'error');
          }
        } finally {
          setLoading(false);
          setUploadProgress(0);
        }
      };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE) {
                showToast('File too big', 'error');
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
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

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            if (file.size > MAX_FILE_SIZE) {
                showToast('File too big', 'error');
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            setSelectedFile(file);
            if (!newPaper.title) {
                setNewPaper(prev => ({
                    ...prev,
                    title: file.name.replace(/\.[^/.]+$/, "")
                }));
            }
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
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
        <div className={`paper-manager-modal${isOpen ? ' active' : ''}${darkMode ? ' dark' : ''}`}>
            <ToastContainer />
            <div className="paper-manager">
                <button className="modal-close" onClick={onClose} title="Close">
                    <i className="fas fa-times"></i>
                </button>
                
                <div className="sidebar">
                    <h2>
                        <i className="fas fa-book-medical"></i>
                        Research Papers
                    </h2>
                    <div className="paper-manager-actions">
                        <button 
                            onClick={() => setShowAddForm(true)} 
                            className="action-button"
                            disabled={loading}
                        >
                            <i className="fas fa-plus"></i>
                            <div>Add Paper</div>
                        </button>
                        <button
                            onClick={() => setShowBulkAddModal(true)}
                            className="action-button"
                            disabled={loading}
                        >
                            <i className="fas fa-layer-group"></i>
                            <div>Bulk Add Papers</div>
                        </button>
                    </div>
                </div>

                <div className="main-content">
                    <div className="papers-per-page" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <label>Papers per page:</label>
                        <select
                            value={papersPerPage}
                            onChange={(e) => {
                                setPapersPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="select-input"
                        >
                            <option value={6}>6</option>
                            <option value={12}>12</option>
                            <option value={24}>24</option>
                        </select>
                        <input
                            type="text"
                            className="form-input"
                            style={{ maxWidth: 260, marginLeft: 'auto' }}
                            placeholder="Search by paper title..."
                            value={titleFilter}
                            onChange={e => {
                                setTitleFilter(e.target.value);
                                setCurrentPage(1);
                                setSearching(true);
                                setTimeout(() => setSearching(false), 500);
                            }}
                        />
                    </div>

                    {loading ? (
                        <div className="loading">
                            <i className="fas fa-spinner fa-spin"></i>
                            Loading papers...
                        </div>
                    ) : searching ? (
                        <div className="loading searching-loading">
                            <i className="fas fa-spinner fa-spin"></i>
                            Searching...
                        </div>
                    ) : filteredGroupedPapers.length === 0 ? (
                        <div className="no-papers">
                            <i className="fas fa-folder-open"></i>
                            <p>No papers in database</p>
                        </div>
                    ) : (
                        <>
                            <div className="papers-grid">
                                {currentPaperGroups.map((group, groupIdx) => {
                                    const chunkPage = getChunkPage(group.title);
                                    const totalChunkPages = Math.ceil(group.chunks.length / CHUNKS_PER_PAPER_PAGE);
                                    const chunkStart = (chunkPage - 1) * CHUNKS_PER_PAPER_PAGE;
                                    const chunkEnd = chunkStart + CHUNKS_PER_PAPER_PAGE;
                                    const currentChunks = group.chunks.slice(chunkStart, chunkEnd);
                                    return (
                                        <div key={group.title + groupIdx} className="paper-group">
                                            <div className="paper-header">
                                                <h3>{group.title}</h3>
                                                <button
                                                    onClick={() => handleRemovePaper(group.chunks[0].hash)}
                                                    className="remove-button"
                                                    disabled={loading}
                                                    title="Remove paper and all its chunks"
                                                >
                                                    <i className="fas fa-trash-alt"></i>
                                                </button>
                                            </div>
                                            {currentChunks.map((paper) => (
                                                <div key={paper.hash} className="paper-item">
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
                                            {/* Chunk-level pagination controls */}
                                            {totalChunkPages > 1 && (
                                                <div className="pagination" style={{ margin: '0.5rem 0' }}>
                                                    <button
                                                        className="pagination-button"
                                                        onClick={() => setChunkPage(group.title, chunkPage - 1)}
                                                        disabled={chunkPage === 1}
                                                    >
                                                        Previous
                                                    </button>
                                                    {Array.from({ length: totalChunkPages }, (_, i) => (
                                                        <button
                                                            key={i + 1}
                                                            onClick={() => setChunkPage(group.title, i + 1)}
                                                            className={`pagination-button${chunkPage === i + 1 ? ' active' : ''}`}
                                                        >
                                                            {i + 1}
                                                        </button>
                                                    ))}
                                                    <button
                                                        className="pagination-button"
                                                        onClick={() => setChunkPage(group.title, chunkPage + 1)}
                                                        disabled={chunkPage === totalChunkPages}
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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
                            <h3>
                                Add New Paper
                            </h3>
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
                                title="Close"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <form onSubmit={handleAddPaper}>
                            <div className="upload-form-content">
                                <div
                                    className={`file-upload-container${isDragOver ? ' drag-over' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={e => {
                                        if (e.target === e.currentTarget) {
                                            fileInputRef.current && fileInputRef.current.click();
                                        }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="upload-icon" style={{ position: 'relative', pointerEvents: 'none' }}>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="file-input"
                                            onChange={handleFileSelect}
                                            accept=".pdf,.doc,.docx,.csv,.txt"
                                            style={{ pointerEvents: 'auto' }}
                                        />
                                        <i className="fas fa-cloud-upload-alt"></i>
                                        <div>Drag & drop a file or click to browse</div>
                                        <small>Supported formats: PDF, DOC, DOCX, CSV, TXT</small>
                                    </div>
                                    {selectedFile && (
                                        <div className="selected-file">
                                            <i className="fas fa-file-alt"></i>
                                            <span className="file-name">{selectedFile.name}</span>
                                            <button
                                                type="button"
                                                className="remove-file-button"
                                                onClick={e => {
                                                    e.stopPropagation();
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
                                {selectedFile && (
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        style={{ width: '100%', margin: '1rem 0', fontFamily: 'Inter, sans-serif', color: '#111', fill: '#111' }}
                                    >
                                        {loading ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin" style={{ color: '#111' }}></i>
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-plus" style={{ color: '#111' }}></i>
                                                Add Paper
                                            </>
                                        )}
                                    </button>
                                )}
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
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Add Papers Modal Overlay */}
            {showBulkAddModal && (
                <BulkAddPapersModal
                    onClose={() => setShowBulkAddModal(false)}
                    onBulkAddComplete={loadPapers}
                    darkMode={darkMode}
                />
            )}
        </div>
    );
}

// BulkAddPapersModal skeleton (to be implemented)
function BulkAddPapersModal({ onClose, onBulkAddComplete, darkMode }) {
    const [zipFile, setZipFile] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [summary, setSummary] = useState(null); // {success: number, failed: [{name, error}]}
    const fileInputRef = useRef(null);
    const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'csv', 'txt'];

    const showToast = (message, type = 'success') => {
        const toastOptions = {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
            closeButton: false
        };
        if (type === 'error') toast.error(message, toastOptions);
        else toast.success(message, toastOptions);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.zip')) {
            setZipFile(file);
        } else {
            showToast('Please drop a valid ZIP file.', 'error');
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file && file.name.endsWith('.zip')) {
            setZipFile(file);
        } else {
            showToast('Please select a valid ZIP file.', 'error');
        }
    };

    const handleUpload = async () => {
        if (!zipFile) return;
        setUploading(true);
        setProgress(0);
        setStatus('Extracting files...');
        setSummary(null);
        try {
            const jszip = new JSZip();
            const zip = await jszip.loadAsync(zipFile);
            const files = Object.values(zip.files)
                .filter(f => !f.dir &&
                    ALLOWED_EXTENSIONS.includes(f.name.split('.').pop().toLowerCase()) &&
                    !f.name.startsWith('__MACOSX/') &&
                    !f.name.split('/').pop().startsWith('._')
                );
            if (files.length === 0) {
                showToast('No valid files found in ZIP.', 'error');
                setUploading(false);
                return;
            }
            let uploaded = 0;
            let failed = [];
            for (const file of files) {
                setStatus(`Uploading: ${file.name}`);
                const blob = await file.async('blob');
                const ext = file.name.split('.').pop();
                const filename = file.name;
                const paperFile = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
                try {
                    await uploadPaper(paperFile, filename.replace(/\.[^/.]+$/, ''));
                    uploaded++;
                } catch (err) {
                    failed.push({ name: filename, error: err.message });
                }
                setProgress(Math.round(((uploaded + failed.length) / files.length) * 100));
            }
            setStatus('All papers processed!');
            setSummary({ success: uploaded, failed });
            setTimeout(() => {
                setUploading(false);
                setZipFile(null);
                setProgress(0);
                setStatus('');
                onBulkAddComplete();
                onClose();
                // Show summary toast
                if (failed.length === 0) {
                    showToast(`${uploaded} papers added successfully!`, 'success');
                } else {
                    showToast(`${uploaded} papers added, ${failed.length} failed: ${failed.map(f => f.name).join(', ')}`, 'error');
                }
            }, 1500);
        } catch (err) {
            showToast('Failed to process ZIP file.', 'error');
            setUploading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={uploading ? undefined : onClose}>
            <div className="add-paper-modal" onClick={e => e.stopPropagation()}>
                <div className="add-paper-header">
                    <h3>Bulk Add Papers</h3>
                    <button 
                        onClick={uploading ? undefined : onClose}
                        className="close-modal-button"
                        title="Close"
                        disabled={uploading}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="upload-form-content">
                    <div
                        className={`file-upload-container${isDragOver ? ' drag-over' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={e => {
                            if (!uploading && e.target === e.currentTarget) {
                                fileInputRef.current && fileInputRef.current.click();
                            }
                        }}
                        style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}
                    >
                        <div className="upload-icon" style={{ pointerEvents: 'none' }}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="file-input"
                                onChange={handleFileSelect}
                                accept=".zip"
                                disabled={uploading}
                                style={{ pointerEvents: 'auto' }}
                            />
                            <i className="fas fa-file-archive"></i>
                            <div>Drag & drop a ZIP file or click to browse</div>
                            <small>Supported: PDF, DOC, DOCX, CSV, TXT inside ZIP</small>
                        </div>
                        {zipFile && (
                            <div className="selected-file">
                                <i className="fas fa-file-archive"></i>
                                <span className="file-name">{zipFile.name}</span>
                                {!uploading && (
                                    <button
                                        type="button"
                                        className="remove-file-button"
                                        onClick={e => {
                                            e.stopPropagation();
                                            setZipFile(null);
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="upload-progress" style={{ marginTop: '1rem', height: '32px', background: '#f4f4f4', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div
                            className="progress-bar"
                            style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #D1F2EB 0%, #A8E6D9 100%)',
                                transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
                                borderRadius: '8px',
                                boxShadow: '0 2px 8px rgba(209,242,235,0.2)',
                            }}
                        />
                        <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', color: '#222', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.5px' }}>{progress}%</span>
                        {status && <div style={{ marginTop: '0.5rem', color: '#888', fontSize: '0.95rem', textAlign: 'center', position: 'absolute', width: '100%', top: '100%' }}>{status}</div>}
                    </div>
                    <div className="form-actions visible" style={{ marginTop: '1.5rem' }}>
                        <button
                            className="submit-button"
                            onClick={handleUpload}
                            disabled={!zipFile || uploading}
                            style={{ width: '100%' }}
                        >
                            {uploading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i> Uploading...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-layer-group"></i> Bulk Add Papers
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export { PaperManager, Navbar }; 