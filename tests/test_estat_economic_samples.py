import unittest

import pandas as pd

from scripts.update_estat_economic_samples import build_outputs, normalize


class DemandScopeEStatSampleTests(unittest.TestCase):
    def make_payload(self, periods=133):
        dates = pd.date_range("2015-01-31", periods=periods, freq="ME")
        labels = {
            "ip": "(一致)_C1生産指数(鉱工業)",
            "cpi": "(遅行)_Lg8消費者物価指数(生鮮食品を除く総合)(前年同月比)",
        }
        classes = [
            {
                "@id": "cat01",
                "CLASS": [{"@code": k, "@name": v} for k, v in labels.items()],
            },
            {
                "@id": "time",
                "CLASS": [
                    {"@code": f"t{i}", "@name": f"{d.year}年{d.month}月"}
                    for i, d in enumerate(dates)
                ],
            },
        ]
        values = []
        for i in range(periods):
            values.append({"@cat01": "ip", "@time": f"t{i}", "$": str(100 + i)})
            values.append({"@cat01": "cpi", "@time": f"t{i}", "$": str(1.0 + i * 0.01)})
        return {
            "GET_STATS_DATA": {
                "RESULT": {"STATUS": 0},
                "STATISTICAL_DATA": {
                    "CLASS_INF": {"CLASS_OBJ": classes},
                    "DATA_INF": {"VALUE": values},
                },
            }
        }

    def config(self):
        return {
            "history_months": 120,
            "variables": [
                {
                    "id": "core_cpi_yoy_pct",
                    "approved": True,
                    "source_label_contains": "(遅行)_Lg8消費者物価指数(生鮮食品を除く総合)(前年同月比)",
                    "transform": "identity",
                    "filename": "japan-core-cpi-yoy.csv",
                },
                {
                    "id": "industrial_production_yoy_pct",
                    "approved": True,
                    "source_label_contains": "(一致)_C1生産指数(鉱工業)",
                    "transform": "pct_change_12",
                    "filename": "japan-industrial-production-yoy.csv",
                },
                {
                    "id": "not_approved",
                    "approved": False,
                    "source_label_contains": "(一致)_C1生産指数(鉱工業)",
                    "transform": "identity",
                    "filename": "should-not-exist.csv",
                },
            ],
        }

    def test_outputs_are_one_variable_plus_date_and_120_months(self):
        frame = normalize(self.make_payload())
        outputs, meta = build_outputs(frame, self.config())

        self.assertEqual(set(outputs), {
            "japan-core-cpi-yoy.csv",
            "japan-industrial-production-yoy.csv",
        })
        self.assertEqual(len(meta), 2)
        for output in outputs.values():
            self.assertEqual(len(output), 120)
            self.assertEqual(len(output.columns), 2)
            self.assertEqual(output.columns[0], "date")
            self.assertTrue(output["date"].str.endswith("-01").all())

    def test_ip_transformation_is_yoy(self):
        frame = normalize(self.make_payload())
        outputs, _ = build_outputs(frame, self.config())
        output = outputs["japan-industrial-production-yoy.csv"]
        last = output.iloc[-1, 1]
        raw_now = frame.iloc[-1]["(一致)_C1生産指数(鉱工業)"]
        raw_12 = frame.iloc[-13]["(一致)_C1生産指数(鉱工業)"]
        self.assertAlmostEqual(last, (raw_now / raw_12 - 1) * 100)

    def test_gap_fails_closed(self):
        frame = normalize(self.make_payload()).drop(pd.Timestamp("2024-01-31"))
        with self.assertRaises(RuntimeError):
            build_outputs(frame, self.config())


if __name__ == "__main__":
    unittest.main()
