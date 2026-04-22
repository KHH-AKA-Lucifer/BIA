from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd


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
    category_product_bridge,
    category_subcategory_contribution,
    category_rankings,
    filtered_dataframe,
    hourly_demand,
    kpis,
    location_rankings,
    operational_bounds,
    operational_dataframe,
    product_rankings,
    product_hierarchy_matrix,
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

    def test_year_period_uses_trailing_365_day_window(self) -> None:
        available_start, available_end = available_range()
        year_start, year_end = _period_bounds("year")

        self.assertEqual(year_end.normalize(), available_end.normalize())
        expected_start = max(available_end.normalize() - pd.Timedelta(days=364), available_start.normalize())
        self.assertEqual(year_start.normalize(), expected_start.normalize())

    def test_operational_snapshot_is_latest_7_days(self) -> None:
        available_start, available_end = available_range()
        operational_start, operational_end = operational_bounds()
        frame = operational_dataframe()

        self.assertEqual(operational_end.normalize(), available_end.normalize())
        expected_start = max(available_end.normalize() - pd.Timedelta(days=6), available_start.normalize())
        self.assertEqual(operational_start.normalize(), expected_start.normalize())
        self.assertFalse(frame.empty)

    def test_top_kpis_match_rankings(self) -> None:
        frame = filtered_dataframe("year")
        summary_kpis = kpis(frame, operational_frame=operational_dataframe())
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

    def test_category_subcategory_contribution_reconciles_to_category_totals(self) -> None:
        frame = filtered_dataframe("month")
        contribution = category_subcategory_contribution(frame)
        categories = {item["name"]: item["revenue"] for item in category_rankings(frame)}

        self.assertTrue(contribution)
        for row in contribution:
            slice_sum = round(sum(float(item["revenue"]) for item in row["subcategories"]), 2)
            self.assertAlmostEqual(slice_sum, float(row["total_revenue"]), places=2)
            self.assertAlmostEqual(float(categories[row["category"]]), float(row["total_revenue"]), places=2)

    def test_category_product_bridge_explains_category_strength(self) -> None:
        frame = filtered_dataframe("month")
        bridge = category_product_bridge(frame)
        categories = {item["name"]: item["revenue"] for item in category_rankings(frame)}

        self.assertTrue(bridge)
        lead = bridge[0]
        self.assertAlmostEqual(float(categories[lead["category"]]), float(lead["total_revenue"]), places=2)
        self.assertGreater(len(lead["drivers"]), 0)
        self.assertLessEqual(sum(float(item["share_of_category"]) for item in lead["drivers"]), 100.0)
        self.assertGreaterEqual(int(lead["product_count"]), len(lead["drivers"]))

    def test_product_hierarchy_matrix_has_ranked_rows(self) -> None:
        frame = filtered_dataframe("month")
        matrix = product_hierarchy_matrix(frame)

        self.assertTrue(matrix)
        self.assertIn("category", matrix[0])
        self.assertIn("product", matrix[0])
        self.assertIn("rank_within_category", matrix[0])
        self.assertGreaterEqual(max(int(row["rank_within_category"]) for row in matrix), 3)

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
        self.assertEqual(body["analysis_range"]["end"], body["available_range"]["end"])
        self.assertEqual(body["operational_range"]["end"], body["available_range"]["end"])
        self.assertEqual(body["kpis"]["top_location"]["name"], body["location_rankings"][0]["name"])
        self.assertEqual(body["kpis"]["top_category"]["name"], body["category_rankings"][0]["name"])
        self.assertEqual(body["kpis"]["top_subcategory"]["name"], body["subcategory_rankings"][0]["name"])
        self.assertEqual(body["kpis"]["top_product"]["name"], body["product_rankings"][0]["name"])
        self.assertGreaterEqual(len(body["category_subcategory_contribution"]), 3)
        self.assertGreaterEqual(len(body["category_product_bridge"]), 3)
        self.assertGreaterEqual(len(body["product_hierarchy_matrix"]), 10)
        self.assertEqual(len(body["hourly_demand"]), 24)
        self.assertEqual(len(body["weekday_demand"]), 7)
        self.assertGreaterEqual(len(body["location_map"]), 10)
        self.assertGreaterEqual(len(body["restock_priority"]), 5)
        self.assertGreaterEqual(len(body["action_items"]), 3)

    def test_summary_endpoint_supports_location_filter(self) -> None:
        response = self.client.get(
            "/api/v1/dashboard/summary",
            params={"period": "month", "location": "Plainsview Market Synth 69"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(body["location_rankings"])
        self.assertEqual(body["location_rankings"][0]["name"], "Plainsview Market Synth 69")
        self.assertTrue(all(item["name"] == "Plainsview Market Synth 69" for item in body["location_rankings"]))

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

    def test_chat_endpoint_handles_expected_sales_tomorrow_question(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "what is the expected sales tomorrow ?", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "forecast_network")
        self.assertEqual(body["mode"], "local_model")
        self.assertGreater(body["structured_data"]["next_day_revenue"], 0)

    def test_chat_endpoint_handles_natural_best_selling_product_question(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "what is the best selling product of last 7 days ?", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "highest_selling_product")
        self.assertEqual(body["mode"], "local_analytics")
        self.assertEqual(body["data_scope"], "last_7_days")
        self.assertEqual(body["structured_data"]["metric"], "units")
        self.assertGreater(body["structured_data"]["units"], 0)
        self.assertEqual(body["request_context"]["time_grain"], "day")
        self.assertIn("Product", body["request_context"]["columns"])
        self.assertTrue(body["evidence"]["preview_rows"])

    def test_chat_endpoint_handles_natural_best_performing_location_question(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "what is the best performing location in last 24 hours ?", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "highest_performing_location")
        self.assertEqual(body["mode"], "local_analytics")
        self.assertEqual(body["data_scope"], "last_24_hours")
        self.assertEqual(body["structured_data"]["metric"], "revenue")
        self.assertGreater(body["structured_data"]["revenue"], 0)
        self.assertEqual(body["request_context"]["time_grain"], "hour")
        self.assertIn("Location", body["request_context"]["columns"])

    def test_chat_endpoint_handles_typo_and_no_space_variants(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "which machine needs assitance now", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "risk_classification")
        self.assertEqual(body["mode"], "local_model")

        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "bestselling product last7days", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "highest_selling_product")
        self.assertEqual(body["data_scope"], "last_7_days")

    def test_chat_endpoint_prioritizes_risk_over_generic_predict(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "predict machine risk for VJ900000020", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "risk_classification")
        self.assertEqual(body["mode"], "local_model")

    def test_chat_endpoint_handles_compare_categories_request(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "compare top categories this month", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "compare_category_rankings")
        self.assertEqual(body["mode"], "local_analytics")
        self.assertTrue(body["structured_data"])

    def test_chat_endpoint_returns_scoped_context_instead_of_dead_end(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "give me a quick commercial readout for the current slice", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "scoped_context_summary")
        self.assertEqual(body["mode"], "scoped_context")
        self.assertTrue(body["request_context"])
        self.assertTrue(body["evidence"]["preview_rows"])

    def test_chat_endpoint_handles_weak_products_question(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "what products are doing bad ?", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "weak_products")
        self.assertEqual(body["mode"], "local_analytics")
        self.assertTrue(body["structured_data"])

    def test_chat_endpoint_handles_location_diagnosis_question(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "why is Skyline Center Synth 73 performing so bad ?", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "location_diagnosis")
        self.assertEqual(body["mode"], "local_analytics")
        self.assertIn("drivers", body["structured_data"])

    def test_chat_endpoint_handles_new_machine_recommendation_question(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "where should we add new machines ?", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "new_machine_recommendation")
        self.assertEqual(body["mode"], "local_analytics")
        self.assertTrue(body["structured_data"])

    def test_chat_endpoint_handles_predictive_best_category_question(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "which category will do best next week?", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "forecast_best_category")
        self.assertEqual(body["mode"], "local_model")
        self.assertTrue(body["structured_data"]["ranked_predictions"])

    def test_chat_endpoint_uses_bottom_wording_for_lowest_query(self) -> None:
        response = self.client.post(
            "/api/v1/dashboard/chat",
            json={"message": "show me the lowest performing product in past 30 days", "period": "month"},
        )
        body = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["route"], "compare_product_rankings")
        self.assertIn("bottom product rankings", body["answer"])


if __name__ == "__main__":
    unittest.main()
