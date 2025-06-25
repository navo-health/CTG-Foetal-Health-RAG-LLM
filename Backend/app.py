from flask import Flask, request, url_for, redirect, render_template, jsonify
import pandas as pd
import pickle
from flask_cors import CORS
from paper_rag import paperRag
import logging
import os
from werkzeug.utils import secure_filename
import PyPDF2
import docx
import csv
from io import StringIO
from paper_aggregator import llm_input_aggregator
import numpy as np
import shap
import yaml
from pathlib import Path
from train_model.model import FoetalHealthModel
from sklearn.mixture import GaussianMixture
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from PyPDF2.errors import PdfReadError
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from datetime import timedelta

# === Project Setup ===
project_root = Path(__file__).resolve().parent
model_path = project_root  / "train_model" / "best_random_forest.pkl"
config_path = project_root / "configs" / "selected_columns.yaml"
test_data_path = project_root / "data" / "test.csv"

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Enable CORS with additional options
CORS(app, resources={
    r"/*": {
        "origins": "*",  # Allow all origins in production
        "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# === Rate Limiting ===
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per minute"]
)

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'csv', 'txt'}
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1GB max file size
app.config['JWT_SECRET_KEY'] = 'super-secret-key'  # Change this in production!
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=4)
jwt = JWTManager(app)

# === Error Handlers ===
@app.errorhandler(413)
def handle_large_file(e):
    return jsonify({
        'status': 'error',
        'message': 'File too large. Maximum allowed size is 1GB.'
    }), 413

@app.errorhandler(429)
def handle_rate_limit(e):
    return jsonify({
        'status': 'error',
        'message': 'Rate limit exceeded. Please try again later.'
    }), 429

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(file_path):
    text = ""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
    except PdfReadError:
        raise ValueError("Invalid or corrupt PDF file.")
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
        upload_folder = os.path.join(os.path.dirname(__file__), "uploads")
        os.makedirs(upload_folder, exist_ok=True)
        file_path = os.path.join(upload_folder, filename)
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
        except ValueError as ve:
            logger.warning(f"Invalid file: {filename} - {ve}")
            if os.path.exists(file_path):
                os.remove(file_path)
            raise ve
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

paper_rag = paperRag(top_features=["feature1", "feature2", "feature3"])

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

HARDCODED_USER = 'admin'
HARDCODED_PASS = 'password123'

@app.route('/')
def template_deploy():
    return render_template("index.html")

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if username == HARDCODED_USER and password == HARDCODED_PASS:
        access_token = create_access_token(identity=username)
        return jsonify(access_token=access_token), 200
    return jsonify({'msg': 'Bad username or password'}), 401

@app.route('/papers', methods=['GET'])
@jwt_required()
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
@jwt_required()
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
@jwt_required()
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
@jwt_required()
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
@jwt_required()
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
@jwt_required()
def search_papers():
    """Search papers in the database"""
    try:
        query = request.args.get('query', '')
        if not query:
            return jsonify({
                'status': 'error',
                'message': 'Query parameter is required'
            }), 400
            
        results = paper_rag.search_papers_by_keyword(query)
        # Convert float32 to float for JSON serialization
        for result in results:
            if 'similarity' in result:
                result['similarity'] = float(result['similarity'])
        
        return jsonify({
            'status': 'success',
            'results': results
        })
    except Exception as e:
        logger.exception("Error searching papers")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/papers/download', methods=['POST'])
@jwt_required()
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
@jwt_required()
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
@jwt_required()
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
        try:
            content = process_uploaded_file(file)
        except ValueError as ve:
            return jsonify({
                'status': 'error',
                'message': str(ve)
            }), 400
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': 'Failed to process file.'
            }), 500

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
@jwt_required()
def predict():
    try:

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

        # === SHAP Synthetic Data Generation ===

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
        shap_values = explainer.shap_values(sample)

        # === SHAP Synthetic Data Generation ===

        # Make prediction
        prediction = model.predict(features)[0]
        probabilities = model.predict_proba(features)[0]
        
        # Map numerical predictions to labels
        label_map = {1: "Normal", 2: "Suspect", 3: "Pathological"}
        predicted_label = label_map[prediction]
        predicted_class = np.where(model.classes_ == prediction)[0][0]
        predicted_prob = probabilities[predicted_class]

        # Prediction Insights
        pred_class_shap = shap_values[0, :, predicted_class]
        feature_shap_pairs = list(zip(features.columns, pred_class_shap))
        sorted_features = sorted(feature_shap_pairs, key=lambda x: abs(x[1]), reverse=True)
        top_features = [f for f, _ in sorted_features[:3]]
        top_shap_values = [v for _, v in sorted_features[:3]]

        prediction_info = {
            "predicted_label": predicted_label,
            "predicted_probability": predicted_prob,
            "top_features": top_features,
            "top_shap_values": top_shap_values            
        }
        logger.debug(f"prediction_info: {prediction_info}")

        # Retrieve relevant chunks
        logger.debug(f"top_features: {top_features}")
        paper_rag.top_features = top_features
        relevant_chunks = paper_rag.retrieve_relevant_chunks(top_k=10, min_score=0.7)

        # Get prediction insights
        llm_output = llm_input_aggregator(prediction_info, relevant_chunks)
        llm_explanation = llm_output['explanation']
        
        return llm_explanation
        
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
    app.run(host='0.0.0.0', port=5000)
