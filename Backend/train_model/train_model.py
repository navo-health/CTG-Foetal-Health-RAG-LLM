import pandas as pd
from sklearn.model_selection import cross_val_score, cross_val_predict
import pickle
import yaml
from pathlib import Path
import optuna
import mlflow
from model import FoetalHealthModel
from sklearn.metrics import roc_auc_score, accuracy_score

def objective(trial, df):
    params = {
        'n_estimators': trial.suggest_int('n_estimators', 100, 1000, step=10),
        'max_depth': trial.suggest_int('max_depth', 5, 50),
        'min_samples_split': trial.suggest_int('min_samples_split', 2, 10),
        'min_samples_leaf': trial.suggest_int('min_samples_leaf', 1, 5),
        'max_features': trial.suggest_categorical('max_features', ['sqrt', 'log2', None]),
        'bootstrap': trial.suggest_categorical('bootstrap', [True, False]),
    }

    model_wrapper = FoetalHealthModel(**params)
    X, y = model_wrapper.preprocess(df)

    y_pred = cross_val_predict(model_wrapper.model, X, y, cv=3)
    y_prob = cross_val_predict(model_wrapper.model, X, y, cv=3, method='predict_proba')

    acc = accuracy_score(y, y_pred)
    f1 = cross_val_score(model_wrapper.model, X, y, cv=3, scoring='f1_weighted').mean()
    roc_auc = roc_auc_score(y, y_prob, multi_class='ovr')

    with mlflow.start_run(nested=True):
        mlflow.log_params(params)
        mlflow.log_metric("accuracy_cv", acc)
        mlflow.log_metric("f1_weighted_cv", f1)
        mlflow.log_metric("roc_auc_cv", roc_auc)

    return acc

def get_study(df, n_trials=5):
    project_root = Path(__file__).resolve().parents[1]
    tracking_dir = project_root / "mlflow_runs"
    mlflow.set_tracking_uri(tracking_dir.as_uri())

    experiment_name = "Foetal_Health_Training"
    mlflow.set_experiment(experiment_name)
    if mlflow.get_experiment_by_name(experiment_name) is None:
        mlflow.create_experiment(name=experiment_name, artifact_location=tracking_dir.as_uri())

    study = optuna.create_study(
        direction="maximize",
        study_name="Foetal_Health_Training",
        load_if_exists=True
    )

    study.optimize(lambda trial: objective(trial, df), n_trials=n_trials)

    print("\n✅ Best Hyperparameters:", study.best_params)
    print(f'🔍 View MLflow UI with:\n mlflow ui --backend-store-uri "{tracking_dir.as_uri()}"')
    return study

def train_and_save_model():
    """Train a random forest model using real CTG data and save it with pickle"""

    # === Define Paths ===
    project_root = Path(__file__).resolve().parents[1]
    train_data_path = project_root / "data" / "train.csv"
    config_path = project_root / "configs" / "selected_columns.yaml"
    artifacts_path = project_root / "model_train"

    # === Load Data & Features ===
    df = pd.read_csv(train_data_path)
    with open(config_path, "r") as f:
        selected_features = yaml.safe_load(f)["selected_columns"]
    df_selected = df[selected_features]

    # === Run Optuna Study + Final Model Training ===
    study = get_study(df_selected, n_trials=100)
    best_params = study.best_params

    # === Preprocess Only (No Scaling) ===
    final_model_wrapper = FoetalHealthModel(**best_params)
    X_final, y_final = final_model_wrapper.preprocess(df_selected)

    # === Train Model ===
    final_model_wrapper.model.fit(X_final, y_final)

    # === Save Model Only (No Scaler) ===
    model_save_path = artifacts_path / "best_random_forest.pkl"
    with open(model_save_path, "wb") as f:
        pickle.dump(final_model_wrapper.model, f, protocol=4)

    print(f"✅ Model saved to: {model_save_path}")

if __name__ == "__main__":
    train_and_save_model()
