from flask import Flask, request, url_for, redirect, render_template, jsonify
import pandas as pd
import pickle
from flask_cors import CORS
from paper_rag import PaperRAG
import logging
import os
from werkzeug.utils import secure_filename
import PyPDF2
import docx
import csv
from io import StringIO
from test_synthetic_with_SHAP import generate_prediction_insights
from OBGYN_Foetal_Health_Agent import get_llm_explanation
import numpy as np
import shap
import yaml
from pathlib import Path
from train_model.model import FoetalHealthModel
from sklearn.mixture import GaussianMixture

# === Project Setup ===
project_root = Path(__file__).resolve().parent
model_path = project_root  / "train_model" / "best_random_forest.pkl"
config_path = project_root / "configs" / "selected_columns.yaml"

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Enable CORS with additional options
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],  # Add your React app's URL
        "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# File upload configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'csv', 'txt'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(file_path):
    text = ""
    with open(file_path, 'rb') as file:
        pdf_reader = PyPDF2.PdfReader(file)
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
    return text

def extract_text_from_docx(file_path):
    doc = docx.Document(file_path)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text

def extract_text_from_csv(file_path):
    text = ""
    with open(file_path, 'r', encoding='utf-8') as file:
        csv_reader = csv.reader(file)
        for row in csv_reader:
            text += " ".join(row) + "\n"
    return text

def process_uploaded_file(file):
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        try:
            # Extract text based on file type
            file_ext = filename.rsplit('.', 1)[1].lower()
            if file_ext == 'pdf':
                text = extract_text_from_pdf(file_path)
            elif file_ext in ['doc', 'docx']:
                text = extract_text_from_docx(file_path)
            elif file_ext == 'csv':
                text = extract_text_from_csv(file_path)
            elif file_ext == 'txt':
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()

            # Clean up the uploaded file
            os.remove(file_path)
            
            return text
        except Exception as e:
            logger.exception(f"Error processing file: {filename}")
            if os.path.exists(file_path):
                os.remove(file_path)
            raise e

    return None

def generate_synthetic_data(df, n_samples=100):
    # Ensure no NaNs
    df_clean = df.dropna().copy()

    # Fit GMM on the data
    gmm = GaussianMixture(n_components=5, covariance_type='full', random_state=42)
    gmm.fit(df_clean)

    # Sample synthetic data
    synthetic_data, _ = gmm.sample(n_samples)
    synthetic_df = pd.DataFrame(synthetic_data, columns=df_clean.columns)

    return synthetic_df

# === Constants ===
N_SYNTHETIC_SAMPLES = 100

# Initialize models
with open(model_path, "rb") as f:
    model = pickle.load(f)

paper_rag = PaperRAG()

# Define feature names in order
FEATURE_NAMES = [
    'baseline value', 'accelerations', 'fetal_movement',
    'uterine_contractions', 'light_decelerations', 'severe_decelerations',
    'prolongued_decelerations', 'abnormal_short_term_variability',
    'mean_value_of_short_term_variability', 'percentage_of_time_with_abnormal_long_term_variability',
    'mean_value_of_long_term_variability', 'histogram_width',
    'histogram_min', 'histogram_max', 'histogram_number_of_peaks',
    'histogram_number_of_zeroes', 'histogram_mode', 'histogram_mean',
    'histogram_median', 'histogram_variance', 'histogram_tendency'
]

@app.route('/')
def template_deploy():
    return render_template("index.html")

@app.route('/papers', methods=['GET'])
def get_papers():
    """Get all papers in the database"""
    try:
        papers = paper_rag.get_all_papers()
        return jsonify({
            'status': 'success',
            'papers': papers
        })
    except Exception as e:
        logger.exception("Error getting papers")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/papers/add', methods=['POST'])
def add_paper():
    """Add a custom paper to the database"""
    try:
        data = request.get_json()
        if not data or 'title' not in data or 'content' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Title and content are required'
            }), 400
            
        result = paper_rag.add_custom_paper(data['title'], data['content'])
        return jsonify(result)
    except Exception as e:
        logger.exception("Error adding paper")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/papers/refresh', methods=['POST'])
def refresh_papers():
    """Download new papers and add them to the database"""
    try:
        result = paper_rag.refresh_papers()
        return jsonify(result)
    except Exception as e:
        logger.exception("Error refreshing papers")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/papers/remove-duplicates', methods=['POST'])
def remove_duplicate_papers():
    """Remove duplicate papers from the database"""
    try:
        result = paper_rag.remove_duplicates()
        return jsonify(result)
    except Exception as e:
        logger.exception("Error removing duplicates")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/papers/remove/<paper_hash>', methods=['DELETE'])
def remove_paper(paper_hash):
    """Remove a specific paper from the database"""
    try:
        logger.debug(f"Attempting to remove paper with hash: {paper_hash}")
        result = paper_rag.remove_paper(paper_hash)
        logger.debug(f"Remove paper result: {result}")
        return jsonify(result)
    except Exception as e:
        logger.exception("Error removing paper")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/papers/search', methods=['GET'])
def search_papers():
    """Search papers without adding them to the database"""
    try:
        query = request.args.get('query', '')
        max_results = int(request.args.get('max_results', 10))
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        start_index = int(request.args.get('start_index', 0))
        
        papers = paper_rag.search_papers_without_adding(
            query=query,
            max_results=max_results,
            start_date=start_date,
            end_date=end_date,
            start_index=start_index
        )
        
        return jsonify({
            'status': 'success',
            'papers': papers
        })
    except Exception as e:
        logger.exception("Error searching papers")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/papers/download', methods=['POST'])
def download_papers():
    """Download papers with advanced options"""
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Query is required'
            }), 400
            
        result = paper_rag.download_papers_with_options(
            query=data['query'],
            max_results=data.get('max_results', 10),
            start_date=data.get('start_date'),
            end_date=data.get('end_date'),
            start_index=data.get('start_index', 0)
        )
        return jsonify(result)
    except Exception as e:
        logger.exception("Error downloading papers")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/papers/add-selected', methods=['POST'])
def add_selected_papers():
    """Add selected papers to the database"""
    try:
        data = request.get_json()
        if not data or 'paper_hashes' not in data or 'papers' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Paper hashes and papers data are required'
            }), 400
            
        result = paper_rag.add_selected_papers(
            paper_hashes=data['paper_hashes'],
            papers=data['papers']
        )
        return jsonify(result)
    except Exception as e:
        logger.exception("Error adding selected papers")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/papers/upload', methods=['POST'])
def upload_paper():
    """Upload a paper document and add it to the database"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'status': 'error',
                'message': 'No file provided'
            }), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'status': 'error',
                'message': 'No file selected'
            }), 400

        # Get optional title from form data
        title = request.form.get('title', file.filename)

        # Process the uploaded file
        content = process_uploaded_file(file)
        if not content:
            return jsonify({
                'status': 'error',
                'message': 'Invalid file type or empty file'
            }), 400

        # Add the paper to the database
        result = paper_rag.add_custom_paper(title, content)
        return jsonify(result)

    except Exception as e:
        logger.exception("Error uploading paper")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/predict', methods=['POST'])
def predict():
    try:

        ####################################################################################
        # Define feature names in order (matching the form input order)
        feature_names = [
            'baseline value',
            'accelerations',
            'fetal_movement',
            'uterine_contractions',
            # 'light_decelerations',
            # 'severe_decelerations',
            'prolongued_decelerations',
            'abnormal_short_term_variability',
            # 'mean_value_of_short_term_variability',
            'percentage_of_time_with_abnormal_long_term_variability',
            # 'mean_value_of_long_term_variability',
            # 'histogram_width',
            # 'histogram_min',
            'histogram_max',
            'histogram_number_of_peaks',
            # 'histogram_number_of_zeroes',
            'histogram_mode',
            # 'histogram_mean',
            # 'histogram_median',
            'histogram_variance',
            # 'histogram_tendency'
        ]
        
        # Get data from request
        if request.is_json:
            data = request.get_json()
        else:
            return jsonify({
                'error': 'Invalid request. Expected JSON format.',
            }), 400

        logger.debug(f"data: {data}")
        features = pd.DataFrame([data])
        
        # Ensure all required features are present
        for feature in feature_names:
            if feature not in features.columns:
                return jsonify({
                    'error': f'Missing feature: {feature}',
                    'message': f'Please provide a value for {feature}'
                }), 400
        
        # Reorder columns to match training data
        features = features[feature_names]
        ####################################################################################

        # === Define Paths ===
        project_root = Path(__file__).resolve().parent
        test_data_path = project_root / "data" / "test.csv"

        # Load test data and config
        df_test = pd.read_csv(test_data_path)
        with open(config_path, "r") as f:
            selected_features = yaml.safe_load(f)["selected_columns"]

        # Generate and prepare synthetic data
        synthetic_df = generate_synthetic_data(df_test, n_samples=N_SYNTHETIC_SAMPLES)
        synthetic_df_selected = synthetic_df[selected_features]
        X_test = synthetic_df_selected.drop("fetal_health", axis=1)
        y_test = synthetic_df_selected["fetal_health"]

        # Load model
        model_wrapper = FoetalHealthModel()
        model_wrapper.model = model

        # SHAP Explanation for a single sample
        explainer = shap.TreeExplainer(model)
        sample = X_test.sample(n=1, random_state=np.random.randint(0, N_SYNTHETIC_SAMPLES))
        sample = sample.reset_index(drop=True)
        logger.debug(f"Sample: {sample.to_json()}")
        logger.debug(f"Features: {features.to_json()}")
        shap_values = explainer.shap_values(sample)

        # Make prediction
        prediction = model.predict(features)[0]
        logger.debug(f"Prediction: {prediction}")
        probabilities = model.predict_proba(features)[0]
        
        # Map numerical predictions to labels
        label_map = {1: "Normal", 2: "Suspect", 3: "Pathological"}
        predicted_label = label_map[prediction]
        predicted_prob = float(max(probabilities))
        
        # Get prediction insights
        prediction_info = generate_prediction_insights(features)
        
        # Create query for paper search
        feature_query = " ".join(prediction_info["top_features"][:3])
        search_query = f"fetal health CTG {feature_query}"
        
        # Get relevant papers
        relevant_papers = paper_rag.get_relevant_papers(search_query)
        
        # Get LLM explanation
        llm_explanation = get_llm_explanation(prediction_info, relevant_papers)
        
        # Prepare response
        response = {
            'probability': f"{predicted_prob*100:.1f}%",
            'prediction': predicted_label,
            'message': llm_explanation,
            'relevant_papers': relevant_papers
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in prediction: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Prediction failed',
            'message': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for frontend to verify backend connectivity"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
