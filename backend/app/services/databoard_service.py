from collections.abc import Callable
from pathlib import Path
from typing import Literal

import pandas as pd

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "vending_machine_sales.csv"
Period = Literal["week", "month", "quarter"]
MACHINE_COORDINATES = {
    "Ridgewood Center Synth 57": (40.8448, -74.1141),
    "Harborview Market": (40.7128, -74.0060),
    "Earle Asphalt": (40.7489, -73.9680),
    "Plainsview Market": (40.8201, -73.5168),
    "Galleria Mall Synth 82": (40.7580, -73.9855),
    "Plainsview Market Synth 69": (40.8201, -73.5168),
    "Sunset Strip Plaza Synth 84": (34.0900, -118.4065),
    "Brunswick Sq Mall": (40.4774, -74.4225),
    "Elmwood Plaza": (42.9856, -78.7711),
    "Meadowbrook Mall Synth 67": (42.7335, -83.2740),
    "Sunset Strip Plaza": (34.0900, -118.4065),
    "Pioneer Plaza": (32.7767, -96.7970),
    "Bayview Market": (42.3314, -83.0458),
    "Broadway Square": (40.7505, -73.9972),
    "Earle Asphalt Synth 64": (40.7489, -73.9680),
    "Granite Falls Plaza": (35.8413, -81.4944),
    "Sunset Strip Plaza Synth 76": (34.0900, -118.4065),
    "Earle Asphalt Synth 85": (40.7489, -73.9680),
    "Oak Park Mall": (41.8919, -87.8243),
    "Eastwood Marketplace Synth 61": (39.9526, -75.1652),
    "Broadway Square Synth 78": (40.7505, -73.9972),
    "Maple Valley Plaza Synth 59 Synth 80": (47.4291, -122.3197),
    "Southpointe Plaza": (40.5853, -80.3844),
    "GuttenPlans": (41.5868, -87.2764),
    "Meadowbrook Mall Synth 79": (42.7335, -83.2740),
    "Stonebridge Mall": (35.2271, -80.8431),
    "Valley View Center": (32.6773, -96.8789),
    "Maple Valley Plaza": (47.4291, -122.3197),
    "EB Public Library Synth 62": (39.9526, -75.1652),
    "Kingsway Center": (43.4295, -88.7879),
    "Sunset Strip Plaza Synth 71": (34.0900, -118.4065),
    "Canyon Ridge Market": (37.3382, -121.8863),
    "Harborview Market Synth 75 Synth 81": (40.7128, -74.0060),
    "Parkside Mall Synth 60": (41.9028, -87.6233),
    "Midtown Station Synth 56": (33.7490, -84.3880),
    "Grand Avenue Mall": (43.0731, -87.9222),
    "Fairway Center Synth 70": (39.7392, -104.9903),
    "Maple Valley Plaza Synth 59": (47.4291, -122.3197),
    "Westfield Market Synth 83": (42.1015, -74.2747),
    "Highland Center": (40.7282, -73.7949),
    "CityCentre": (29.7589, -95.4677),
    "Tidewater Plaza": (36.8507, -76.2859),
    "Skyline Center": (33.7490, -84.3880),
    "Tech Corridor Mall Synth 68": (37.3382, -121.8863),
    "Silver Springs Mall": (28.5421, -81.3723),
    "Fairway Center": (39.7392, -104.9903),
    "Golden Gate Plaza": (37.7749, -122.4194),
    "Forest Hill Center Synth 65": (42.2789, -83.7534),
    "Valley View Center Synth 66": (32.6773, -96.8789),
    "EB Public Library": (39.9526, -75.1652),
    "Galleria Mall": (29.7263, -95.4507),
    "Meadowbrook Mall": (42.7335, -83.2740),
    "Skyline Center Synth 73": (33.7490, -84.3880),
    "Clearwater Mall Synth 63": (27.9657, -82.7599),
    "Harborview Market Synth 75": (40.7128, -74.0060),
    "Grand Avenue Mall Synth 58": (43.0731, -87.9222),
    "Highland Center Synth 55": (40.7282, -73.7949),
    "Royal Oaks Plaza": (42.4917, -83.1458),
    "Parkside Mall Synth 74": (41.9028, -87.6233),
    "Midtown Station Synth 56 Synth 72": (33.7490, -84.3880),
    "Eastwood Marketplace": (39.9526, -75.1652),
    "Northridge Mall": (34.2328, -118.5288),
    "Northpoint Mall": (33.7490, -84.3880),
    "Galleria Mall Synth 77": (29.7263, -95.4507),
}

df = pd.read_csv(DATA_PATH)
df["TransDate"] = pd.to_datetime(df["TransDate"], errors="coerce")
SORTED_DF = df.dropna(subset=["TransDate"]).sort_values("TransDate").copy()
DATE_INDEXED_DF = SORTED_DF.set_index("TransDate")


def _source_df(source_df: pd.DataFrame | None = None) -> pd.DataFrame:
    return SORTED_DF if source_df is None else source_df


def _period_bounds(period: Period) -> tuple[pd.Timestamp, pd.Timestamp]:
    end = DATE_INDEXED_DF.index.max().normalize()

    if period == "week":
        start = end - pd.Timedelta(days=6)
    elif period == "month":
        start = end - pd.Timedelta(days=29)
    else:
        start = end - pd.Timedelta(days=89)

    return start, end


def filtered_dataframe(period: Period) -> pd.DataFrame:
    start, end = _period_bounds(period)
    return DATE_INDEXED_DF.loc[start:end].reset_index()


def revenue_by_category(source_df: pd.DataFrame | None = None) -> dict[str, list[str] | list[float]]:
    result = (
        _source_df(source_df)
        .groupby("Category")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
    )

    return {
        "labels": result.index.tolist(),
        "values": [float(value) for value in result.to_list()],
    }


def _resampled_profit(
    source_df: pd.DataFrame,
    frequency: str,
    label_formatter: Callable[[pd.Timestamp], str],
) -> dict[str, list[str] | list[float]]:
    date_indexed = source_df.set_index("TransDate").sort_index()
    result = date_indexed["LineTotal"].resample(frequency).sum().fillna(0.0)

    return {
        "labels": [label_formatter(timestamp) for timestamp in result.index],
        "values": [float(value) for value in result.to_list()],
    }


def profit_trend(period: Period, source_df: pd.DataFrame | None = None) -> dict[str, list[str] | list[float]]:
    frame = _source_df(source_df)
    if frame.empty:
        return {"labels": [], "values": []}

    if period == "week":
        start, end = _period_bounds(period)
        result = (
            frame.set_index("TransDate")["LineTotal"]
            .resample("D")
            .sum()
            .reindex(pd.date_range(start=start, end=end, freq="D"), fill_value=0.0)
        )
        return {
            "labels": [timestamp.strftime("%a") for timestamp in result.index],
            "values": [float(value) for value in result.to_list()],
        }

    if period == "month":
        return _resampled_profit(
            frame,
            "W-SUN",
            lambda timestamp: timestamp.strftime("%b %d"),
        )

    return _resampled_profit(
        frame,
        "MS",
        lambda timestamp: timestamp.strftime("%b %Y"),
    )


def top_locations(source_df: pd.DataFrame | None = None) -> dict[str, float]:
    frame = _source_df(source_df)
    result = (
        frame.groupby("Location")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(5)
    )

    return {str(location): float(value) for location, value in result.items()}


def all_locations_revenue(source_df: pd.DataFrame | None = None) -> dict[str, float]:
    frame = _source_df(source_df)
    result = frame.groupby("Location")["LineTotal"].sum().sort_values(ascending=False)
    return {str(location): float(value) for location, value in result.items()}


def avg_revenue_machine(source_df: pd.DataFrame | None = None) -> float:
    frame = _source_df(source_df)
    result = frame.groupby("Device ID")["LineTotal"].sum().mean()
    return float(result)


def machine_utilization(source_df: pd.DataFrame | None = None) -> dict[str, float]:
    frame = _source_df(source_df)
    result = frame.groupby("Device ID")["Transaction"].count()
    if result.empty or result.max() == 0:
        return {}

    result = result / result.max() * 100

    return {str(machine): float(value) for machine, value in result.items()}


def critical_alerts(source_df: pd.DataFrame | None = None) -> list[str]:
    frame = _source_df(source_df)
    alerts: list[str] = []
    low_sales = frame.groupby("Device ID")["LineTotal"].sum()
    if low_sales.empty:
        return alerts

    threshold = low_sales.mean() * 0.5

    for machine, value in low_sales.items():
        if value < threshold:
            alerts.append(f"{machine} low sales detected")

    return alerts


def machine_map(source_df: pd.DataFrame | None = None) -> list[dict[str, str | float]]:
    frame = _source_df(source_df)
    locations = frame["Location"].dropna().unique()
    result: list[dict[str, str | float]] = []

    for loc in locations:
        lat, lon = MACHINE_COORDINATES.get(loc, (40.7128, -74.0060))
        result.append(
            {
                "location": str(loc),
                "lat": float(lat),
                "lon": float(lon),
            }
        )

    return result
