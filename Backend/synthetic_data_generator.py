import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.utils import resample

def generate_synthetic_data(real_data, n_synthetic_samples=1000):
    """
    Generate synthetic CTG data using bootstrap resampling and Gaussian noise
    
    Args:
        real_data (pd.DataFrame): Real CTG data
        n_synthetic_samples (int): Number of synthetic samples to generate
        
    Returns:
        pd.DataFrame: Synthetic CTG data
    """
    # Separate features and target
    X = real_data.drop('NSP', axis=1)
    y = real_data['NSP']
    
    # Scale the features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    X_scaled = pd.DataFrame(X_scaled, columns=X.columns)
    
    # Add noise to create synthetic samples
    synthetic_samples = []
    
    for class_label in y.unique():
        # Get samples for this class
        class_indices = y == class_label
        X_class = X_scaled[class_indices]
        
        # Calculate number of samples to generate for this class
        n_samples = int(n_synthetic_samples * (sum(class_indices) / len(y)))
        
        # Generate synthetic samples using bootstrap resampling with noise
        X_synthetic = resample(X_class, 
                             n_samples=n_samples,
                             replace=True,
                             random_state=42)
        
        # Add random noise
        noise = np.random.normal(0, 0.1, X_synthetic.shape)
        X_synthetic = X_synthetic + noise
        
        # Create synthetic labels
        y_synthetic = pd.Series([class_label] * n_samples)
        
        # Combine features and label
        synthetic_class = pd.concat([pd.DataFrame(X_synthetic, columns=X.columns),
                                   pd.Series(y_synthetic, name='NSP')], axis=1)
        
        synthetic_samples.append(synthetic_class)
    
    # Combine all synthetic samples
    synthetic_data = pd.concat(synthetic_samples, axis=0)
    
    # Inverse transform the features
    synthetic_features = pd.DataFrame(
        scaler.inverse_transform(synthetic_data.drop('NSP', axis=1)),
        columns=X.columns
    )
    
    # Return final synthetic dataset
    return pd.concat([synthetic_features, 
                     synthetic_data['NSP'].reset_index(drop=True)], axis=1)
