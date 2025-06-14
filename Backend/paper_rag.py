import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import requests
import xmltodict
import json
from datetime import datetime
from typing import List, Dict
from pathlib import Path
import hashlib

class PaperRAG:
    def __init__(self):
        # === Project Setup ===
        project_root = Path(__file__).resolve().parent
        db_path = project_root  / "papers_db"

        self.vectorizer = TfidfVectorizer()
        self.papers = []
        self.vectors = None
        self.db_location = db_path
        self.initialize_papers()

    def initialize_vector_store(self):
        """Initialize the vector store with downloaded papers"""
        try:
            if not os.path.exists(self.db_location):
                papers = self.download_papers()
                self._add_papers_to_store(papers)
            else:
                self.vector_store = Chroma(
                    collection_name="diabetes_papers",
                    persist_directory=self.db_location,
                    embedding_function=self.embeddings
                )
                self._migrate_papers()
        except Exception as e:
            print(f"Initialization error: {e}")
            # If initialization fails, start fresh
            if os.path.exists(self.db_location):
                shutil.rmtree(self.db_location)
            papers = self.download_papers()
            self._add_papers_to_store(papers)

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

    def _generate_paper_hash(self, title: str, content: str) -> str:
        """Generate a unique hash for a paper based on its title and content"""
        text = (title + content).encode('utf-8')
        return hashlib.md5(text).hexdigest()

    def _migrate_papers(self):
        """Migrate existing papers to include hashes"""
        try:
            results = self.vector_store.get()
            if not results['documents']:
                return
                
            # Check if migration is needed
            if all('hash' in metadata for metadata in results['metadatas']):
                return
                
            # Create new documents with hashes
            documents = []
            ids = []
            
            for i, doc in enumerate(results['documents']):
                title = results['metadatas'][i].get('title', f'Paper {i}')
                paper_hash = self._generate_paper_hash(title, doc)
                
                document = Document(
                    page_content=doc,
                    metadata={
                        "title": title,
                        "hash": paper_hash
                    }
                )
                documents.append(document)
                ids.append(paper_hash)
            
            # Delete old database
            if os.path.exists(self.db_location):
                shutil.rmtree(self.db_location)
            
            # Create new database with migrated documents
            self.vector_store = Chroma(
                collection_name="diabetes_papers",
                persist_directory=self.db_location,
                embedding_function=self.embeddings
            )
            self.vector_store.add_documents(documents=documents, ids=ids)
            
        except Exception as e:
            print(f"Migration error: {e}")
            # If migration fails, start fresh
            if os.path.exists(self.db_location):
                shutil.rmtree(self.db_location)
            self.vector_store = None

    def _add_papers_to_store(self, papers: List[Dict]):
        """Add papers to the vector store"""
        documents = []
        ids = []
        
        for paper in papers:
            document = Document(
                page_content=paper['content'],
                metadata={
                    "title": paper['title'],
                    "hash": paper['hash']
                }
            )
            ids.append(paper['hash'])
            documents.append(document)
            
        self.vector_store = Chroma(
            collection_name="diabetes_papers",
            persist_directory=self.db_location,
            embedding_function=self.embeddings
        )
        
        self.vector_store.add_documents(documents=documents, ids=ids)

    def get_all_papers(self) -> List[Dict]:
        """Get all papers currently in the database"""
        try:
            results = self.vector_store.get()
            papers = []
            
            for i, doc in enumerate(results['documents']):
                metadata = results['metadatas'][i]
                # Handle papers without hash
                if 'hash' not in metadata:
                    title = metadata.get('title', f'Paper {i}')
                    paper_hash = self._generate_paper_hash(title, doc)
                else:
                    title = metadata['title']
                    paper_hash = metadata['hash']
                    
                papers.append({
                    'title': title,
                    'content': doc,
                    'hash': paper_hash
                })
            
            return papers
        except Exception as e:
            print(f"Error getting papers: {e}")
            return []

    def add_custom_paper(self, title: str, content: str) -> Dict:
        """Add a custom paper to the database"""
        paper_hash = self._generate_paper_hash(title, content)
        
        # Check if paper already exists
        existing_papers = self.get_all_papers()
        if any(p['hash'] == paper_hash for p in existing_papers):
            return {'status': 'error', 'message': 'Paper already exists in database'}
        
        # Add new paper
        document = Document(
            page_content=content,
            metadata={
                "title": title,
                "hash": paper_hash
            }
        )
        
        self.vector_store.add_documents(documents=[document], ids=[paper_hash])
        return {'status': 'success', 'message': 'Paper added successfully'}

    def remove_duplicates(self) -> Dict:
        """Remove duplicate papers based on hash"""
        papers = self.get_all_papers()
        seen_hashes = set()
        duplicates = []
        
        for paper in papers:
            if paper['hash'] in seen_hashes:
                duplicates.append(paper['hash'])
            seen_hashes.add(paper['hash'])
        
        if duplicates:
            self.vector_store.delete(ids=duplicates)
            return {
                'status': 'success',
                'message': f'Removed {len(duplicates)} duplicate papers',
                'removed_count': len(duplicates)
            }
        
        return {
            'status': 'success',
            'message': 'No duplicates found',
            'removed_count': 0
        }

    def refresh_papers(self) -> Dict:
        """Download new papers and add them to the database"""
        new_papers = self.download_papers()
        added_count = 0
        
        # Get existing paper hashes
        existing_papers = self.get_all_papers()
        existing_hashes = {p['hash'] for p in existing_papers}
        
        # Filter out papers that already exist
        new_papers = [p for p in new_papers if p['hash'] not in existing_hashes]
        
        if new_papers:
            self._add_papers_to_store(new_papers)
            added_count = len(new_papers)
            
        return {
            'status': 'success',
            'message': f'Added {added_count} new papers',
            'added_count': added_count
        }

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
    
    def get_relevant_papers_old(self, query, n_results=3):
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

    def _preprocess_query(self, query: str) -> str:
        """Enhance query with medical and research context"""
        # Add domain-specific medical context
        context_terms = [
            "diabetes mellitus",
            "clinical research",
            "evidence based medicine",
            "patient care",
            "medical literature"
        ]
        
        # Remove any existing context terms from query to avoid duplication
        query_terms = set(query.lower().split())
        additional_context = [term for term in context_terms 
                            if term not in query_terms]
        
        # Combine original query with context
        enhanced_query = f"{query} {' '.join(additional_context)}"
        
        # Add research methodology terms if not present
        research_terms = ["systematic review", "clinical trial", "cohort study"]
        if not any(term in enhanced_query.lower() for term in research_terms):
            enhanced_query += " research methodology"
            
        return enhanced_query

    def _construct_patient_query(self, patient_data: dict) -> str:
        """Construct a detailed query based on patient data using proper medical terminology"""
        risk_factors = []
        query_parts = []
        
        # Feature names mapping
        FEATURE_MAP = {
            '1': 'Pregnancies',
            '2': 'Glucose',
            '3': 'BloodPressure',
            '4': 'SkinThickness',
            '5': 'Insulin',
            '6': 'BMI',
            '7': 'DiabetesPedigreeFunction',
            '8': 'Age'
        }
        
        try:
            # Pregnancies
            pregnancies = float(patient_data.get('1', 0))
            if pregnancies > 6:
                risk_factors.append(f"high parity ({int(pregnancies)} pregnancies)")
                query_parts.append(f"impact of multiple pregnancies ({int(pregnancies)}) on diabetes risk")
            
            # Glucose
            glucose = float(patient_data.get('2', 0))
            if glucose > 200:
                risk_factors.append("severe hyperglycemia")
                query_parts.append("severe hyperglycemia diabetes complications management")
            elif glucose > 140:
                risk_factors.append("hyperglycemia")
                query_parts.append("hyperglycemia diabetes treatment")
            elif glucose > 120:
                risk_factors.append("impaired glucose tolerance")
                query_parts.append("impaired glucose tolerance diabetes prevention")
            
            # Blood Pressure
            bp = float(patient_data.get('3', 0))
            if bp > 140:
                risk_factors.append("stage 2 hypertension")
                query_parts.append("severe hypertension diabetes comorbidity")
            elif bp > 130:
                risk_factors.append("stage 1 hypertension")
                query_parts.append("hypertension diabetes management")
            elif bp > 120:
                risk_factors.append("elevated blood pressure")
                query_parts.append("prehypertension diabetes risk")
            
            # Skin Thickness
            skin = float(patient_data.get('4', 0))
            if skin > 35:
                risk_factors.append("increased skin fold thickness")
                query_parts.append("triceps skin fold thickness diabetes correlation")
            
            # Insulin
            insulin = float(patient_data.get('5', 0))
            if insulin > 250:
                risk_factors.append("hyperinsulinemia")
                query_parts.append("hyperinsulinemia insulin resistance diabetes")
            elif insulin < 50:
                risk_factors.append("low insulin levels")
                query_parts.append("insulin deficiency type 1 diabetes")
            
            # BMI
            bmi = float(patient_data.get('6', 0))
            if bmi > 40:
                risk_factors.append("class III obesity")
                query_parts.append("morbid obesity diabetes management")
            elif bmi > 35:
                risk_factors.append("class II obesity")
                query_parts.append("severe obesity diabetes complications")
            elif bmi > 30:
                risk_factors.append("class I obesity")
                query_parts.append("obesity diabetes risk factors")
            elif bmi > 25:
                risk_factors.append("overweight")
                query_parts.append("overweight diabetes prevention")
            
            # Diabetes Pedigree Function
            dpf = float(patient_data.get('7', 0))
            if dpf > 1.0:
                risk_factors.append("strong family history")
                query_parts.append("genetic predisposition diabetes inheritance")
            elif dpf > 0.5:
                risk_factors.append("family history")
                query_parts.append("family history diabetes risk assessment")
            
            # Age
            age = float(patient_data.get('8', 0))
            if age > 65:
                risk_factors.append("elderly")
                query_parts.append("elderly diabetes management complications")
            elif age > 45:
                risk_factors.append("middle-aged")
                query_parts.append("middle age onset diabetes risk factors")
            
        except (ValueError, TypeError, KeyError) as e:
            logger.error(f"Error processing patient data: {e}")
            return "diabetes risk factors evidence based medicine clinical research"
        
        # Combine query parts with medical context
        if query_parts:
            main_query = " ".join(query_parts)
        else:
            main_query = "diabetes mellitus risk factors clinical assessment"
            
        if risk_factors:
            risk_factors_str = ", ".join(risk_factors)
            main_query += f" patient presenting with {risk_factors_str}"
            
        # Add evidence-based medicine context
        main_query += " evidence based medicine clinical studies"
        
        return main_query

    def _get_relevance_factors(self, content: str, query: str) -> list:
        """Extract key factors that make this document relevant"""
        relevance_factors = []
        
        # Convert to lower case for case-insensitive matching
        content_lower = content.lower()
        query_lower = query.lower()
        
        # Key medical terms to look for
        medical_terms = [
            "diabetes", "glucose", "insulin", "blood pressure", "bmi",
            "obesity", "hypertension", "risk factor", "treatment",
            "management", "prevention", "complications"
        ]
        
        # Check for query term matches
        query_terms = query_lower.split()
        matched_terms = [term for term in query_terms 
                        if len(term) > 3 and term in content_lower]
        
        if matched_terms:
            relevance_factors.append(f"Contains key search terms: {', '.join(matched_terms)}")
        
        # Check for medical term matches
        matched_medical = [term for term in medical_terms 
                         if term in content_lower]
        
        if matched_medical:
            relevance_factors.append(f"Discusses medical concepts: {', '.join(matched_medical)}")
        
        # Check for research indicators
        research_indicators = [
            "study", "trial", "research", "evidence",
            "clinical", "analysis", "results", "findings"
        ]
        
        matched_research = [term for term in research_indicators 
                          if term in content_lower]
        
        if matched_research:
            relevance_factors.append("Contains research-based evidence")
        
        return relevance_factors

    def get_relevant_papers(self, patient_data):
        """Get relevant papers based on patient data with improved search"""
        # Construct detailed query from patient data
        query = self._construct_patient_query(patient_data)
        
        # Add domain context to query
        enhanced_query = self._preprocess_query(query)
        
        try:
            # Perform similarity search with improved parameters
            results = self.vector_store.similarity_search_with_score(
                enhanced_query,
                k=5  # Get top 5 results initially
            )
            
            # Filter and sort results
            filtered_results = []
            for doc, score in results:
                # Convert distance score to similarity percentage
                # The score is a distance metric (lower is better)
                # We'll use exponential decay to convert it to a similarity score
                similarity = 100 * (1 / (1 + score))
                
                filtered_results.append({
                    'title': doc.metadata['title'],
                    'content': doc.page_content[:1000] + "...",  # First 1000 chars
                    'similarity': round(similarity, 2),  # Round to 2 decimal places
                    'relevance_factors': self._get_relevance_factors(doc.page_content, query)
                })
            
            # Sort by similarity score
            filtered_results.sort(key=lambda x: x['similarity'], reverse=True)
            
            # Return top 3 most relevant results
            return filtered_results[:3]
            
        except Exception as e:
            print(f"Error in similarity search: {e}")
            # Fallback to basic search if advanced search fails
            results = self.vector_store.similarity_search(
                query,
                k=3
            )
            return [
                {
                    'title': doc.metadata['title'],
                    'content': doc.page_content[:1000] + "...",
                    'similarity': 0.0,  # Indicate this is from fallback search
                    'relevance_factors': []
                }
                for doc in results
            ]

    def search_papers_by_keyword(self, keyword: str, limit: int = 5) -> List[Dict]:
        """Search papers in the database by keyword with improved relevance"""
        try:
            # Enhance the search query
            enhanced_query = self._preprocess_query(keyword)
            
            # Perform similarity search with scores
            results = self.vector_store.similarity_search_with_score(
                enhanced_query,
                k=limit * 2  # Get more results initially for better filtering
            )
            
            # Process and filter results
            processed_results = []
            for doc, score in results:
                # Convert score to similarity percentage
                similarity = ((1 - score) * 100)
                
                # Only include results with good similarity
                if similarity >= 60:  # 60% similarity threshold
                    processed_results.append({
                        'title': doc.metadata['title'],
                        'content': doc.page_content,
                        'hash': doc.metadata['hash'],
                        'similarity': round(similarity, 2),  # Round to 2 decimal places
                        'relevance_factors': self._get_relevance_factors(doc.page_content, keyword)
                    })
            
            # Sort by similarity and return top results
            processed_results.sort(key=lambda x: x['similarity'], reverse=True)
            return processed_results[:limit]
            
        except Exception as e:
            print(f"Error searching papers: {e}")
            return []

    def search_papers_without_adding(self, query: str, max_results: int = 10, 
                                   start_date: str = None, end_date: str = None,
                                   start_index: int = 0) -> List[Dict]:
        """Search for papers without adding them to the database"""
        papers = []
        
        # Format date range for arXiv query
        date_query = ""
        if start_date and end_date:
            date_query = f"+AND+submittedDate:[{start_date}+TO+{end_date}]"
        
        # Construct arXiv API query
        url = (f"http://export.arxiv.org/api/query?"
               f"search_query=all:{query}{date_query}"
               f"&start={start_index}"
               f"&max_results={max_results}"
               f"&sortBy=submittedDate&sortOrder=descending")
        
        try:
            response = requests.get(url)
            if response.status_code == 200:
                # Parse the XML response
                data = xmltodict.parse(response.text)
                entries = data.get('feed', {}).get('entry', [])
                
                if not isinstance(entries, list):
                    entries = [entries]
                
                # Get similarity scores for the papers
                for entry in entries:
                    title = entry.get('title', '')
                    abstract = entry.get('summary', '')
                    authors = entry.get('author', [])
                    if isinstance(authors, dict):
                        authors = [authors]
                    author_names = [author.get('name', '') for author in authors]
                    published = entry.get('published', '')
                    
                    content = f"""
                    Title: {title}
                    Authors: {', '.join(author_names)}
                    Published: {published}
                    
                    Abstract:
                    {abstract}
                    """
                    
                    paper_hash = self._generate_paper_hash(title, content)
                    
                    # Calculate similarity score using the vector store
                    try:
                        results = self.vector_store.similarity_search_with_score(
                            query,
                            k=1
                        )
                        if results:
                            _, score = results[0]
                            similarity = round((1 - score) * 100, 2)
                        else:
                            similarity = 0.0
                    except Exception:
                        similarity = 0.0
                    
                    # Check if paper already exists
                    existing_papers = self.get_all_papers()
                    exists = any(p['hash'] == paper_hash for p in existing_papers)
                    
                    papers.append({
                        'title': title,
                        'content': content,
                        'hash': paper_hash,
                        'exists_in_db': exists,
                        'similarity': similarity,
                        'relevance_factors': self._get_relevance_factors(content, query)
                    })
            
            # Sort papers by similarity score
            papers.sort(key=lambda x: x['similarity'], reverse=True)
            return papers
                
        except Exception as e:
            print(f"Error searching papers: {e}")
            return []

    def add_selected_papers(self, paper_hashes: List[str], papers: List[Dict]) -> Dict:
        """Add selected papers to the database"""
        try:
            papers_to_add = [p for p in papers if p['hash'] in paper_hashes and not p.get('exists_in_db', False)]
            
            if not papers_to_add:
                return {
                    'status': 'success',
                    'message': 'No new papers to add',
                    'added_count': 0
                }
            
            documents = []
            ids = []
            
            for paper in papers_to_add:
                document = Document(
                    page_content=paper['content'],
                    metadata={
                        "title": paper['title'],
                        "hash": paper['hash']
                    }
                )
                documents.append(document)
                ids.append(paper['hash'])
            
            self.vector_store.add_documents(documents=documents, ids=ids)
            
            return {
                'status': 'success',
                'message': f'Added {len(papers_to_add)} papers',
                'added_count': len(papers_to_add)
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Error adding papers: {str(e)}'
            }

    def remove_paper(self, paper_hash: str) -> Dict:
        """Remove a specific paper from the database"""
        try:
            # Check if paper exists
            papers = self.get_all_papers()
            if not any(p['hash'] == paper_hash for p in papers):
                return {
                    'status': 'error',
                    'message': 'Paper not found in database'
                }
            
            # Remove the paper
            self.vector_store.delete(ids=[paper_hash])
            return {
                'status': 'success',
                'message': 'Paper removed successfully'
            }
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Error removing paper: {str(e)}'
            }

    def download_papers_with_options(self, query: str, max_results: int = 10, 
                                   start_date: str = None, end_date: str = None,
                                   start_index: int = 0) -> Dict:
        """Download papers with advanced options using arXiv API"""
        papers = []
        
        # Format date range for arXiv query
        date_query = ""
        if start_date and end_date:
            date_query = f"+AND+submittedDate:[{start_date}+TO+{end_date}]"
        
        # Construct arXiv API query
        url = (f"http://export.arxiv.org/api/query?"
               f"search_query=all:{query}{date_query}"
               f"&start={start_index}"
               f"&max_results={max_results}"
               f"&sortBy=submittedDate&sortOrder=descending")
        
        try:
            response = requests.get(url)
            if response.status_code == 200:
                # Parse the XML response
                data = xmltodict.parse(response.text)
                entries = data.get('feed', {}).get('entry', [])
                
                if not isinstance(entries, list):
                    entries = [entries]
                
                for entry in entries:
                    title = entry.get('title', '')
                    abstract = entry.get('summary', '')
                    authors = entry.get('author', [])
                    if isinstance(authors, dict):
                        authors = [authors]
                    author_names = [author.get('name', '') for author in authors]
                    published = entry.get('published', '')
                    
                    content = f"""
                    Title: {title}
                    Authors: {', '.join(author_names)}
                    Published: {published}
                    
                    Abstract:
                    {abstract}
                    """
                    
                    paper_hash = self._generate_paper_hash(title, content)
                    
                    # Check if paper already exists
                    existing_papers = self.get_all_papers()
                    if not any(p['hash'] == paper_hash for p in existing_papers):
                        papers.append({
                            'title': title,
                            'content': content,
                            'hash': paper_hash
                        })
            
            if papers:
                self._add_papers_to_store(papers)
                return {
                    'status': 'success',
                    'message': f'Added {len(papers)} new papers',
                    'added_count': len(papers)
                }
            else:
                return {
                    'status': 'success',
                    'message': 'No new papers found or all papers already exist',
                    'added_count': 0
                }
                
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Error downloading papers: {str(e)}'
            }

if __name__ == "__main__":
    rag = PaperRAG()
    papers = rag.get_relevant_papers_old("fetal heart rate variability analysis")
    print(json.dumps(papers, indent=2)) 