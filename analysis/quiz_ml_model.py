#!/usr/bin/env python3
"""
Simple ML model to predict quiz correctness from logged context features.
Loads data from JSON (exported from Supabase) and uses logistic regression with train/test split.

To refresh data, run:
    python -c "
import json
from supabase import create_client
# Load service role key from .env
env = {}
with open('.env') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.strip().split('=', 1)
            env[k] = v
supabase = create_client(env['VITE_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])
data = supabase.table('quiz_attempts').select('correct,question_modality,answer_modality,context').not_.is_('context', 'null').execute()
with open('analysis/quiz_attempts_data.json', 'w') as f:
    json.dump(data.data, f, indent=2)
print(f'Exported {len(data.data)} records')
"
"""

import json
import numpy as np
from pathlib import Path
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score, classification_report, confusion_matrix, roc_auc_score
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier


def load_quiz_attempts():
    """Load quiz attempts from local JSON file."""
    data_path = Path(__file__).parent / 'quiz_attempts_data.json'
    
    if not data_path.exists():
        raise FileNotFoundError(
            f"Data file not found: {data_path}\n"
            "Run the export command in the module docstring to fetch fresh data from Supabase."
        )
    
    with open(data_path) as f:
        return json.load(f)

def extract_features(attempt):
    """Extract numerical features from a quiz attempt."""
    ctx = attempt.get('context', {}) or {}
    concept = ctx.get('conceptKnowledge', {}) or {}
    user_avg = ctx.get('userAverages', {}) or {}
    distractors = ctx.get('distractors', []) or []
    
    # Core knowledge features
    answer_knowledge = concept.get('answerModality', 50)
    question_knowledge = concept.get('questionModality', 50)
    overall_knowledge = concept.get('overall', 50)
    
    # User averages
    user_char = user_avg.get('character', 60)
    user_pinyin = user_avg.get('pinyin', 60)
    user_meaning = user_avg.get('meaning', 60)
    user_audio = user_avg.get('audio', 60)
    user_avg_all = (user_char + user_pinyin + user_meaning + user_audio) / 4
    
    # Distractor features
    dist_knowledge = [d.get('knowledge', 50) for d in distractors]
    dist_avg = np.mean(dist_knowledge) if dist_knowledge else 50
    dist_max = max(dist_knowledge) if dist_knowledge else 50
    
    # Knowledge gap (target vs distractors)
    knowledge_gap = answer_knowledge - dist_avg
    
    # Days since last attempt (0 if None)
    days_since = ctx.get('daysSinceLastAttempt')
    days_since = days_since if days_since is not None else 0
    
    # Predicted correct (system's baseline prediction)
    predicted = ctx.get('predictedCorrect', 50)
    
    # Modality encoding
    modality_map = {'character': 0, 'pinyin': 1, 'meaning': 2, 'audio': 3}
    q_mod = modality_map.get(attempt.get('question_modality', 'character'), 0)
    a_mod = modality_map.get(attempt.get('answer_modality', 'character'), 0)
    
    return [
        answer_knowledge,
        question_knowledge,
        overall_knowledge,
        user_avg_all,
        dist_avg,
        dist_max,
        knowledge_gap,
        days_since,
        predicted,
        q_mod,
        a_mod,
    ]

FEATURE_NAMES = [
    'answer_knowledge',
    'question_knowledge', 
    'overall_knowledge',
    'user_avg_all',
    'distractor_avg',
    'distractor_max',
    'knowledge_gap',
    'days_since_last',
    'predicted_correct',
    'question_modality',
    'answer_modality',
]

def main():
    print(f"\n{'='*60}")
    print("QUIZ ML MODEL - Predicting Correctness from Context Features")
    print(f"{'='*60}")
    
    print("\nLoading data from JSON...")
    data = load_quiz_attempts()
    
    # Filter to only attempts with context data
    data = [d for d in data if d.get('context')]
    
    print(f"Total attempts with context: {len(data)}")
    
    if len(data) < 20:
        print("Not enough data for meaningful ML analysis. Need at least 20 samples.")
        return
    
    # Extract features and labels
    X = []
    y = []
    for attempt in data:
        features = extract_features(attempt)
        X.append(features)
        y.append(1 if attempt['correct'] else 0)
    
    X = np.array(X)
    y = np.array(y)
    
    print(f"Correct: {sum(y)} ({100*sum(y)/len(y):.1f}%)")
    print(f"Incorrect: {len(y)-sum(y)} ({100*(len(y)-sum(y))/len(y):.1f}%)")
    
    # Train/test split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nTrain set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train logistic regression WITH class balancing
    model = LogisticRegression(random_state=42, max_iter=1000, class_weight='balanced')
    model.fit(X_train_scaled, y_train)
    
    # Also train Random Forest for comparison
    rf_model = RandomForestClassifier(random_state=42, n_estimators=100, class_weight='balanced')
    rf_model.fit(X_train_scaled, y_train)
    
    # Predictions
    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:, 1]
    
    y_pred_rf = rf_model.predict(X_test_scaled)
    y_proba_rf = rf_model.predict_proba(X_test_scaled)[:, 1]
    
    # Metrics
    print(f"\n{'='*60}")
    print("RESULTS ON HELD-OUT TEST SET (Logistic Regression)")
    print(f"{'='*60}")
    
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    
    # For imbalanced classes, ROC-AUC is more informative
    try:
        roc_auc = roc_auc_score(y_test, y_proba)
    except:
        roc_auc = 0.5
    
    print(f"\nAccuracy:  {accuracy:.3f}")
    print(f"Precision: {precision:.3f}  (of predicted correct, how many were actually correct)")
    print(f"Recall:    {recall:.3f}  (of actual correct, how many did we predict)")
    print(f"F1 Score:  {f1:.3f}")
    print(f"ROC-AUC:   {roc_auc:.3f}  (ability to distinguish classes)")
    
    print(f"\n{'-'*40}")
    print("Confusion Matrix:")
    print(f"{'-'*40}")
    cm = confusion_matrix(y_test, y_pred)
    print(f"                  Predicted")
    print(f"                  Wrong  Right")
    print(f"Actual Wrong  [    {cm[0,0]:2d}    {cm[0,1]:2d}  ]")
    print(f"Actual Right  [    {cm[1,0]:2d}    {cm[1,1]:2d}  ]")
    
    print(f"\n{'-'*40}")
    print("Classification Report:")
    print(f"{'-'*40}")
    print(classification_report(y_test, y_pred, target_names=['Incorrect', 'Correct']))
    
    # Random Forest results
    print(f"\n{'='*60}")
    print("RANDOM FOREST COMPARISON")
    print(f"{'='*60}")
    rf_acc = accuracy_score(y_test, y_pred_rf)
    rf_f1 = f1_score(y_test, y_pred_rf, zero_division=0)
    try:
        rf_auc = roc_auc_score(y_test, y_proba_rf)
    except:
        rf_auc = 0.5
    print(f"Accuracy:  {rf_acc:.3f}")
    print(f"F1 Score:  {rf_f1:.3f}")
    print(f"ROC-AUC:   {rf_auc:.3f}")
    
    # Feature importance
    print(f"\n{'='*60}")
    print("FEATURE IMPORTANCE")
    print(f"{'='*60}")
    
    print("\nLogistic Regression Coefficients:")
    coefs = model.coef_[0]
    importance = sorted(zip(FEATURE_NAMES, coefs), key=lambda x: abs(x[1]), reverse=True)
    
    for name, coef in importance:
        direction = "+" if coef > 0 else "-"
        print(f"  {direction} {name:20s}: {coef:+.3f}")
    
    print("\nRandom Forest Feature Importance:")
    rf_importance = sorted(zip(FEATURE_NAMES, rf_model.feature_importances_), key=lambda x: x[1], reverse=True)
    for name, imp in rf_importance:
        bar = "█" * int(imp * 30)
        print(f"  {name:20s}: {imp:.3f} {bar}")
    
    # Baseline comparison
    majority_baseline = max(sum(y_test), len(y_test) - sum(y_test)) / len(y_test)
    print(f"\n{'='*60}")
    print("BASELINE COMPARISON")
    print(f"{'='*60}")
    print(f"Majority class baseline: {majority_baseline:.3f}")
    print(f"Model accuracy:          {accuracy:.3f}")
    print(f"Improvement:             {accuracy - majority_baseline:+.3f}")
    
    # Calibration check
    print(f"\n{'='*60}")
    print("CALIBRATION CHECK")
    print(f"{'='*60}")
    
    bins = [(0, 0.3), (0.3, 0.5), (0.5, 0.7), (0.7, 0.85), (0.85, 1.0)]
    for low, high in bins:
        mask = (y_proba >= low) & (y_proba < high)
        if mask.sum() > 0:
            actual_rate = y_test[mask].mean()
            predicted_rate = y_proba[mask].mean()
            print(f"  P({low:.1f}-{high:.1f}): {mask.sum():2d} samples, "
                  f"predicted={predicted_rate:.2f}, actual={actual_rate:.2f}")

if __name__ == "__main__":
    main()
