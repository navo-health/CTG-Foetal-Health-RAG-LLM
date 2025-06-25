import re
from datetime import datetime
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.runnables import Runnable
from config import OPENAI_API_KEY
import os
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def llm_input_aggregator(prediction_info, retrieved_docs):
    logger.debug(f"retrieved_docs: {retrieved_docs}")
    predicted_label = prediction_info['predicted_label']
    predicted_prob = prediction_info['predicted_probability']
    top_features = prediction_info["top_features"]
    top_shap_values = prediction_info["top_shap_values"]

    insights = (
        "=== MODEL PREDICTION SUMMARY ===\n"
        f"Predicted Class: {predicted_label}\n"
        f"Predicted Probability: {predicted_prob:.2f}\n\n"
        "Top Features Contributing to Prediction:\n"
        "Feature                          SHAP Value\n"
        "-----------------------------------------\n"
    )
    for feat, shap in zip(top_features, top_shap_values):
        insights += f"{feat:<30} {shap:>10.4f}\n"

    # Format supporting literature section
    sources = "\n=== SUPPORTING ACADEMIC REFERENCES ===\n"

    for i, doc in enumerate(retrieved_docs, 1):
        meta = doc.metadata
        title = meta.get("title", "Unknown Title")
        content = doc.page_content

        # Extract year from content if available
        year = "Unknown Year"
        year_match = re.search(r"Published: (\d{4})", content)
        if year_match:
            year = year_match.group(1)

        # Extract journal from content if available
        journal = "Unknown Journal"
        journal_match = re.search(r"Journal: ([^\n]+)", content)
        if journal_match:
            journal = journal_match.group(1)

        sources += (
            f"\nReference #{i}:\n"
            f"Title: {title}\n"
            f"Journal: {journal} ({year})\n"
            f"Content:\n{content}\n"
        )

    llm_input_str = f"{insights}{sources}"
    
    # Generate clinical explanation using LLM
    explanation = generate_clinical_explanation(llm_input_str)
    
    return {
        'raw_input': llm_input_str,
        'explanation': explanation
    }

def generate_clinical_explanation(llm_input: str) -> str:
    """Generate a clinical explanation using OpenAI's model"""

    # Prompt template for clinical explanation
    template = """
    You are a clinical AI assistant trained to interpret fetal health predictions using academic literature.

    Given the following context:

    {llm_input}

    Your task is to write 1–3 concise clinical paragraphs in HTML format:

    - Summarize the model's predicted class and probability.
    - Identify the most influential SHAP features and explain whether each one supports or contradicts the model's prediction.
    - Use academic sources from the context to justify each feature's role in the prediction. For example, if "prolonged decelerations" is a negative SHAP feature, explain how the literature supports or refutes its impact on fetal health.
    - Use APA-style in-text citations when referencing evidence (e.g., Smith et al., 2020 or *Journal Title*, 2019).
    - Include a short reference list at the end using APA format.

    IMPORTANT CITATION REQUIREMENTS:
    - Do NOT fabricate, invent, or make up any citations or references
    - Only cite sources that are explicitly provided in the context above
    - Use the exact titles, authors, and publication details as they appear in the provided sources
    - If no relevant sources are provided in the context, do not include citations
    - Every citation must correspond to an actual source from the given context

    Use natural, professional clinical language. Do not include bullet points, headings, or excerpts. Only write narrative paragraphs in HTML. 

    For clarity, you must format your response with the following HTML structure:

    1. **Each clinical paragraph should be wrapped in `<p>` tags**.
    2. **Important terms or phrases** can be emphasized using `<strong>` tags.
    3. **Citations** should be placed inside `<cite>` tags to indicate they are references.
    4. **References section**: The reference list should be formatted inside a `<ul>` list, where each reference is wrapped in an `<li>` tag.

    Only include references that were actually cited from the provided context. Do not create a references section if no sources from the context were used.

    Keep the total explanation under 400 words.
    """

    # Create prompt template
    prompt = PromptTemplate.from_template(template)
    
    # Initialize OpenAI model (using GPT-4 for best results)
    llm = ChatOpenAI(
        model="gpt-4-turbo-preview",  # Using GPT-4 for high-quality medical explanations
        temperature=0.5,
        max_tokens=1000,
        api_key=OPENAI_API_KEY
    )
    
    # Create and run the chain
    chain: Runnable = prompt | llm
    
    # Generate explanation
    response = chain.invoke({"llm_input": llm_input})
    
    return response.content

if __name__ == "__main__":
    # Example usage
    test_prediction_info = {
        'predicted_label': 'Normal',
        'predicted_probability': 0.85,
        'top_features': ['baseline_value', 'accelerations', 'fetal_movement'],
        'top_shap_values': [0.3, 0.2, 0.1]
    }
    test_docs = []  # Add test documents if needed
    result = llm_input_aggregator(test_prediction_info, test_docs)
    print("\n📝 Final Explanation:")
    print(result['explanation'])
