from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class TaxonomyRule:
    category: str
    subcategory: str
    keywords: tuple[str, ...]


TAXONOMY_RULES: tuple[TaxonomyRule, ...] = (
    TaxonomyRule("Protein & Functional Snacks", "Protein Bars", ("rxbar", "fit crunch", "fitcrunch", "protein bar", "protein", "zone perfect", "kind bar", "simply protein", "nugo", "go macro", "one bar")),
    TaxonomyRule("Protein & Functional Snacks", "Keto & Low-Carb Bars", ("keto", "keto bar", "keto krisp", "genius keto", "hungry buddha")),
    TaxonomyRule("Protein & Functional Snacks", "Granola & Breakfast Bars", ("granola", "belvita", "larabar")),
    TaxonomyRule("Protein & Functional Snacks", "Fruit & Breakfast Bars", ("fig bar", "nutri-grain", "orchard bar", "fruit bar", "fruit leathers")),
    TaxonomyRule("Chips, Nuts & Savory Snacks", "Nuts & Trail Mix", ("trail mix", "nuts", "almond", "cashew", "peanut")),
    TaxonomyRule("Chips, Nuts & Savory Snacks", "Pretzels & Savory Bites", ("pretzel", "cracker", "savory", "bites")),
    TaxonomyRule("Chips, Nuts & Savory Snacks", "Chips & Crisps", ("pringles", "lays", "cheetos", "doritos", "fritos", "sunchips", "sun chips", "popchips", "pop chips", "pop corners", "ruffles", "takis", "funyuns", "chips", "crisp", "potato chip", "veggie stix", "goldfish")),
    TaxonomyRule("Chips, Nuts & Savory Snacks", "Cheese & Savory Crackers", ("cheezit", "cheez-it", "ritz bits", "white cheddar", "harvest cheddar")),
    TaxonomyRule("Cookies, Candy & Chocolate", "Chocolate Bars", ("hershey", "hersheys", "kitkat", "kinder", "milk chocolate", "dark chocolate", "chocolate")),
    TaxonomyRule("Cookies, Candy & Chocolate", "Cookies & Biscuits", ("cookie", "cookies", "lenny", "larry", "chippers", "wafer", "biscuit")),
    TaxonomyRule("Cookies, Candy & Chocolate", "Candy & Gum", ("snickers", "ice breakers", "gum", "mint")),
    TaxonomyRule("Water & Hydration", "Sparkling Water", ("sparkling water", "bubly", "seltzer")),
    TaxonomyRule("Water & Hydration", "Bottled Water", ("water", "springs", "poland spring", "smartwater", "aquafina", "dasani")),
    TaxonomyRule("Water & Hydration", "Functional Hydration", ("bodyarmor", "body armor", "voss")),
    TaxonomyRule("Ready-to-Drink Beverages", "Coffee", ("cold brew", "coffee", "mocha", "latte", "espresso")),
    TaxonomyRule("Ready-to-Drink Beverages", "Tea & Juice", ("tea", "juice", "bai", "antioxidant", "smoothie", "snapple", "naked", "v8")),
    TaxonomyRule("Energy & Performance Drinks", "Energy Drinks", ("red bull", "monster", "energy drink", "celsius")),
    TaxonomyRule("Soft Drinks", "Cola", ("coca cola", "coke", "cola", "pepsi")),
    TaxonomyRule("Soft Drinks", "Lemon-Lime & Citrus", ("sprite", "7up", "citrus", "orange soda", "fanta", "mountain dew", "sunkist", "lemonade")),
    TaxonomyRule("Soft Drinks", "Flavored Soda", ("ginger ale", "root beer", "dr pepper", "soda", "zevia")),
)


FALLBACK_CATEGORY_MAP = {
    "food": ("Protein & Functional Snacks", "Functional Snacks"),
    "carbonated": ("Soft Drinks", "Carbonated Soft Drinks"),
    "non carbonated": ("Ready-to-Drink Beverages", "Still Beverages"),
    "water": ("Water & Hydration", "Bottled Water"),
    "unknown": ("Ready-to-Drink Beverages", "Miscellaneous Beverages"),
}


def brand_from_product(product: str) -> str:
    cleaned = " ".join(product.replace("/", " ").replace("-", " ").split())
    if not cleaned:
        return "Unknown"
    tokens = cleaned.split()
    if len(tokens) >= 2 and tokens[0].lower() in {"robert", "simply", "cold", "fruit", "trail", "sparkling"}:
        return " ".join(tokens[:2]).title()
    return tokens[0].title()


def classify_product(product: str, fallback_category: str | None = None) -> tuple[str, str]:
    normalized = product.casefold()
    for rule in TAXONOMY_RULES:
        if any(keyword in normalized for keyword in rule.keywords):
            return rule.category, rule.subcategory

    fallback = FALLBACK_CATEGORY_MAP.get((fallback_category or "").strip().casefold())
    if fallback:
        return fallback
    return "Ready-to-Drink Beverages", "Miscellaneous Beverages"


def enrich_product_taxonomy(frame: pd.DataFrame) -> pd.DataFrame:
    enriched = frame.copy()
    categories: list[str] = []
    subcategories: list[str] = []
    brands: list[str] = []

    for row in enriched.itertuples(index=False):
        product = str(getattr(row, "Product", "") or "")
        fallback_category = str(getattr(row, "Category", "") or "")
        category, subcategory = classify_product(product, fallback_category)
        categories.append(category)
        subcategories.append(subcategory)
        brands.append(brand_from_product(product))

    enriched["Category"] = categories
    enriched["Subcategory"] = subcategories
    enriched["Brand"] = brands
    return enriched
