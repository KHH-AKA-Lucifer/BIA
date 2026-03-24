from pathlib import Path

import pandas as pd

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "vending_machine_sales.csv"
DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]
DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MACHINE_COORDINATES = {
    "Student Union": (14.0715, 100.6073),
    "Library Lobby": (14.0731, 100.6089),
    "Cafe Area": (14.0692, 100.6062),
    "Admin Block": (14.0708, 100.6091),
}

df = pd.read_csv(DATA_PATH)
df["TransDate"] = pd.to_datetime(df["TransDate"])


def revenue_by_category() -> dict[str, list[str] | list[float]]:
    result = df.groupby("Category")["LineTotal"].sum().sort_values(ascending=False)

    return {
        "labels": result.index.tolist(),
        "values": [float(value) for value in result.to_list()],
    }


def weekly_profit() -> dict[str, list[str] | list[float]]:
    weekly = (
        df.groupby(df["TransDate"].dt.day_name())["LineTotal"]
        .sum()
        .reindex(DAY_ORDER, fill_value=0.0)
    )

    return {
        "labels": DAY_LABELS,
        "values": [float(value) for value in weekly.to_list()],
    }


def top_locations() -> dict[str, float]:
    result = (
        df.groupby("Location")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(5)
    )

    return {str(location): float(value) for location, value in result.items()}


def avg_revenue_machine() -> float:
    result = df.groupby("Device ID")["LineTotal"].sum().mean()
    return float(result)


def machine_utilization() -> dict[str, float]:
    result = df.groupby("Device ID")["Transaction"].count()
    result = result / result.max() * 100

    return {str(machine): float(value) for machine, value in result.items()}


def critical_alerts() -> list[str]:
    alerts: list[str] = []
    low_sales = df.groupby("Device ID")["LineTotal"].sum()
    threshold = low_sales.mean() * 0.5

    for machine, value in low_sales.items():
        if value < threshold:
            alerts.append(f"{machine} low sales detected")

    return alerts


def machine_map() -> list[dict[str, str | float]]:
    locations = df["Location"].unique()
    result: list[dict[str, str | float]] = []

    for loc in locations:
        lat, lon = MACHINE_COORDINATES.get(loc, (14.07, 100.60))
        result.append(
            {
                "location": str(loc),
                "lat": float(lat),
                "lon": float(lon),
            }
        )

    return result
