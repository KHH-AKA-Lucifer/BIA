import argparse
import hashlib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta


def parse_args():
    parser = argparse.ArgumentParser(description='Expand vending machine sales dataset')
    parser.add_argument('--input', type=str, default='app/data/vending_machine_sales.csv', help='Input CSV path')
    parser.add_argument('--output', type=str, default='app/data/expanded_vending_sales.csv', help='Output expanded CSV path')
    parser.add_argument('--machines', type=int, default=80, help='Target number of machines (50-100)')
    parser.add_argument('--months', type=int, default=8, help='Target duration in months (6-12)')
    parser.add_argument('--rows', type=int, default=120000, help='Target number of output rows (100k+)')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility')
    return parser.parse_args()


def baseline_stats(df):
    stats = {
        'rows': len(df),
        'unique_machines': df['Machine'].nunique(),
        'unique_locations': df['Location'].nunique(),
        'categories': df['Category'].nunique(),
        'types': df['Type'].value_counts().to_dict(),
        'revenue_mean': df['LineTotal'].mean(),
        'revenue_std': df['LineTotal'].std(),
        'date_min': df['TransDate'].min(),
        'date_max': df['TransDate'].max(),
    }
    return stats


def realistic_new_locations(existing_locations, n_new, rng):
    # a set of actual-ish real world place names to draw from
    place_samples = [
        'Brunswick Mall', 'Woodland Plaza', 'Lakeside Square', 'Ridgewood Center', 'Hillcrest Market',
        'Harbor Point', 'Cedar Grove Mall', 'Maple Valley Plaza', 'Pine Ridge Center', 'Oak Park Mall',
        'Sunset Strip Plaza', 'Canyon Ridge Market', 'Sierra View Center', 'Prairie Town Mall', 'Riverwalk Plaza',
        'Meadowbrook Mall', 'Highland Center', 'Bayview Market', 'Granite Falls Plaza', 'Clearwater Mall',
        'Midtown Station', 'Tidewater Plaza', 'Kingsway Center', 'Willow Creek Mall', 'Elmwood Plaza',
        'Harborview Market', 'Forest Hill Center', 'Stonebridge Mall', 'Legacy Park', 'Royal Oaks Plaza',
        'Fairway Center', 'Silver Springs Mall', 'Golden Gate Plaza', 'Sunrise Market', 'Broadway Square',
        'Eastwood Marketplace', 'Westgate Center', 'Northpoint Mall', 'Southpointe Plaza', 'Parkside Mall',
        'Union Station', 'Crestview Center', 'Pioneer Plaza', 'Grove Street Marketplace', 'Apollo Mall',
        'Beacon Hill Plaza', 'Valley View Center', 'Northridge Mall', 'CityCentre', 'Commerce Square',
        'District Station', 'Market Street Plaza', 'Grand Avenue Mall', 'Evergreen Center', 'Lakeshore Plaza',
        'Plainsview Market', 'Old Town Mall', 'Riverside Plaza', 'Skyline Center', 'Tech Corridor Mall',
        'Westfield Market', 'Timesquare Plaza', 'Galleria Mall'
    ]
    existing_lower = {loc.lower() for loc in existing_locations}
    candidates = [loc for loc in place_samples if loc.lower() not in existing_lower]

    rng.shuffle(candidates)
    added = []

    for c in candidates:
        if len(added) >= n_new:
            break
        added.append(c)

    # as fallback in case insufficient unique candidates, generate some compound names from existing
    while len(added) < n_new:
        base = rng.choice(existing_locations)
        suffix = rng.choice(['Plaza', 'Market', 'Center', 'Mall', 'Station', 'Square'])
        candidate = f"{base} {suffix}"
        if candidate not in existing_locations and candidate not in added:
            added.append(candidate)

    return added


def make_machine_profile(df, target_machines, rng):
    unique_machines = df[['Device ID', 'Location', 'Machine']].drop_duplicates().reset_index(drop=True)
    machine_profiles = []

    # preserve original machines first
    for _, row in unique_machines.iterrows():
        machine_profiles.append({
            'Device ID': row['Device ID'],
            'Location': row['Location'],
            'Machine': row['Machine'],
            'weight': 1.0,
        })

    location_names = unique_machines['Location'].unique().tolist()

    # add realistic new locations derived from a curated list and existing ones if needed
    if len(location_names) < 20:
        new_loc_candidates = realistic_new_locations(location_names, 50, rng)
        location_names.extend(new_loc_candidates)

    # ensure we have at least 20 locations
    if len(location_names) < 20:
        extra = realistic_new_locations(location_names, 20 - len(location_names), rng)
        location_names.extend(extra)

    # generate extra locations and machines
    existing_machines = unique_machines['Machine'].tolist()
    while len(machine_profiles) < target_machines:
        # use existing location with probability, or new location
        if len(location_names) < 20 or rng.random() < 0.4:
            base_loc = rng.choice(location_names)
            new_loc = f"{base_loc} Synth {len(location_names) + 1}"
            if new_loc not in location_names:
                location_names.append(new_loc)
            loc = new_loc
        else:
            loc = rng.choice(location_names)

        base = unique_machines.sample(n=1, random_state=rng.integers(1_000_000)).iloc[0]
        new_machine = f"{loc} x{int(10000 + len(machine_profiles))}"
        new_device = f"VJ{int(900000000 + len(machine_profiles))}"

        machine_profiles.append({
            'Device ID': new_device,
            'Location': loc,
            'Machine': new_machine,
            'weight': 0.85,  # slightly lower than originals to preserve distribution
        })

    # Normalize weights
    weights = np.array([m['weight'] for m in machine_profiles], dtype=float)
    weights = weights / weights.sum()
    for i, m in enumerate(machine_profiles):
        machine_profiles[i]['weight'] = weights[i]

    return machine_profiles


def generate_date_range(start, months):
    end_date = start + timedelta(days=int(months * 30))
    return pd.date_range(start=start, end=end_date, freq='D')


def seasonal_factor(date):
    weekday = date.weekday()  # Monday=0
    weekday_factors = [0.9, 1.0, 1.05, 1.10, 1.1, 1.25, 0.85]
    month = date.month
    month_factors = [0.95, 0.95, 1.00, 1.05, 1.08, 1.12, 1.15, 1.10, 1.08, 1.03, 0.98, 0.96]
    return weekday_factors[weekday] * month_factors[month - 1]


def generate_synthetic_products(df, n_new, rng):
    categories = df['Category'].value_counts(normalize=True)
    price_stats = df.groupby('Category').agg({
        'RPrice': 'mean',
        'MPrice': 'mean',
        'RCoil': 'mean',
        'MCoil': 'mean',
        'RQty': 'mean',
        'MQty': 'mean',
    }).to_dict(orient='index')

    # Realistic product name templates to use (brand + flavour)
    placehold_products = [
        'Coca-Cola Zero Sugar', 'Pepsi Max', 'Monster Ultra', 'Red Bull Sugar-Free',
        'Arizona Green Tea', 'Naked Juice Berry', 'Kind Bar Dark Chocolate',
        'Lays Classic', 'Doritos Cool Ranch', 'Pringles Original', 'Nutri-Grain Bar',
        'Gatorade Lemon-Lime', 'Powerade Mountain Berry', 'SmartWater', 'Evian 500ml',
        'Oreo Mini', 'KitKat Chocolate', 'M&M Plain', 'Snickers Mini',
        'Quaker Oats Chewy', 'Nature Valley Oats', 'Cheetos Flamin Hot',
        'Pepsi Wild Cherry', 'Dr Pepper Cherry', 'Sprite Cranberry',
        'Mountain Dew Voltage', 'Fanta Orange', 'Minute Maid Lemonade'
    ]

    # Add more generated names with different brand patterns.
    extra_bases = ['Snapple', 'Bai', 'V8', 'Sunkist', 'Voss', 'Naked', 'Clif', 'RXBAR', 'AXIO', 'Pureleaf']
    flavors = ['Lemon', 'Grape', 'Cherry', 'Mango', 'Watermelon', 'Peach', 'Lime', 'Berry', 'Tropical', 'Citrus']
    for b in extra_bases:
        for f in flavors[:4]:
            placehold_products.append(f"{b} {f}")

    existing_products = set(df['Product'].astype(str).unique())
    real_candidates = [p for p in placehold_products if p not in existing_products]

    synthetic = []
    idx = 0
    while len(synthetic) < n_new:
        cat = rng.choice(categories.index, p=categories.values)
        base = price_stats.get(cat, None)
        if base is None:
            base = {'RPrice': 2.0, 'MPrice': 2.0, 'RCoil': 130.0, 'MCoil': 130.0, 'RQty': 1.0, 'MQty': 1.0}

        if idx < len(real_candidates):
            prod_name = real_candidates[idx]
        else:
            # fallback more random from existing with a marker not obvious
            prod_name = f"{rng.choice(list(existing_products))} Plus"

        price = float(max(0.8, rng.normal(base['RPrice'], base['RPrice'] * 0.1)))
        qty = int(max(1, round(rng.normal(base['RQty'], max(0.2, base['RQty'] * 0.1)))))
        rcoil = int(max(50, round(rng.normal(base['RCoil'], max(5, base['RCoil'] * 0.05)))))
        mcoil = int(max(50, round(rng.normal(base['MCoil'], max(5, base['MCoil'] * 0.05)))))

        synthetic.append({
            'Product': prod_name,
            'Category': cat,
            'RPrice': round(price, 2),
            'MPrice': round(price, 2),
            'RCoil': rcoil,
            'MCoil': mcoil,
            'RQty': qty,
            'MQty': qty,
            'Synthetic': False,
        })

        idx += 1

    return pd.DataFrame(synthetic)


def pick_product_row(catalog, synthetic_prob, rng):
    if 'Synthetic' in catalog.columns:
        actuals = catalog[catalog['Synthetic'] == False]
        synth = catalog[catalog['Synthetic'] == True]

        if len(synth) > 0 and rng.random() < synthetic_prob:
            return synth.sample(n=1, random_state=rng.integers(1_000_000)).iloc[0]

        if len(actuals) > 0:
            return actuals.sample(n=1, random_state=rng.integers(1_000_000)).iloc[0]

    return catalog.sample(n=1, random_state=rng.integers(1_000_000)).iloc[0]


def compute_transaction_id(existing_txns, index):
    # deterministic but unique with index
    base = int(1e10) + index
    return base


def run():
    args = parse_args()
    np.random.seed(args.seed)
    rng = np.random.default_rng(args.seed)

    df = pd.read_csv(args.input)

    # ensure types for numeric and date
    for col in ['LineTotal', 'TransTotal', 'RPrice', 'MPrice', 'RQty', 'MQty', 'RCoil', 'MCoil']:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    df['TransDate'] = pd.to_datetime(df['TransDate'], errors='coerce', infer_datetime_format=True)
    df['Prcd Date'] = pd.to_datetime(df['Prcd Date'], errors='coerce', infer_datetime_format=True)

    # basic quality assurance
    original_stats = baseline_stats(df)
    print('Original data stats:', original_stats)

    machine_profiles = make_machine_profile(df, args.machines, rng)

    date_start = df['TransDate'].min()
    date_range = generate_date_range(date_start, args.months)

    target_rows = max(args.rows, 100000)
    target_days = max(1, len(date_range))
    base_per_day = target_rows / target_days

    rows = []
    txn_index = 0

    machine_weights = np.array([m['weight'] for m in machine_profiles], dtype=float)

    # optional location-based variation distribution
    location_mapping = {m['Machine']: m['Location'] for m in machine_profiles}

    # Pre-derive product catalog from original data and add synthetic products
    products = df[['Product', 'Category', 'RPrice', 'MPrice', 'RCoil', 'MCoil', 'RQty', 'MQty']].drop_duplicates().reset_index(drop=True)
    products['Synthetic'] = False

    extra = generate_synthetic_products(df, 50, rng)  # add 40-50 synthetic products, default 50
    product_catalog = pd.concat([products, extra], ignore_index=True)

    # Column order preservation
    columns = df.columns.tolist()

    for date in date_range:
        day_factor = seasonal_factor(date)
        num_for_day = max(1, int(round(base_per_day * day_factor)))

        # small random jitter
        jitter = rng.integers(-5, 6)
        num_for_day = max(1, num_for_day + jitter)

        for _ in range(num_for_day):
            src = pick_product_row(product_catalog, synthetic_prob=0.35, rng=rng)
            machine_choice = rng.choice(len(machine_profiles), p=machine_weights)
            machine_profile = machine_profiles[machine_choice]

            product_row = src

            # choose payment type by original proportions
            type_choice = rng.choice(df['Type'].unique(), p=df['Type'].value_counts(normalize=True).loc[df['Type'].unique()].values)

            # produce line-level quantity and price fluctuations while preserving non-negative
            qty = int(max(1, round(product_row.get('RQty', 1) * (1 + rng.normal(0, 0.08)))))
            price = round(max(0.75, product_row.get('RPrice', 1.0) * (1 + rng.normal(0, 0.05))), 2)

            # inject realistic noise / outliers (about 3% of transactions)
            if rng.random() < 0.03:
                if rng.random() < 0.55:
                    price = round(price * (1 + rng.uniform(1.5, 3.5)), 2)  # spike price
                else:
                    qty = int(max(1, round(qty * rng.uniform(2.5, 8.0))))  # large quantity spike

            # manual state to avoid outlier from being too extreme
            price = min(price, max(0.75, product_row.get('RPrice', 1.0) * 10))
            qty = min(qty, int(max(1, product_row.get('RQty', 1) * 12)))

            line_total = round(qty * price, 2)

            # build record with same columns as input file
            rec = {
                'Status': 'Processed',
                'Device ID': machine_profile['Device ID'],
                'Location': machine_profile['Location'],
                'Machine': machine_profile['Machine'],
                'Product': product_row['Product'],
                'Category': product_row['Category'],
                'Transaction': compute_transaction_id(txn_index, txn_index),
                'TransDate': date.strftime('%-m/%-d/%Y'),
                'Type': type_choice,
                'RCoil': int(max(1, round(product_row.get('RCoil', 1) * (1 + rng.normal(0, 0.05))))),
                'RPrice': price,
                'RQty': qty,
                'MCoil': int(max(1, round(product_row.get('MCoil', 1) * (1 + rng.normal(0, 0.05))))),
                'MPrice': price,
                'MQty': qty,
                'LineTotal': line_total,
                'TransTotal': line_total,
                'Prcd Date': date.strftime('%-m/%-d/%Y'),
            }

            # preserve columns that may exist
            row = {c: rec.get(c, src.get(c, np.nan)) for c in columns}

            rows.append(row)
            txn_index += 1

            if txn_index >= target_rows:
                break

        if txn_index >= target_rows:
            break

    out_df = pd.DataFrame(rows, columns=columns)

    # ensure no nulls for required columns, fill if necessary
    for c in ['Status', 'Device ID', 'Location', 'Machine', 'Product', 'Category', 'Transaction', 'TransDate', 'Type', 'LineTotal', 'TransTotal', 'Prcd Date']:
        if c not in out_df.columns:
            continue
        if out_df[c].isna().any():
            if out_df[c].dtype.kind in 'iuf':
                out_df[c] = out_df[c].fillna(0)
            else:
                out_df[c] = out_df[c].fillna('Unknown')

    # ensure unique transaction IDs
    if out_df['Transaction'].duplicated().any():
        out_df['Transaction'] = np.arange(int(1e11), int(1e11) + len(out_df), dtype=np.int64)

    out_df.to_csv(args.output, index=False)

    new_stats = baseline_stats(out_df.assign(TransDate=pd.to_datetime(out_df['TransDate'], errors='coerce')))
    new_stats['output_path'] = args.output
    print('Expanded data stats:', new_stats)

    if new_stats['rows'] < 100000:
        print('WARNING: generated row count is < 100,000, consider increasing --rows or --months')


if __name__ == '__main__':
    run()
