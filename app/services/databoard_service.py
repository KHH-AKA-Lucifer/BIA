import pandas as pd

df = pd.read_csv("app/data/vending_machine_sales.csv")

df["TransDate"] = pd.to_datetime(df["TransDate"])

def revenue_by_category():

    result = (
        df.groupby("Category")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
    )

    return{
        "labels": result.index.tolist(),
        "values": result.values.tolist()
    }


def weekly_profit():

    weekly = (
        df.groupby(df["TransDate"].dt.day_name())["LineTotal"]
        .sum()
    )

    order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    return {
        "labels": order,
        "values": weekly.values.tolist()
    }

def top_locations():

    result = (
        df.groupby("Location")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(5)
    )

    return result.to_dict()

def avg_revenue_machine():

    result = (
        df.groupby("Device ID")["LineTotal"]
        .sum()
        .mean()
    )

    return result

def machine_utilization():

    result = (
        df.groupby("Device ID")["Transaction"]
        .count()
    )

    result = result / result.max() * 100

    return result.to_dict()

def critical_alerts():

    alerts = []

    low_sales = df.groupby("Device ID")["LineTotal"].sum()

    for machine, value in low_sales.items():
        if value < low_sales.mean() * 0.5:
            alerts.append(f"{machine} low sales detected")

    return alerts

machine_coordinates = {
    "Student Union": (14.0715,100.6073),
    "Library Lobby": (14.0731,100.6089),
    "Cafe Area": (14.0692,100.6062),
    "Admin Block": (14.0708,100.6091)
}

def machine_map():

    locations = df["Location"].unique()

    result = []

    for loc in locations:
        lat, lon = machine_coordinates.get(loc, (14.07,100.60))

        result.append({
            "location": loc,
            "lat": lat,
            "lon": lon
        })

    return result