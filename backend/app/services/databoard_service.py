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


def all_locations_revenue() -> dict[str, float]:
    result = df.groupby("Location")["LineTotal"].sum().sort_values(ascending=False)
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
        lat, lon = MACHINE_COORDINATES.get(loc, (40.7128, -74.0060))
        result.append(
            {
                "location": str(loc),
                "lat": float(lat),
                "lon": float(lon),
            }
        )

    return result
