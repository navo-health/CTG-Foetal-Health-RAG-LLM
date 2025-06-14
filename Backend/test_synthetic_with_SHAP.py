import pandas as pd
import numpy as np
import shap
import pickle
from pathlib import Path
from train_model.model import FoetalHealthModel
from synthetic_data_generator import generate_synthetic_data

# === Constants ===
N_SYNTHETIC_SAMPLES = 100

# === Project Setup ===
project_root = Path(__file__).resolve().parent
test_data_path = project_root / "data" / "test.csv"
model_path = project_root  / "train_model" / "best_random_forest.pkl"
config_path = project_root / "configs" / "selected_columns.yaml"

def generate_prediction_insights(input_data=None):
    """
    Generate prediction insights using SHAP values
    
    Args:
        input_data (pd.DataFrame): Input data to analyze, if None will use synthetic data
        
    Returns:
        dict: Dictionary containing prediction insights
    """
    # Load model
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    
    # Generate synthetic data if no input provided
    if input_data is None:
        # Generate synthetic data
        synthetic_data = generate_synthetic_data(input_data, n_synthetic_samples=100)
        input_data = synthetic_data.drop('NSP', axis=1).iloc[0:1]
    
    # Get prediction and probability
    prediction = model.predict(input_data)[0]
    probabilities = model.predict_proba(input_data)[0]
    predicted_prob = float(max(probabilities))
    
    # Map numerical predictions to labels
    label_map = {1: "Normal", 2: "Suspect", 3: "Pathological"}
    predicted_label = label_map[prediction]
    
    try:
        # Initialize the SHAP explainer
        explainer = shap.TreeExplainer(model)
        
        # Calculate SHAP values - handle multiclass case
        shap_values = explainer.shap_values(input_data)
        
        # Get feature importance for the predicted class
        class_idx = prediction - 1  # Convert prediction (1,2,3) to index (0,1,2)
        
        # Get feature importance based on SHAP values type
        if isinstance(shap_values, list) and len(shap_values) > class_idx:
            # For multi-class output (list of arrays)
            feature_importance = np.abs(shap_values[class_idx][0])
        elif isinstance(shap_values, np.ndarray):
            # For single-class output (single array)
            feature_importance = np.abs(shap_values[0])
        else:
            raise ValueError("Unexpected SHAP values format")
        
        # Get feature names
        feature_names = input_data.columns.tolist()
        
        # Sort features by importance
        feature_importance_pairs = list(zip(feature_names, feature_importance))
        sorted_pairs = sorted(feature_importance_pairs, key=lambda x: abs(x[1]), reverse=True)
        
        # Get top features and their SHAP values
        top_features = [pair[0] for pair in sorted_pairs[:5]]
        top_shap_values = [float(pair[1]) for pair in sorted_pairs[:5]]  # Convert to float for JSON serialization
        
    except Exception as e:
        # Log the specific error for debugging
        print(f"SHAP analysis failed: {str(e)}")
        # Use feature importances from the random forest as fallback
        importances = model.feature_importances_
        feature_names = input_data.columns.tolist()
        
        # Sort features by importance
        feature_importance_pairs = list(zip(feature_names, importances))
        sorted_pairs = sorted(feature_importance_pairs, key=lambda x: abs(x[1]), reverse=True)
        
        # Get top features and their importance values
        top_features = [pair[0] for pair in sorted_pairs[:5]]
        top_shap_values = [float(pair[1]) for pair in sorted_pairs[:5]]
    
    return {
        "predicted_label": predicted_label,
        "predicted_probability": predicted_prob,
        "top_features": top_features,
        "top_shap_values": top_shap_values
    }

if __name__ == "__main__":
    insights = generate_prediction_insights()
    print("Prediction Insights:")
    print(f"Predicted Label: {insights['predicted_label']}")
    print(f"Predicted Probability: {insights['predicted_probability']:.2f}")
    print("\nTop Contributing Features:")
    for feat, val in zip(insights['top_features'], insights['top_shap_values']):
        print(f"{feat}: {val:.4f}")
