from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd

from app.core.config import settings
from app.services.taxonomy import enrich_product_taxonomy


ForecastScope = Literal["network", "location", "category", "machine"]

FORECAST_SCOPE_COLUMNS: dict[ForecastScope, str | None] = {
    "network": None,
    "location": "Location",
    "category": "Category",
    "machine": "Device ID",
}

FORECAST_FEATURES = [
    "lag_1",
    "lag_3",
    "lag_7",
    "rolling_3",
    "rolling_7",
    "rolling_14",
    "txn_lag_1",
    "txn_rolling_7",
    "dow_sin",
    "dow_cos",
    "month_sin",
    "month_cos",
    "is_weekend",
]

RISK_FEATURES = [
    "lag_1",
    "lag_7",
    "rolling_3",
    "rolling_7",
    "rolling_14",
    "txn_lag_1",
    "txn_rolling_7",
    "utilization",
    "trend_7",
    "dow_sin",
    "dow_cos",
    "is_weekend",
]

BEVERAGE_CATEGORIES = {
    "Ready-to-Drink Beverages",
    "Water & Hydration",
    "Soft Drinks",
    "Energy & Performance Drinks",
}

MODEL_FILES = {
    "forecast_network": "forecast_network_revenue.json",
    "forecast_location": "forecast_location_revenue.json",
    "forecast_category": "forecast_category_revenue.json",
    "forecast_machine": "forecast_machine_revenue.json",
    "risk_classifier": "risk_machine_classifier.json",
    "location_segments": "location_segments.json",
}


def _load_frame() -> pd.DataFrame:
    frame = pd.read_csv(settings.dataset_path)
    frame["TransDate"] = pd.to_datetime(frame["TransDate"], errors="coerce")
    frame["Prcd Date"] = pd.to_datetime(frame["Prcd Date"], errors="coerce")
    frame["LineTotal"] = pd.to_numeric(frame["LineTotal"], errors="coerce").fillna(0.0)
    frame["RQty"] = pd.to_numeric(frame["RQty"], errors="coerce").fillna(0)
    frame["RPrice"] = pd.to_numeric(frame["RPrice"], errors="coerce").fillna(0.0)
    frame["Transaction"] = pd.to_numeric(frame["Transaction"], errors="coerce").fillna(0).astype("int64")
    frame = frame.dropna(subset=["TransDate"]).sort_values("TransDate").copy()
    frame = enrich_product_taxonomy(frame)
    frame["DateOnly"] = frame["TransDate"].dt.normalize()
    frame["Weekday"] = frame["TransDate"].dt.weekday
    frame["Month"] = frame["TransDate"].dt.month
    frame["Hour"] = frame["TransDate"].dt.hour
    return frame


def _artifact_path(name: str) -> Path:
    settings.model_artifacts_path.mkdir(parents=True, exist_ok=True)
    return settings.model_artifacts_path / MODEL_FILES[name]


def _serialize(obj: object) -> object:
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, pd.Timestamp):
        return obj.strftime("%Y-%m-%d")
    raise TypeError(f"Unsupported type: {type(obj)!r}")


def _save_artifact(name: str, payload: dict[str, object]) -> None:
    payload = {**payload, "saved_at": datetime.now(timezone.utc).isoformat()}
    with _artifact_path(name).open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, default=_serialize)


def _load_artifact(name: str) -> dict[str, object] | None:
    path = _artifact_path(name)
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def _accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(y_true == y_pred))


def _precision(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    true_positive = float(np.sum((y_true == 1) & (y_pred == 1)))
    predicted_positive = float(np.sum(y_pred == 1))
    return true_positive / predicted_positive if predicted_positive else 0.0


def _recall(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    true_positive = float(np.sum((y_true == 1) & (y_pred == 1)))
    actual_positive = float(np.sum(y_true == 1))
    return true_positive / actual_positive if actual_positive else 0.0


def _fit_linear_regression(X: np.ndarray, y: np.ndarray, l2_penalty: float = 1e-4) -> tuple[float, np.ndarray]:
    X_with_bias = np.column_stack([np.ones(len(X)), X])
    regularizer = np.eye(X_with_bias.shape[1]) * l2_penalty
    regularizer[0, 0] = 0.0
    weights = np.linalg.pinv(X_with_bias.T @ X_with_bias + regularizer) @ X_with_bias.T @ y
    return float(weights[0]), weights[1:]


def _predict_linear_regression(intercept: float, coefficients: np.ndarray, X: np.ndarray) -> np.ndarray:
    return intercept + X @ coefficients


def _standardize(X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    std[std == 0] = 1.0
    return (X - mean) / std, mean, std


def _sigmoid(values: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(values, -20, 20)))


def _fit_logistic_regression(
    X: np.ndarray,
    y: np.ndarray,
    learning_rate: float = 0.08,
    steps: int = 1800,
    l2_penalty: float = 1e-4,
) -> tuple[float, np.ndarray, np.ndarray, np.ndarray]:
    X_scaled, mean, std = _standardize(X)
    weights = np.zeros(X.shape[1], dtype=float)
    bias = 0.0
    sample_count = len(X_scaled)

    for _ in range(steps):
        logits = X_scaled @ weights + bias
        predictions = _sigmoid(logits)
        error = predictions - y
        grad_w = (X_scaled.T @ error) / sample_count + l2_penalty * weights
        grad_b = float(np.mean(error))
        weights -= learning_rate * grad_w
        bias -= learning_rate * grad_b

    return bias, weights, mean, std


def _predict_logistic_regression(
    bias: float,
    weights: np.ndarray,
    mean: np.ndarray,
    std: np.ndarray,
    X: np.ndarray,
) -> np.ndarray:
    X_scaled = (X - mean) / std
    return _sigmoid(X_scaled @ weights + bias)


def _run_kmeans(X: np.ndarray, clusters: int = 4, steps: int = 40) -> tuple[np.ndarray, np.ndarray]:
    X_scaled, mean, std = _standardize(X)
    centroid_indexes = np.linspace(0, len(X_scaled) - 1, clusters, dtype=int)
    centroids = X_scaled[centroid_indexes].copy()

    for _ in range(steps):
        distances = np.linalg.norm(X_scaled[:, None, :] - centroids[None, :, :], axis=2)
        labels = distances.argmin(axis=1)
        new_centroids = centroids.copy()
        for cluster_index in range(clusters):
            mask = labels == cluster_index
            if np.any(mask):
                new_centroids[cluster_index] = X_scaled[mask].mean(axis=0)
        if np.allclose(new_centroids, centroids):
            break
        centroids = new_centroids

    return labels, (centroids * std) + mean


def _aggregate_daily(frame: pd.DataFrame, scope: ForecastScope) -> pd.DataFrame:
    entity_column = FORECAST_SCOPE_COLUMNS[scope]
    if entity_column is None:
        grouped = (
            frame.groupby("DateOnly")
            .agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"))
            .reset_index()
        )
        grouped["entity"] = "network"
    else:
        grouped = (
            frame.groupby([entity_column, "DateOnly"])
            .agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"))
            .reset_index()
            .rename(columns={entity_column: "entity"})
        )
    return grouped.sort_values(["entity", "DateOnly"]).reset_index(drop=True)


def _feature_row(group: pd.DataFrame, index: int) -> dict[str, float]:
    revenue = group["revenue"]
    transactions = group["transactions"]
    day = pd.Timestamp(group.iloc[index]["DateOnly"])
    return {
        "lag_1": float(revenue.iloc[index - 1]),
        "lag_3": float(revenue.iloc[index - 3]),
        "lag_7": float(revenue.iloc[index - 7]),
        "rolling_3": float(revenue.iloc[index - 3 : index].mean()),
        "rolling_7": float(revenue.iloc[index - 7 : index].mean()),
        "rolling_14": float(revenue.iloc[index - 14 : index].mean()),
        "txn_lag_1": float(transactions.iloc[index - 1]),
        "txn_rolling_7": float(transactions.iloc[index - 7 : index].mean()),
        "dow_sin": math.sin(2 * math.pi * day.weekday() / 7),
        "dow_cos": math.cos(2 * math.pi * day.weekday() / 7),
        "month_sin": math.sin(2 * math.pi * day.month / 12),
        "month_cos": math.cos(2 * math.pi * day.month / 12),
        "is_weekend": 1.0 if day.weekday() >= 5 else 0.0,
    }


def _build_forecast_training_frame(frame: pd.DataFrame, scope: ForecastScope) -> pd.DataFrame:
    aggregated = _aggregate_daily(frame, scope)
    rows: list[dict[str, object]] = []
    for entity, group in aggregated.groupby("entity"):
        group = group.reset_index(drop=True)
        if len(group) < 21:
            continue
        for index in range(14, len(group)):
            feature_values = _feature_row(group, index)
            rows.append(
                {
                    "entity": entity,
                    "DateOnly": group.iloc[index]["DateOnly"],
                    "target": float(group.iloc[index]["revenue"]),
                    **feature_values,
                }
            )
    return pd.DataFrame(rows)


def _split_by_time(training_frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    unique_dates = sorted(training_frame["DateOnly"].drop_duplicates())
    if len(unique_dates) < 6:
        return training_frame, training_frame
    cutoff = unique_dates[max(1, int(len(unique_dates) * 0.8)) - 1]
    train = training_frame[training_frame["DateOnly"] <= cutoff]
    test = training_frame[training_frame["DateOnly"] > cutoff]
    if test.empty:
        test = train.tail(max(1, min(len(train), 50)))
    return train, test


def train_forecast_model(scope: ForecastScope, force: bool = False) -> dict[str, object]:
    artifact_name = f"forecast_{scope}"
    if not force:
        cached = _load_artifact(artifact_name)
        if cached is not None:
            return cached

    frame = _load_frame()
    training_frame = _build_forecast_training_frame(frame, scope)
    if training_frame.empty:
        raise ValueError(f"Insufficient training data for scope {scope}")

    train, test = _split_by_time(training_frame)
    X_train = train[FORECAST_FEATURES].to_numpy(dtype=float)
    y_train = train["target"].to_numpy(dtype=float)
    X_test = test[FORECAST_FEATURES].to_numpy(dtype=float)
    y_test = test["target"].to_numpy(dtype=float)

    intercept, coefficients = _fit_linear_regression(X_train, y_train)
    predictions = np.clip(_predict_linear_regression(intercept, coefficients, X_test), 0.0, None)

    payload: dict[str, object] = {
        "model_name": f"{scope.title()} Revenue Forecaster",
        "model_type": "Linear Regression",
        "task_type": "forecasting",
        "scope": scope,
        "target": "next_day_revenue",
        "features": FORECAST_FEATURES,
        "intercept": intercept,
        "coefficients": coefficients.tolist(),
        "metrics": {
            "mae": round(_mae(y_test, predictions), 2),
            "rmse": round(_rmse(y_test, predictions), 2),
            "train_samples": int(len(train)),
            "test_samples": int(len(test)),
        },
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_artifact(artifact_name, payload)
    return payload


def _build_machine_risk_training_frame(frame: pd.DataFrame) -> pd.DataFrame:
    machine_daily = _aggregate_daily(frame, "machine")
    overall_max_transactions = machine_daily.groupby("entity")["transactions"].transform("max").replace(0, 1)
    machine_daily["utilization"] = (machine_daily["transactions"] / overall_max_transactions).clip(0.0, 1.0)
    rows: list[dict[str, object]] = []

    for entity, group in machine_daily.groupby("entity"):
        group = group.reset_index(drop=True)
        if len(group) < 25:
            continue
        revenues = group["revenue"]
        transactions = group["transactions"]
        for index in range(14, len(group) - 3):
            rolling_7 = float(revenues.iloc[index - 7 : index].mean())
            rolling_3 = float(revenues.iloc[index - 3 : index].mean())
            future_3 = float(revenues.iloc[index + 1 : index + 4].mean())
            future_txn = float(transactions.iloc[index + 1 : index + 4].mean())
            risk_label = int(future_3 < rolling_7 * 0.78 or future_txn < float(transactions.iloc[index - 7 : index].mean()) * 0.75)
            feature_values = _feature_row(group, index)
            rows.append(
                {
                    "entity": entity,
                    "DateOnly": group.iloc[index]["DateOnly"],
                    "target": risk_label,
                    "utilization": float(group.iloc[index]["utilization"]),
                    "trend_7": round((rolling_3 / rolling_7) - 1, 4) if rolling_7 else 0.0,
                    **feature_values,
                }
            )
    return pd.DataFrame(rows)


def train_risk_classifier(force: bool = False) -> dict[str, object]:
    artifact_name = "risk_classifier"
    if not force:
        cached = _load_artifact(artifact_name)
        if cached is not None:
            return cached

    frame = _load_frame()
    training_frame = _build_machine_risk_training_frame(frame)
    if training_frame.empty:
        raise ValueError("Insufficient training data for risk classifier")

    train, test = _split_by_time(training_frame)
    X_train = train[RISK_FEATURES].to_numpy(dtype=float)
    y_train = train["target"].to_numpy(dtype=float)
    X_test = test[RISK_FEATURES].to_numpy(dtype=float)
    y_test = test["target"].to_numpy(dtype=int)

    bias, weights, mean, std = _fit_logistic_regression(X_train, y_train)
    probabilities = _predict_logistic_regression(bias, weights, mean, std, X_test)
    predictions = (probabilities >= 0.5).astype(int)

    payload: dict[str, object] = {
        "model_name": "Machine Risk Classifier",
        "model_type": "Logistic Regression",
        "task_type": "classification",
        "scope": "machine",
        "target": "at_risk_next_72h",
        "features": RISK_FEATURES,
        "bias": bias,
        "weights": weights.tolist(),
        "feature_mean": mean.tolist(),
        "feature_std": std.tolist(),
        "metrics": {
            "accuracy": round(_accuracy(y_test, predictions), 3),
            "precision": round(_precision(y_test, predictions), 3),
            "recall": round(_recall(y_test, predictions), 3),
            "train_samples": int(len(train)),
            "test_samples": int(len(test)),
        },
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_artifact(artifact_name, payload)
    return payload


def train_location_segments(force: bool = False) -> dict[str, object]:
    artifact_name = "location_segments"
    if not force:
        cached = _load_artifact(artifact_name)
        if cached is not None:
            return cached

    frame = _load_frame()
    location_daily = _aggregate_daily(frame, "location")
    location_hour = frame.groupby(["Location", "Hour"])["LineTotal"].sum().reset_index()
    location_category = frame.groupby(["Location", "Category"])["LineTotal"].sum().reset_index()

    rows: list[dict[str, object]] = []
    for location, group in location_daily.groupby("entity"):
        hourly_group = location_hour[location_hour["Location"] == location]
        category_group = location_category[location_category["Location"] == location]
        total_revenue = float(group["revenue"].sum())
        if total_revenue <= 0:
            continue
        peak_hour = int(hourly_group.sort_values("LineTotal", ascending=False)["Hour"].iloc[0]) if not hourly_group.empty else 12
        beverage_share = (
            float(category_group[category_group["Category"].isin(BEVERAGE_CATEGORIES)]["LineTotal"].sum()) / total_revenue
            if not category_group.empty
            else 0.0
        )
        top_category_share = float(category_group["LineTotal"].max()) / total_revenue if not category_group.empty else 0.0
        rows.append(
            {
                "location": location,
                "avg_daily_revenue": float(group["revenue"].mean()),
                "revenue_volatility": float(group["revenue"].std(ddof=0) or 0.0),
                "avg_ticket": float(total_revenue / max(group["transactions"].sum(), 1)),
                "weekend_share": float(group[group["DateOnly"].dt.weekday >= 5]["revenue"].sum()) / total_revenue,
                "beverage_share": beverage_share,
                "top_category_share": top_category_share,
                "peak_hour": float(peak_hour),
            }
        )

    feature_frame = pd.DataFrame(rows)
    feature_names = [
        "avg_daily_revenue",
        "revenue_volatility",
        "avg_ticket",
        "weekend_share",
        "beverage_share",
        "top_category_share",
        "peak_hour",
    ]
    X = feature_frame[feature_names].to_numpy(dtype=float)
    labels, centroids = _run_kmeans(X, clusters=min(4, len(feature_frame)))

    segment_names = ["Steady Core", "Commuter Spike", "High Potential", "Low Momentum"]
    segments = []
    for row, label in zip(feature_frame.itertuples(index=False), labels, strict=True):
        segments.append(
            {
                "location": row.location,
                "segment_id": int(label),
                "segment_name": segment_names[int(label) % len(segment_names)],
                "avg_daily_revenue": round(float(row.avg_daily_revenue), 2),
                "avg_ticket": round(float(row.avg_ticket), 2),
                "weekend_share": round(float(row.weekend_share), 3),
                "peak_hour": int(round(float(row.peak_hour))),
            }
        )

    payload: dict[str, object] = {
        "model_name": "Location Segmentation",
        "model_type": "K-Means Clustering",
        "task_type": "clustering",
        "scope": "location",
        "features": feature_names,
        "centroids": centroids.tolist(),
        "segments": segments,
        "metrics": {"clusters": int(len(np.unique(labels))), "locations": int(len(feature_frame))},
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_artifact(artifact_name, payload)
    return payload


def train_all_models(force: bool = False) -> list[dict[str, object]]:
    return [
        train_forecast_model("network", force=force),
        train_forecast_model("location", force=force),
        train_forecast_model("category", force=force),
        train_forecast_model("machine", force=force),
        train_risk_classifier(force=force),
        train_location_segments(force=force),
    ]


def get_model_registry(force: bool = False) -> list[dict[str, object]]:
    return train_all_models(force=force)


def _latest_series(scope: ForecastScope, entity: str | None = None) -> pd.DataFrame:
    frame = _load_frame()
    aggregated = _aggregate_daily(frame, scope)
    if scope == "network":
        return aggregated[aggregated["entity"] == "network"].copy().reset_index(drop=True)
    if entity is None:
        raise ValueError(f"Entity is required for scope {scope}")
    entity_frame = aggregated[aggregated["entity"] == entity].copy().reset_index(drop=True)
    if entity_frame.empty:
        raise ValueError(f"No data found for {scope} '{entity}'")
    return entity_frame


def _forecast_next_value(artifact: dict[str, object], history: pd.DataFrame) -> tuple[float, pd.Timestamp]:
    if len(history) < 14:
        raise ValueError("Not enough history to forecast")
    next_date = pd.Timestamp(history["DateOnly"].iloc[-1]) + pd.Timedelta(days=1)
    synthetic_group = history.copy()
    synthetic_group.loc[len(synthetic_group)] = {
        "DateOnly": next_date,
        "revenue": float(history["revenue"].iloc[-1]),
        "transactions": float(history["transactions"].iloc[-1]),
        "entity": history["entity"].iloc[-1],
    }
    index = len(synthetic_group) - 1
    features = _feature_row(synthetic_group.reset_index(drop=True), index)
    feature_vector = np.array([[float(features[name]) for name in FORECAST_FEATURES]])
    intercept = float(artifact["intercept"])
    coefficients = np.array(artifact["coefficients"], dtype=float)
    prediction = float(np.clip(_predict_linear_regression(intercept, coefficients, feature_vector)[0], 0.0, None))
    return round(prediction, 2), next_date


def forecast_entity(scope: ForecastScope, entity: str | None = None, horizon_days: int = 7) -> dict[str, object]:
    artifact = train_forecast_model(scope)
    history = _latest_series(scope, entity=entity)
    working = history[["entity", "DateOnly", "revenue", "transactions"]].copy()
    forecast_points: list[dict[str, object]] = []

    for _ in range(max(1, min(horizon_days, 14))):
        prediction, next_date = _forecast_next_value(artifact, working)
        forecast_points.append({"date": next_date.strftime("%Y-%m-%d"), "predicted_revenue": prediction})
        working.loc[len(working)] = {
            "entity": working["entity"].iloc[-1],
            "DateOnly": next_date,
            "revenue": prediction,
            "transactions": float(max(1.0, working["transactions"].tail(7).mean())),
        }

    return {
        "scope": scope,
        "entity": entity or "network",
        "model_name": artifact["model_name"],
        "model_type": artifact["model_type"],
        "metrics": artifact["metrics"],
        "forecast": forecast_points,
        "next_day_revenue": forecast_points[0]["predicted_revenue"],
        "next_7d_revenue": round(sum(float(item["predicted_revenue"]) for item in forecast_points[:7]), 2),
    }


def _latest_machine_risk_features(frame: pd.DataFrame) -> pd.DataFrame:
    machine_daily = _aggregate_daily(frame, "machine")
    overall_max_transactions = machine_daily.groupby("entity")["transactions"].transform("max").replace(0, 1)
    machine_daily["utilization"] = (machine_daily["transactions"] / overall_max_transactions).clip(0.0, 1.0)
    rows: list[dict[str, object]] = []

    for entity, group in machine_daily.groupby("entity"):
        group = group.reset_index(drop=True)
        if len(group) < 15:
            continue
        index = len(group) - 1
        rolling_7 = float(group["revenue"].iloc[index - 7 : index].mean())
        rolling_3 = float(group["revenue"].iloc[index - 3 : index].mean())
        feature_values = _feature_row(group, index)
        rows.append(
            {
                "machine_id": entity,
                "location": str(entity),
                "DateOnly": group.iloc[index]["DateOnly"],
                "utilization": float(group.iloc[index]["utilization"]),
                "trend_7": round((rolling_3 / rolling_7) - 1, 4) if rolling_7 else 0.0,
                **feature_values,
            }
        )

    latest = pd.DataFrame(rows)
    if latest.empty:
        return latest
    machine_locations = frame.groupby("Device ID")["Location"].agg(lambda series: series.mode().iat[0] if not series.mode().empty else series.iloc[0])
    latest["location"] = latest["machine_id"].map(machine_locations).fillna("Unknown")
    return latest


def predict_machine_risk(machine_id: str | None = None, top_n: int = 10) -> dict[str, object]:
    artifact = train_risk_classifier()
    frame = _load_frame()
    latest = _latest_machine_risk_features(frame)
    if latest.empty:
        return {"model_name": artifact["model_name"], "predictions": []}

    if machine_id:
        latest = latest[latest["machine_id"] == machine_id]
        if latest.empty:
            raise ValueError(f"Machine '{machine_id}' not found")

    feature_matrix = latest[RISK_FEATURES].to_numpy(dtype=float)
    probabilities = _predict_logistic_regression(
        float(artifact["bias"]),
        np.array(artifact["weights"], dtype=float),
        np.array(artifact["feature_mean"], dtype=float),
        np.array(artifact["feature_std"], dtype=float),
        feature_matrix,
    )
    latest = latest.copy()
    latest["risk_probability"] = probabilities
    latest["risk_class"] = np.where(latest["risk_probability"] >= 0.5, "high", "moderate")
    latest = latest.sort_values("risk_probability", ascending=False)

    predictions = [
        {
            "machine_id": row.machine_id,
            "location": row.location,
            "risk_probability": round(float(row.risk_probability), 3),
            "risk_class": str(row.risk_class),
            "utilization": round(float(row.utilization) * 100, 1),
        }
        for row in latest.head(top_n).itertuples()
    ]
    return {
        "model_name": artifact["model_name"],
        "model_type": artifact["model_type"],
        "metrics": artifact["metrics"],
        "predictions": predictions,
    }


def get_location_segments() -> dict[str, object]:
    artifact = train_location_segments()
    return {
        "model_name": artifact["model_name"],
        "model_type": artifact["model_type"],
        "metrics": artifact["metrics"],
        "segments": artifact["segments"],
    }

