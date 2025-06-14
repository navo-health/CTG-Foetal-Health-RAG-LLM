import chromadb
from chromadb.config import Settings
from test_synthetic_with_SHAP import generate_prediction_insights

def get_top_feature_query():
    """Generate a search query based on top features from the model's prediction"""
    insights = generate_prediction_insights()
    top_features = insights["top_features"]
    
    # Create a query focusing on the top features
    query = " AND ".join(top_features[:3])  # Use top 3 features
    return f"fetal health cardiotocography {query}"

def retrieve_relevant_chunks(query, n_results=5):
    """
    Retrieve relevant chunks from the paper database using chromadb
    
    Args:
        query (str): Search query
        n_results (int): Number of results to return
        
    Returns:
        list: List of Document objects with page_content and metadata
    """
    # Initialize Chroma client
    client = chromadb.Client(Settings(
        chroma_db_impl="duckdb+parquet",
        persist_directory="Backend/papers_db"
    ))
    
    # Get the collection
    collection = client.get_collection("fetal_health_papers")
    
    # Query the collection
    results = collection.query(
        query_texts=[query],
        n_results=n_results,
        include=["documents", "metadatas"]
    )
    
    # Convert results to Document objects
    documents = []
    for doc, metadata in zip(results['documents'][0], results['metadatas'][0]):
        documents.append(Document(page_content=doc, metadata=metadata))
    
    return documents

class Document:
    """Simple document class to match the expected interface"""
    def __init__(self, page_content, metadata):
        self.page_content = page_content
        self.metadata = metadata 