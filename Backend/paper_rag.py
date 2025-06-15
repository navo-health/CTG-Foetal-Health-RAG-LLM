import os
import shutil
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import requests
import xmltodict
from langchain.embeddings import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
import json
from datetime import datetime
from typing import List, Dict
from pathlib import Path
import hashlib
from langchain.text_splitter import RecursiveCharacterTextSplitter
import re
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import Runnable
from config import OPENAI_API_KEY

class PaperRAG:
    def __init__(self, top_features=None):
        # === Project Setup ===
        project_root = Path(__file__).resolve().parent
        db_path = os.path.join(str(project_root), "papers_db") # Ensure db_path is a string using os.path.join

        # Initialize embeddings
        self.embeddings = OpenAIEmbeddings(
            model="text-embedding-ada-002",
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        self.vectorizer = TfidfVectorizer()
        self.papers = []
        self.vectors = None
        self.vector_store = None
        self.db_location = db_path
        self.top_features = top_features
        self.initialize_vector_store()

    def initialize_vector_store(self):
        """Initialize the vector store with downloaded papers"""
        try:
            # Ensure the database directory exists and has correct permissions
            os.makedirs(self.db_location, exist_ok=True)
            os.chmod(self.db_location, 0o755)  # Set directory permissions to rwxr-xr-x
            
            # Check if we have an existing index file
            index_path = os.path.join(self.db_location, "index.faiss")
            if os.path.exists(index_path):
                try:
                    # Try to load existing store
                    self.vector_store = FAISS.load_local(
                        self.db_location,
                        self.embeddings
                    )
                    # Verify the store has documents
                    if len(self.vector_store.docstore._dict) > 0:
                        print(f"Successfully loaded existing vector store with {len(self.vector_store.docstore._dict)} documents")
                        return
                    else:
                        print("Vector store exists but is empty")
                except Exception as e:
                    print(f"Error loading existing store: {e}")
                    # Don't immediately create a new store, try to recover first
                    try:
                        # Try to load the store again with a different approach
                        self.vector_store = FAISS.load_local(
                            self.db_location,
                            self.embeddings,
                            allow_dangerous_deserialization=True
                        )
                        if len(self.vector_store.docstore._dict) > 0:
                            print(f"Recovered existing vector store with {len(self.vector_store.docstore._dict)} documents")
                            return
                    except Exception as recovery_error:
                        print(f"Recovery attempt failed: {recovery_error}")
            else:
                print("No existing vector store found")
            
            # Only create a new store if we absolutely have to
            if not self.vector_store or len(self.vector_store.docstore._dict) == 0:
                print("Creating new vector store")
                # Create a new store with a minimal document to initialize dimensions
                self.vector_store = FAISS.from_texts(
                    ["Initialize vector store dimensions"],  # Minimal document to set up dimensions
                    self.embeddings
                )
                # Remove the initialization document
                self.vector_store = FAISS.from_texts(
                    [],  # Now create empty store
                    self.embeddings,
                    index=self.vector_store.index  # Reuse the initialized index
                )
                self.vector_store.save_local(self.db_location)
                print("Created new empty vector store")
                
        except Exception as e:
            print(f"Critical initialization error: {e}")
            # Only create a new store if we have no store at all
            if not self.vector_store:
                print("Attempting to create new store after critical error")
                # Create store with minimal document and then remove it
                temp_store = FAISS.from_texts(
                    ["Initialize vector store dimensions"],
                    self.embeddings
                )
                self.vector_store = FAISS.from_texts(
                    [],
                    self.embeddings,
                    index=temp_store.index
                )
                self.vector_store.save_local(self.db_location)
                print("Created new vector store after critical error")

    def initialize_papers(self):
        """Initialize the paper database with ArXiv papers"""
        try:
            # Fetch papers from ArXiv
            queries = [
                "fetal health cardiotocography",
                "CTG analysis machine learning",
                "fetal monitoring classification",
                "fetal heart rate variability",
                "fetal monitoring patterns"
            ]
            
            all_papers = []
            for query in queries:
                print(f"Fetching papers for query: {query}")
                papers = self._fetch_arxiv_papers(query, max_results=10)  # Increased max results
                all_papers.extend(papers)
            
            if all_papers:
                # Convert papers to documents
                documents = []
                for paper in all_papers:
                    content = f"""
                    Title: {paper['title']}
                    Authors: {paper['authors']}
                    Published: {paper['published']}
                    
                    Abstract:
                    {paper['abstract']}
                    """
                    paper_hash = self._generate_paper_hash(paper['title'], content)
                    documents.append(Document(
                        page_content=content,
                        metadata={
                            "title": paper['title'],
                            "hash": paper_hash
                        }
                    ))
                
                # Add to vector store
                self.vector_store.add_documents(documents)
                self.vector_store.save_local(self.db_location)
                print(f"Added {len(documents)} papers to vector store")
            else:
                print("No papers found to add")
                
        except Exception as e:
            print(f"Error initializing papers: {e}")
            import traceback
            traceback.print_exc()

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
            self.vector_store = FAISS.from_documents(documents, self.embeddings)
            self.vector_store.save_local(self.db_location)
            
        except Exception as e:
            print(f"Migration error: {e}")
            # If migration fails, start fresh
            if os.path.exists(self.db_location):
                shutil.rmtree(self.db_location)
            self.vector_store = FAISS.from_texts(
                ["Initial document"],
                self.embeddings
            )

    def _add_papers_to_store(self, papers: List[Dict]):
        """Add papers to the vector store"""
        documents = []
        texts = []
        metadatas = []
        
        for paper in papers:
            texts.append(paper['content'])
            metadatas.append({
                "title": paper['title'],
                "hash": paper['hash']
            })
            
        self.vector_store.add_texts(texts=texts, metadatas=metadatas)
        self.vector_store.save_local(self.db_location)

    def get_all_papers(self) -> List[Dict]:
        """Get all papers currently in the database"""
        try:
            # Get all documents from FAISS
            docs = self.vector_store.docstore._dict.values()
            papers = []
            
            for doc in docs:
                if isinstance(doc, Document):
                    metadata = doc.metadata
                    # Handle papers without hash
                    if 'hash' not in metadata:
                        title = metadata.get('title', 'Unknown')
                        paper_hash = self._generate_paper_hash(title, doc.page_content)
                    else:
                        title = metadata['title']
                        paper_hash = metadata['hash']
                        
                    papers.append({
                        'title': title,
                        'content': doc.page_content,
                        'hash': paper_hash
                    })
            
            print(f"Retrieved {len(papers)} papers from vector store")
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
        
        # Split content into chunks
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_text(content)
        
        # Add new paper with metadata for each chunk
        texts = []
        metadatas = []
        for i, chunk in enumerate(chunks):
            texts.append(chunk)
            metadatas.append({
                "title": title,
                "hash": paper_hash,
                "chunk_index": i,
                "total_chunks": len(chunks)
            })
        
        try:
            # Add documents to the store
            self.vector_store.add_texts(texts=texts, metadatas=metadatas)
            # Save the store immediately after adding documents
            self.vector_store.save_local(self.db_location)
            print(f"Added {len(texts)} chunks and saved to {self.db_location}")
            return {'status': 'success', 'message': 'Paper added successfully'}
        except Exception as e:
            print(f"Error adding paper: {e}")
            return {'status': 'error', 'message': f'Error adding paper: {str(e)}'}

    def remove_duplicates(self) -> Dict:
        """Remove duplicate papers based on hash"""
        papers = self.get_all_papers()
        seen_hashes = set()
        unique_papers = []
        
        for paper in papers:
            if paper['hash'] not in seen_hashes:
                seen_hashes.add(paper['hash'])
                unique_papers.append(paper)
        
        if len(unique_papers) < len(papers):
            # Create new store with only unique papers
            texts = []
            metadatas = []
            for paper in unique_papers:
                texts.append(paper['content'])
                metadatas.append({
                    "title": paper['title'],
                    "hash": paper['hash']
                })
            
            self.vector_store = FAISS.from_texts(texts=texts, metadatas=metadatas, embedding=self.embeddings)
            self.vector_store.save_local(self.db_location)
            
            return {
                'status': 'success',
                'message': f'Removed {len(papers) - len(unique_papers)} duplicate papers',
                'removed_count': len(papers) - len(unique_papers)
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
            # Get all documents from the vector store
            docs = self.vector_store.docstore._dict.values()
            print(f"Total documents before removal: {len(docs)}")
            new_docs = []
            
            # Keep all documents except those with matching paper hash
            for doc in docs:
                if isinstance(doc, Document):
                    metadata = doc.metadata
                    # Skip documents with matching paper hash (including all chunks)
                    if metadata.get('hash') == paper_hash:
                        print(f"Skipping document with hash: {metadata.get('hash')}")
                        continue
                    new_docs.append(doc)
            
            print(f"Documents after filtering: {len(new_docs)}")
            
            if len(new_docs) == len(docs):
                return {
                    'status': 'error',
                    'message': 'Paper not found in database'
                }
            
            # If no documents remain, reinitialize an empty vector store
            if not new_docs:
                print("No documents remain, reinitializing empty vector store")
                self.vector_store = FAISS.from_texts([], self.embeddings)
                self.vector_store.save_local(self.db_location)
                return {
                    'status': 'success',
                    'message': 'Paper and all its chunks removed successfully (vector store is now empty)'
                }
            
            # Otherwise, create new vector store with remaining documents
            print("Creating new vector store with remaining documents")
            self.vector_store = FAISS.from_documents(new_docs, self.embeddings)
            self.vector_store.save_local(self.db_location)
            
            return {
                'status': 'success',
                'message': 'Paper and all its chunks removed successfully'
            }
        except Exception as e:
            print(f"Error in remove_paper: {e}")
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

    def _construct_feature_query(self) -> str:
        """Construct a search query from top features"""
        if not self.top_features:
            return "fetal health cardiotocography"
            
        # Create a query focusing on the top features
        query = " AND ".join(self.top_features[:3])  # Use top 3 features
        return f"fetal health cardiotocography {query}"

    def is_structured_text(self, text: str, min_words: int = 10, min_alpha_ratio: float = 0.5) -> bool:
        """Check if text is well-structured and meaningful"""
        # Remove excess whitespace
        cleaned = text.strip()

        # Reject very short texts
        if len(cleaned.split()) < min_words:
            return False

        # Count alphabetic vs total characters
        alpha_chars = len(re.findall(r'[a-zA-Z]', cleaned))
        total_chars = len(cleaned)

        # Reject if too many non-alphabetic characters
        if total_chars == 0 or alpha_chars / total_chars < min_alpha_ratio:
            return False

        return True

    def retrieve_relevant_chunks(self, top_k: int = 10, min_score: float = 0.3) -> List[Document]:  # Lowered threshold to 0.3
        """
        Retrieve relevant chunks from the vector store based on top features
        
        Args:
            top_k (int): Number of chunks to retrieve
            min_score (float): Minimum similarity score threshold
            
        Returns:
            List[Document]: List of relevant document chunks
        """
        try:
            # Check if vector store is initialized
            if not self.vector_store:
                print("Error: Vector store not initialized")
                return []
                
            # Check if we have any documents
            if len(self.vector_store.docstore._dict) == 0:
                print("Vector store is empty, adding initial papers...")
                self.initialize_papers()
                if len(self.vector_store.docstore._dict) == 0:
                    print("Error: Failed to add initial papers")
                    return []
            
            # Construct query from top features
            query = self._construct_feature_query()
            print(f"Searching with query: {query}")
            
            # Perform similarity search
            results = self.vector_store.similarity_search_with_score(
                query,
                k=top_k * 2  # Get more results initially for filtering
            )
            print(f"Found {len(results)} initial results")
            
            # Filter by relevance score and text quality
            filtered_chunks = []
            for doc, score in results:
                # Convert FAISS distance score to similarity score (0-1 range)
                similarity_score = 1 / (1 + score)  # Convert distance to similarity
                print(f"Document distance: {score}, similarity: {similarity_score}")
                
                if similarity_score >= min_score and self.is_structured_text(doc.page_content):
                    filtered_chunks.append((doc, similarity_score))
                    print(f"Added document with similarity {similarity_score}")
            
            print(f"Filtered to {len(filtered_chunks)} chunks")
            
            # Sort by similarity score and return top k
            filtered_chunks.sort(key=lambda x: x[1], reverse=True)
            return [doc for doc, _ in filtered_chunks[:top_k]]
            
        except Exception as e:
            print(f"Error retrieving relevant chunks: {e}")
            import traceback
            traceback.print_exc()
            return []

def generate_rag_response(query: str, context: str) -> str:
    """Generate a response using RAG with the given query and context"""
    
    # Create the prompt template
    template = """
    You are a medical AI assistant specializing in fetal health and CTG analysis.
    Use the following context to answer the question. If you cannot answer the question 
    based on the context, say so. Do not make up information.

    Context:
    {context}

    Question: {query}

    Answer:
    """
    
    # Create prompt template
    prompt = PromptTemplate.from_template(template)
    
    # Initialize OpenAI model
    llm = ChatOpenAI(
        model="gpt-4-turbo-preview",
        temperature=0.5,
        max_tokens=1000,
        api_key=OPENAI_API_KEY
    )
    
    # Create and run the chain
    chain: Runnable = prompt | llm
    
    # Generate response
    response = chain.invoke({"query": query, "context": context})
    
    return response.content

if __name__ == "__main__":
    rag = PaperRAG()
    # papers = rag.get_relevant_papers_old("fetal heart rate variability analysis")
    # print(json.dumps(papers, indent=2)) 