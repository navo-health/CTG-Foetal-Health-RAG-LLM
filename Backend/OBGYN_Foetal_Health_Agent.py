from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import Runnable
from langchain_huggingface import HuggingFaceEndpoint
from Insights_Relevant_Paper_Aggregator import llm_input_aggregator

def get_llm_explanation(prediction_info, relevant_papers):
    """
    Generate a clinical explanation for the prediction
    
    Args:
        prediction_info (dict): Dictionary containing prediction details
        relevant_papers (list): List of relevant papers with their metadata
        
    Returns:
        str: Clinical explanation of the prediction
    """
    # Extract prediction information
    predicted_label = prediction_info["predicted_label"]
    probability = prediction_info["predicted_probability"]
    top_features = prediction_info["top_features"]
    top_shap_values = prediction_info["top_shap_values"]
    
    # Create base explanation
    explanation = [
        f"Based on the CTG analysis, the fetal health status is classified as {predicted_label} ",
        f"with {probability*100:.1f}% confidence.\n\n"
    ]
    
    # Add feature importance explanation
    explanation.append("Key factors influencing this assessment:\n")
    for feature, importance in zip(top_features, top_shap_values):
        feature_name = feature.replace('_', ' ').title()
        explanation.append(f"- {feature_name}: Impact score of {abs(importance):.3f}\n")
    
    # Add recommendations based on classification
    explanation.append("\nClinical Implications:\n")
    if predicted_label == "Normal":
        explanation.append("- Continue routine monitoring\n")
        explanation.append("- No immediate interventions required\n")
        explanation.append("- Schedule next regular check-up as planned\n")
    elif predicted_label == "Suspect":
        explanation.append("- Increase monitoring frequency\n")
        explanation.append("- Consider additional diagnostic tests\n")
        explanation.append("- Prepare for possible interventions\n")
    else:  # Pathological
        explanation.append("- Immediate medical attention required\n")
        explanation.append("- Prepare for possible emergency intervention\n")
        explanation.append("- Continuous monitoring essential\n")
    
    # Add supporting research
    if relevant_papers:
        explanation.append("\nRelevant Research Findings:\n")
        for paper in relevant_papers:
            explanation.append(f"- {paper['title']}\n")
            explanation.append(f"  Published: {paper['published']}\n")
            explanation.append(f"  Key findings: {paper['abstract']}\n")
    
    return "".join(explanation) 