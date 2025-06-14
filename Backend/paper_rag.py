import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import requests
import xmltodict
import json
from datetime import datetime

class DiabetesPaperRAG:
    def __init__(self):
        self.vectorizer = TfidfVectorizer()
        self.papers = []
        self.vectors = None
        self.initialize_papers()

    def initialize_papers(self):
        """Initialize the paper database with ArXiv papers"""
        # Fetch papers from ArXiv
        queries = [
            "fetal health cardiotocography",
            "CTG analysis machine learning",
            "fetal monitoring classification"
        ]
        
        for query in queries:
            papers = self._fetch_arxiv_papers(query)
            self.papers.extend(papers)
            
        # Create document vectors
        texts = [f"{p['title']} {p['abstract']}" for p in self.papers]
        self.vectors = self.vectorizer.fit_transform(texts)
    
    def _fetch_arxiv_papers(self, query, max_results=5):
        """Fetch papers from ArXiv API"""
        base_url = "http://export.arxiv.org/api/query"
        params = {
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": max_results,
            "sortBy": "submittedDate",
            "sortOrder": "descending"
        }
        
        response = requests.get(base_url, params=params)
        data = xmltodict.parse(response.content)
        
        papers = []
        entries = data['feed'].get('entry', [])
        if not isinstance(entries, list):
            entries = [entries]
        
        for entry in entries:
            paper = {
                'title': entry.get('title', '').replace('\n', ' '),
                'abstract': entry.get('summary', '').replace('\n', ' '),
                'authors': entry.get('author', ''),
                'published': entry.get('published', ''),
                'link': entry.get('id', '')
            }
            papers.append(paper)
            
        return papers
    
    def get_relevant_papers(self, query, n_results=3):
        """Get papers relevant to the query"""
        # Vectorize query
        query_vector = self.vectorizer.transform([query])
        
        # Calculate similarities
        similarities = cosine_similarity(query_vector, self.vectors).flatten()
        
        # Get top papers
        top_indices = np.argsort(similarities)[-n_results:][::-1]
        
        relevant_papers = []
        for idx in top_indices:
            paper = self.papers[idx]
            relevant_papers.append({
                'title': paper['title'],
                'abstract': paper['abstract'][:200] + '...',  # Truncate abstract
                'authors': paper['authors'],
                'published': paper['published'],
                'link': paper['link'],
                'similarity': float(similarities[idx])
            })
        
        return relevant_papers

if __name__ == "__main__":
    rag = DiabetesPaperRAG()
    papers = rag.get_relevant_papers("fetal heart rate variability analysis")
    print(json.dumps(papers, indent=2)) 