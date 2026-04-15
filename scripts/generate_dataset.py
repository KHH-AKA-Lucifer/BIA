from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd


BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.taxonomy import enrich_product_taxonomy


DEFAULT_INPUT = "backend/app/data/vending_machine_sales.csv"
DEFAULT_OUTPUT = "backend/app/data/expanded_vending_sales.csv"
DEFAULT_END_DATE = "2026-04-15"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a richer synthetic vending dataset with full timestamps."
    )
    parser.add_argument("--input", default=DEFAULT_INPUT, help="Seed CSV path")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Generated CSV path")
    parser.add_argument(
        "--start-date",
        default=None,
        help="Start date in YYYY-MM-DD. Defaults to the minimum date in the seed CSV.",
    )
    parser.add_argument(
        "--end-date",
        default=DEFAULT_END_DATE,
        help="End date in YYYY-MM-DD. Defaults to 2026-04-15.",
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=240000,
        help="Target number of synthetic rows to generate.",
    )
    parser.add_argument(
        "--machines",
        type=int,
        default=90,
        help="Target number of machines to simulate.",
    )
    parser.add_argument(
        "--synthetic-products",
        type=int,
        default=60,
        help="Number of extra synthetic products to add to the catalog.",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    return parser.parse_args()


@dataclass(frozen=True)
class MachineProfile:
    device_id: str
    location: str
    machine: str
    weight: float
    trend: float
    weekday_bias: float
    weekend_bias: float
    anomaly_bias: float
    preferred_categories: tuple[str, ...]


def load_seed_dataframe(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    for column in ["LineTotal", "TransTotal", "RPrice", "MPrice", "RQty", "MQty", "RCoil", "MCoil"]:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")
    df["TransDate"] = pd.to_datetime(df["TransDate"], errors="coerce")
    df["Prcd Date"] = pd.to_datetime(df["Prcd Date"], errors="coerce")
    df = df.dropna(subset=["TransDate"]).copy()
    return enrich_product_taxonomy(df)


def baseline_stats(df: pd.DataFrame) -> dict[str, object]:
    trans = pd.to_datetime(df["TransDate"], errors="coerce")
    return {
        "rows": len(df),
        "unique_machines": df["Machine"].nunique(),
        "unique_locations": df["Location"].nunique(),
        "unique_products": df["Product"].nunique(),
        "categories": df["Category"].nunique(),
        "date_min": trans.min(),
        "date_max": trans.max(),
        "hourly_granularity": int(trans.dt.hour.nunique()) if not trans.empty else 0,
    }


def realistic_new_locations(existing_locations: list[str], n_new: int, rng: np.random.Generator) -> list[str]:
    place_samples = [
        "Brunswick Mall", "Woodland Plaza", "Lakeside Square", "Ridgewood Center", "Hillcrest Market",
        "Harbor Point", "Cedar Grove Mall", "Maple Valley Plaza", "Pine Ridge Center", "Oak Park Mall",
        "Sunset Strip Plaza", "Canyon Ridge Market", "Sierra View Center", "Prairie Town Mall", "Riverwalk Plaza",
        "Meadowbrook Mall", "Highland Center", "Bayview Market", "Granite Falls Plaza", "Clearwater Mall",
        "Midtown Station", "Tidewater Plaza", "Kingsway Center", "Willow Creek Mall", "Elmwood Plaza",
        "Harborview Market", "Forest Hill Center", "Stonebridge Mall", "Legacy Park", "Royal Oaks Plaza",
        "Fairway Center", "Silver Springs Mall", "Golden Gate Plaza", "Sunrise Market", "Broadway Square",
        "Eastwood Marketplace", "Westgate Center", "Northpoint Mall", "Southpointe Plaza", "Parkside Mall",
        "Union Station", "Crestview Center", "Pioneer Plaza", "Grove Street Marketplace", "Apollo Mall",
        "Beacon Hill Plaza", "Valley View Center", "Northridge Mall", "CityCentre", "Commerce Square",
        "District Station", "Market Street Plaza", "Grand Avenue Mall", "Evergreen Center", "Lakeshore Plaza",
        "Plainsview Market", "Old Town Mall", "Riverside Plaza", "Skyline Center", "Tech Corridor Mall",
        "Westfield Market", "Timesquare Plaza", "Galleria Mall",
    ]
    existing_lower = {location.lower() for location in existing_locations}
    candidates = [location for location in place_samples if location.lower() not in existing_lower]
    rng.shuffle(candidates)
    added = candidates[:n_new]

    while len(added) < n_new:
        base = rng.choice(existing_locations)
        suffix = rng.choice(["Plaza", "Market", "Center", "Mall", "Station", "Square"])
        candidate = f"{base} {suffix}"
        if candidate not in existing_locations and candidate not in added:
            added.append(candidate)

    return added


def make_machine_profiles(seed_df: pd.DataFrame, target_machines: int, rng: np.random.Generator) -> list[MachineProfile]:
    unique = seed_df[["Device ID", "Location", "Machine", "Category"]].drop_duplicates()
    by_machine = unique.groupby(["Device ID", "Location", "Machine"])["Category"].agg(lambda s: tuple(pd.Series(s).dropna().unique()))
    profiles: list[MachineProfile] = []

    for (device_id, location, machine), categories in by_machine.items():
        profiles.append(
            MachineProfile(
                device_id=device_id,
                location=location,
                machine=machine,
                weight=float(rng.uniform(0.9, 1.2)),
                trend=float(rng.uniform(-0.18, 0.2)),
                weekday_bias=float(rng.uniform(0.95, 1.08)),
                weekend_bias=float(rng.uniform(0.8, 1.25)),
                anomaly_bias=float(rng.uniform(0.01, 0.05)),
                preferred_categories=tuple(categories) if categories else ("Food",),
            )
        )

    location_names = sorted(seed_df["Location"].dropna().astype(str).unique().tolist())
    extra_locations = realistic_new_locations(location_names, max(0, target_machines - len(profiles)), rng)
    location_names.extend(extra_locations)

    categories = tuple(seed_df["Category"].dropna().astype(str).unique().tolist())

    while len(profiles) < target_machines:
        base_profile = profiles[int(rng.integers(len(profiles)))]
        location = location_names[len(profiles) % len(location_names)]
        device_id = f"VJ{900000000 + len(profiles):09d}"
        machine = f"{location} x{10000 + len(profiles)}"
        preferred = tuple(rng.choice(categories, size=min(2, len(categories)), replace=False).tolist()) or base_profile.preferred_categories
        profiles.append(
            MachineProfile(
                device_id=device_id,
                location=location,
                machine=machine,
                weight=float(rng.uniform(0.75, 1.1)),
                trend=float(rng.uniform(-0.22, 0.24)),
                weekday_bias=float(rng.uniform(0.92, 1.1)),
                weekend_bias=float(rng.uniform(0.82, 1.35)),
                anomaly_bias=float(rng.uniform(0.02, 0.07)),
                preferred_categories=preferred,
            )
        )

    weights = np.array([profile.weight for profile in profiles], dtype=float)
    weights /= weights.sum()

    normalized: list[MachineProfile] = []
    for profile, weight in zip(profiles, weights, strict=True):
        normalized.append(
            MachineProfile(
                device_id=profile.device_id,
                location=profile.location,
                machine=profile.machine,
                weight=float(weight),
                trend=profile.trend,
                weekday_bias=profile.weekday_bias,
                weekend_bias=profile.weekend_bias,
                anomaly_bias=profile.anomaly_bias,
                preferred_categories=profile.preferred_categories,
            )
        )
    return normalized


def build_product_catalog(seed_df: pd.DataFrame, synthetic_products: int, rng: np.random.Generator) -> pd.DataFrame:
    catalog = (
        seed_df[["Product", "Category", "Subcategory", "Brand", "RPrice", "MPrice", "RCoil", "MCoil", "RQty", "MQty"]]
        .drop_duplicates()
        .reset_index(drop=True)
    )
    catalog["Synthetic"] = False

    category_weights = seed_df["Category"].value_counts(normalize=True)
    stats = seed_df.groupby("Category").agg({"RPrice": "mean", "RQty": "mean", "RCoil": "mean", "MCoil": "mean"}).to_dict("index")
    flavors = ["Cherry", "Mango", "Lime", "Peach", "Berry", "Vanilla", "Sea Salt", "BBQ", "Honey", "Mocha"]
    product_bases = [
        "Sparkling Water", "Cold Brew", "Trail Mix", "Granola Bar", "Protein Bar",
        "Iced Tea", "Fruit Chips", "Energy Drink", "Pretzel Bites", "Greek Yogurt Bites",
        "Citrus Soda", "Matcha Latte", "Ginger Ale", "Chocolate Wafer", "Salted Nuts",
    ]

    synthetic_rows: list[dict[str, object]] = []
    for index in range(synthetic_products):
        category = rng.choice(category_weights.index, p=category_weights.values)
        base = stats.get(category, {"RPrice": 2.0, "RQty": 1.0, "RCoil": 120.0, "MCoil": 120.0})
        product_name = f"{rng.choice(product_bases)} - {rng.choice(flavors)} {index + 1}"
        price = round(max(0.8, rng.normal(base["RPrice"], max(base["RPrice"] * 0.12, 0.15))), 2)
        qty = int(max(1, round(rng.normal(base["RQty"], 0.35))))
        rcoil = int(max(60, round(rng.normal(base["RCoil"], 10))))
        mcoil = int(max(60, round(rng.normal(base["MCoil"], 10))))
        synthetic_rows.append(
            {
                "Product": product_name,
                "Category": category,
                "Subcategory": category,
                "Brand": product_name.split(" - ")[0],
                "RPrice": price,
                "MPrice": price,
                "RCoil": rcoil,
                "MCoil": mcoil,
                "RQty": qty,
                "MQty": qty,
                "Synthetic": True,
            }
        )

    return enrich_product_taxonomy(pd.concat([catalog, pd.DataFrame(synthetic_rows)], ignore_index=True))


def catalog_lookup(catalog: pd.DataFrame) -> tuple[list[dict[str, object]], dict[str, list[dict[str, object]]]]:
    records = catalog.to_dict("records")
    by_category: dict[str, list[dict[str, object]]] = {}
    for record in records:
        by_category.setdefault(str(record["Category"]), []).append(record)
    return records, by_category


def month_factor(month: int) -> float:
    return {
        1: 0.92,
        2: 0.95,
        3: 1.02,
        4: 1.06,
        5: 1.12,
        6: 1.08,
        7: 1.15,
        8: 1.1,
        9: 1.04,
        10: 1.0,
        11: 1.06,
        12: 1.14,
    }[month]


def weekday_factor(weekday: int) -> float:
    return [0.9, 0.98, 1.02, 1.06, 1.12, 1.22, 0.88][weekday]


def hourly_weights() -> dict[int, float]:
    return {
        6: 0.25,
        7: 0.55,
        8: 0.95,
        9: 0.9,
        10: 0.8,
        11: 0.88,
        12: 1.18,
        13: 1.05,
        14: 0.82,
        15: 0.78,
        16: 0.92,
        17: 1.08,
        18: 1.15,
        19: 0.86,
        20: 0.62,
        21: 0.42,
    }


def pick_hour(location: str, rng: np.random.Generator) -> int:
    weights = hourly_weights()
    base_hours = np.array(list(weights.keys()))
    hour_weights = np.array(list(weights.values()), dtype=float)

    if "Station" in location or "Centre" in location or "Center" in location:
        hour_weights[base_hours >= 17] *= 1.15
    if "Mall" in location or "Plaza" in location:
        hour_weights[(base_hours >= 11) & (base_hours <= 18)] *= 1.18
    if "Market" in location:
        hour_weights[(base_hours >= 8) & (base_hours <= 12)] *= 1.1

    hour_weights /= hour_weights.sum()
    return int(rng.choice(base_hours, p=hour_weights))


def transaction_timestamp(day: pd.Timestamp, location: str, rng: np.random.Generator) -> datetime:
    hour = pick_hour(location, rng)
    minute = int(rng.integers(0, 60))
    second = int(rng.integers(0, 60))
    return datetime(day.year, day.month, day.day, hour, minute, second)


def profile_demand_multiplier(profile: MachineProfile, current_day: pd.Timestamp, progress: float) -> float:
    weekend = current_day.weekday() >= 5
    weekend_factor = profile.weekend_bias if weekend else profile.weekday_bias
    long_term = 1 + (profile.trend * progress)
    return max(0.35, weekend_factor * long_term)


def sample_product(
    profile: MachineProfile,
    catalog_records: list[dict[str, object]],
    category_records: dict[str, list[dict[str, object]]],
    rng: np.random.Generator,
) -> dict[str, object]:
    preferred_pools = [category_records[category] for category in profile.preferred_categories if category in category_records]
    if preferred_pools and rng.random() < 0.68:
        pool = preferred_pools[int(rng.integers(len(preferred_pools)))]
        return pool[int(rng.integers(len(pool)))]
    return catalog_records[int(rng.integers(len(catalog_records)))]


def build_record(
    profile: MachineProfile,
    product_row: dict[str, object],
    timestamp: datetime,
    transaction_id: int,
    anomaly_multiplier: float,
    rng: np.random.Generator,
) -> dict[str, object]:
    qty = int(max(1, round(product_row.get("RQty", 1) * (1 + rng.normal(0, 0.12)))))
    price = max(0.8, float(product_row.get("RPrice", 1.5)) * (1 + rng.normal(0, 0.06)))

    if anomaly_multiplier != 1.0:
        if anomaly_multiplier > 1:
            qty = int(max(1, round(qty * min(anomaly_multiplier, 6.0))))
        else:
            price *= max(anomaly_multiplier, 0.7)

    line_total = round(qty * price, 2)
    type_choice = rng.choice(["Cash", "Credit"], p=[0.28, 0.72])

    return {
        "Status": "Processed",
        "Device ID": profile.device_id,
        "Location": profile.location,
        "Machine": profile.machine,
        "Product": str(product_row["Product"]),
        "Category": str(product_row["Category"]),
        "Subcategory": str(product_row.get("Subcategory", product_row["Category"])),
        "Brand": str(product_row.get("Brand", str(product_row["Product"]).split(" - ")[0])),
        "Transaction": transaction_id,
        "TransDate": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "Type": type_choice,
        "RCoil": int(max(1, round(float(product_row.get("RCoil", 120)) * (1 + rng.normal(0, 0.04))))),
        "RPrice": round(price, 2),
        "RQty": qty,
        "MCoil": int(max(1, round(float(product_row.get("MCoil", 120)) * (1 + rng.normal(0, 0.04))))),
        "MPrice": round(price, 2),
        "MQty": qty,
        "LineTotal": line_total,
        "TransTotal": line_total,
        "Prcd Date": (timestamp + timedelta(minutes=int(rng.integers(1, 45)))).strftime("%Y-%m-%d %H:%M:%S"),
    }


def generate_transactions(
    seed_df: pd.DataFrame,
    profiles: list[MachineProfile],
    catalog: pd.DataFrame,
    start_date: pd.Timestamp,
    end_date: pd.Timestamp,
    target_rows: int,
    rng: np.random.Generator,
) -> pd.DataFrame:
    total_days = max(1, (end_date - start_date).days + 1)
    daily_base = target_rows / total_days
    machine_weights = np.array([profile.weight for profile in profiles], dtype=float)
    start = pd.Timestamp(start_date)
    catalog_records, category_records = catalog_lookup(catalog)

    records: list[dict[str, object]] = []
    transaction_counter = 10_000_000_000

    for day in pd.date_range(start_date, end_date, freq="D"):
        progress = ((day - start).days / max(total_days - 1, 1))
        day_factor = month_factor(day.month) * weekday_factor(day.weekday())
        daily_target = max(80, int(round(daily_base * day_factor * (1 + 0.22 * progress))))
        daily_target += int(rng.integers(-8, 9))

        for _ in range(daily_target):
            profile_index = int(rng.choice(len(profiles), p=machine_weights))
            profile = profiles[profile_index]
            multiplier = profile_demand_multiplier(profile, day, progress)
            if rng.random() > min(0.98, multiplier / 1.35):
                continue

            product = sample_product(profile, catalog_records, category_records, rng)
            anomaly_multiplier = 1.0
            if rng.random() < profile.anomaly_bias:
                anomaly_multiplier = float(rng.uniform(1.6, 4.4)) if rng.random() < 0.7 else float(rng.uniform(0.75, 0.92))

            timestamp = transaction_timestamp(day, profile.location, rng)
            records.append(
                build_record(
                    profile=profile,
                    product_row=product,
                    timestamp=timestamp,
                    transaction_id=transaction_counter,
                    anomaly_multiplier=anomaly_multiplier,
                    rng=rng,
                )
            )
            transaction_counter += 1
            if len(records) >= target_rows:
                break

        if len(records) >= target_rows:
            break

    output = pd.DataFrame(records, columns=seed_df.columns.tolist())
    return output


def run() -> None:
    args = parse_args()
    rng = np.random.default_rng(args.seed)

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    seed_df = load_seed_dataframe(input_path)
    original_stats = baseline_stats(seed_df)
    print("Seed data stats:", original_stats, flush=True)

    start_date = pd.Timestamp(args.start_date) if args.start_date else pd.Timestamp(seed_df["TransDate"].min().date())
    end_date = pd.Timestamp(args.end_date)
    if end_date < start_date:
        raise ValueError("end-date must be on or after start-date")

    profiles = make_machine_profiles(seed_df, args.machines, rng)
    catalog = build_product_catalog(seed_df, args.synthetic_products, rng)
    generated = generate_transactions(
        seed_df=seed_df,
        profiles=profiles,
        catalog=catalog,
        start_date=start_date,
        end_date=end_date,
        target_rows=args.rows,
        rng=rng,
    )

    generated.to_csv(output_path, index=False)

    new_stats = baseline_stats(generated)
    new_stats["output_path"] = str(output_path)
    print("Generated data stats:", new_stats, flush=True)


if __name__ == "__main__":
    run()
