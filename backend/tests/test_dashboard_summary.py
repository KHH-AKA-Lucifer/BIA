from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient

from app.main import app
from app.services.databoard_service import (
    DF,
    _period_bounds,
    available_range,
    category_rankings,
    filtered_dataframe,
    hourly_demand,
    kpis,
    location_rankings,
    product_rankings,
    subcategory_rankings,
    weekday_demand,
)


class DashboardSummaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_dataset_extends_to_target_date_with_hourly_variation(self) -> None:
        self.assertFalse(DF.empty)
        self.assertEqual(DF["TransDate"].max().strftime("%Y-%m-%d"), "2026-04-15")
        self.assertGreater(DF["TransDate"].dt.hour.nunique(), 1)
        self.assertGreaterEqual(DF["Device ID"].nunique(), 50)
        self.assertGreaterEqual(DF["Location"].nunique(), 30)
        self.assertGreaterEqual(DF["Product"].nunique(), 100)
        self.assertGreaterEqual(DF["Category"].nunique(), 3)
        self.assertIn("Subcategory", DF.columns)
        self.assertNotIn("Unknown", set(DF["Category"].unique()))

    def test_year_period_uses_full_available_history(self) -> None:
        available_start, available_end = available_range()
        year_start, year_end = _period_bounds("year")

        self.assertEqual(year_start.normalize(), available_start.normalize())
        self.assertEqual(year_end.normalize(), available_end.normalize())

    def test_top_kpis_match_rankings(self) -> None:
        frame = filtered_dataframe("year")
        summary_kpis = kpis(frame)
        locations = location_rankings(frame)
        categories = category_rankings(frame)
        subcategories = subcategory_rankings(frame)
        products = product_rankings(frame)

        self.assertEqual(summary_kpis["top_location"]["name"], locations[0]["name"])
        self.assertEqual(summary_kpis["top_category"]["name"], categories[0]["name"])
        self.assertEqual(summary_kpis["top_subcategory"]["name"], subcategories[0]["name"])
        self.assertEqual(summary_kpis["top_product"]["name"], products[0]["name"])

    def test_rankings_are_sorted_descending(self) -> None:
        frame = filtered_dataframe("year")
        locations = location_rankings(frame)
        categories = category_rankings(frame)
        products = product_rankings(frame)

        self.assertEqual(
            [item["revenue"] for item in locations],
            sorted((item["revenue"] for item in locations), reverse=True),
        )
        self.assertEqual(
            [item["revenue"] for item in categories],
            sorted((item["revenue"] for item in categories), reverse=True),
        )
        self.assertEqual(
            [item["revenue"] for item in products],
            sorted((item["revenue"] for item in products), reverse=True),
        )

    def test_hourly_series_is_timestamp_backed(self) -> None:
        frame = filtered_dataframe("month")
        series = hourly_demand(frame)
        weekday_series = weekday_demand(frame)

        self.assertEqual(len(series), 24)
        self.assertEqual(sum(point["transactions"] for point in series), int(frame["Transaction"].count()))
        self.assertGreater(sum(point["transactions"] for point in series if point["hour"] >= 6), 0)
        self.assertEqual(len(weekday_series), 7)

    def test_summary_endpoint_returns_question_ready_payload(self) -> None:
        response = self.client.get("/api/v1/dashboard/summary", params={"period": "year"})
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["period"], "year")
        self.assertEqual(body["available_range"]["end"], "2026-04-15")
        self.assertEqual(body["filtered_range"]["start"], body["available_range"]["start"])
        self.assertEqual(body["kpis"]["top_location"]["name"], body["location_rankings"][0]["name"])
        self.assertEqual(body["kpis"]["top_category"]["name"], body["category_rankings"][0]["name"])
        self.assertEqual(body["kpis"]["top_subcategory"]["name"], body["subcategory_rankings"][0]["name"])
        self.assertEqual(body["kpis"]["top_product"]["name"], body["product_rankings"][0]["name"])
        self.assertEqual(len(body["hourly_demand"]), 24)
        self.assertEqual(len(body["weekday_demand"]), 7)
        self.assertGreaterEqual(len(body["location_map"]), 10)
        self.assertGreaterEqual(len(body["restock_priority"]), 5)
        self.assertGreaterEqual(len(body["action_items"]), 3)

    def test_models_endpoint_returns_trained_registry(self) -> None:
        response = self.client.get("/api/v1/dashboard/models")
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(body), 6)
        self.assertIn("forecasting", {item["task_type"] for item in body})
        self.assertIn("classification", {item["task_type"] for item in body})
        self.assertIn("clustering", {item["task_type"] for item in body})

    def test_chat_endpoint_uses_model_registry_route(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "What trained models are available?", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "model_registry")
        self.assertEqual(body["mode"], "local_model")
        self.assertTrue(body["structured_data"])

    def test_chat_endpoint_uses_local_forecast_route(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "Predict next 7 days revenue for the network", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "forecast_network")
        self.assertEqual(body["mode"], "local_model")
        self.assertEqual(body["structured_data"]["scope"], "network")
        self.assertGreater(body["structured_data"]["next_7d_revenue"], 0)


if __name__ == "__main__":
    unittest.main()
