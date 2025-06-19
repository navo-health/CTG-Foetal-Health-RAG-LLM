import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const checkBackendHealth = async () => {
  try {
    const response = await api.get('/health');
    return response.data.status === 'healthy';
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
};

export const predictFetalHealth = async (formData) => {
  try {
    const response = await api.post('/predict', formData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Prediction request failed:', error);
    throw error;
  }
};

export const getAllPapers = async () => {
  try {
    const response = await api.get('/papers');
    return response.data;
  } catch (error) {
    console.error('Failed to get papers:', error);
    throw error;
  }
};

export const uploadPaper = async (file, title) => {
  const formData = new FormData();
  formData.append('file', file);
  if (title) {
    formData.append('title', title);
  }

  try {
    const response = await api.post('/papers/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to upload paper:', error);
    throw error;
  }
};

export const addCustomPaper = async (paperData) => {
  try {
    const response = await api.post('/papers/add', paperData);
    return response.data;
  } catch (error) {
    console.error('Failed to add paper:', error);
    throw error;
  }
};

export const refreshPapers = async () => {
  try {
    const response = await api.post('/papers/refresh');
    return response.data;
  } catch (error) {
    console.error('Failed to refresh papers:', error);
    throw error;
  }
};

export const removeDuplicates = async () => {
  try {
    const response = await api.post('/papers/remove-duplicates');
    return response.data;
  } catch (error) {
    console.error('Failed to remove duplicates:', error);
    throw error;
  }
};

export const removePaper = async (paperHash) => {
  try {
    const response = await api.delete(`/papers/remove/${paperHash}`);
    return response.data;
  } catch (error) {
    console.error('Failed to remove paper:', error);
    throw error;
  }
};

export const searchPapers = async (searchOptions) => {
  try {
    const response = await api.get('/papers/search', {
      params: searchOptions
    });
    return response.data;
  } catch (error) {
    console.error('Failed to search papers:', error);
    throw error;
  }
};

export const addSelectedPapers = async (paperHashes, papers) => {
  try {
    const response = await api.post('/papers/add-selected', {
      paper_hashes: paperHashes,
      papers: papers
    });
    return response.data;
  } catch (error) {
    console.error('Failed to add selected papers:', error);
    throw error;
  }
};

export const downloadPapersWithOptions = async (options) => {
  try {
    const response = await api.post('/papers/download', options);
    return response.data;
  } catch (error) {
    console.error('Failed to download papers:', error);
    throw error;
  }
}; 