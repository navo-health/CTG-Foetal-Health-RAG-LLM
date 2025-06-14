from imblearn.over_sampling import SMOTE
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, roc_auc_score

class FoetalHealthModel:
    def __init__(self, n_estimators=100, max_depth=None, min_samples_split = None,
                 min_samples_leaf = None, max_features = None, bootstrap = None, random_state=42):
        self.model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            min_samples_split = min_samples_split,
            min_samples_leaf = min_samples_leaf,
            max_features = max_features,
            bootstrap = bootstrap,
            random_state=random_state,
            n_jobs=-1
        )
        self.random_state = random_state

    def preprocess(self, df):
        # Map 'histogram_tendency' manually if still present
        if 'histogram_tendency' in df.columns:
            df['hist_tendency'] = df['histogram_tendency'].map(lambda t: 2.0 if t == 1.0 else (1.0 if t == 0.0 else 0.0))
            df.drop('histogram_tendency', axis=1, inplace=True)

        X = df.drop("fetal_health", axis=1)
        y = df["fetal_health"]

        smote = SMOTE(random_state=self.random_state)
        X_resampled, y_resampled = smote.fit_resample(X, y)

        return X_resampled, y_resampled

    def train(self, df):
        X, y = self.preprocess(df)
        self.model.fit(X, y)
        return self.model

    def evaluate(self, df):
        X = df.drop("fetal_health", axis=1)
        y_true = df["fetal_health"]
        y_pred = self.model.predict(X)

        print("Accuracy:", accuracy_score(y_true, y_pred))
        print("Classification Report:\n", classification_report(y_true, y_pred))
        print("Confusion Matrix:\n", confusion_matrix(y_true, y_pred))
        print("ROC AUC Score:", roc_auc_score(y_true, self.model.predict_proba(X), multi_class='ovr'))

    def predict(self, X_new):
        return self.model.predict(X_new)

    def predict_proba(self, X_new):
        return self.model.predict_proba(X_new)