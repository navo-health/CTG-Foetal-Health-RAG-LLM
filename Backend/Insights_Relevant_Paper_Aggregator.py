import re
from datetime import datetime
from test_synthetic_with_SHAP import generate_prediction_insights
from Relevant_Paper_Fetch import get_top_feature_query, retrieve_relevant_chunks

def llm_input_aggregator(prediction_info=None, retrieved_docs=None):
    # Format prediction section
    if prediction_info is None:
        prediction_info = generate_prediction_insights()
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

    # Retrieve docs if not provided
    if retrieved_docs is None:
        top_features_query = get_top_feature_query()
        retrieved_docs = retrieve_relevant_chunks(top_features_query)

    for i, doc in enumerate(retrieved_docs, 1):
        meta = doc.metadata
        title = meta.get("title", "Unknown Title")
        subject = meta.get("subject", "")
        journal = subject.split(" 0.0")[0] if " 0.0" in subject else subject or "Unknown Journal"

        raw_date = meta.get("creationdate") or meta.get("creationDate", "")
        year = "Unknown Year"
        try:
            year = datetime.fromisoformat(raw_date[:19]).year
        except Exception:
            match = re.search(r"D:(\d{4})", raw_date)
            if match:
                year = match.group(1)

        page = meta.get("page", "N/A")
        excerpt = doc.page_content.strip()

        sources += (
            f"\nReference #{i}:\n"
            f"Title: {title}\n"
            f"Journal: {journal} ({year})\n"
            f"Page: {page}\n"
            f"Excerpt:\n{excerpt}\n"
        )

    llm_input_str = f"{insights}{sources}"
    

    return llm_input_str

if __name__ == "__main__":
    llm_input = llm_input_aggregator()
    print(llm_input)
