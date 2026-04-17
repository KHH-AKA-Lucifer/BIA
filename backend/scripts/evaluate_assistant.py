from __future__ import annotations

import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.assistant_service import answer_chat


QUESTION_SET = [
    "what is the best selling product of last 7 days ?",
    "bestselling product last7days",
    "what is the best performing location in last 24 hours ?",
    "best perfoming location last 24 hrs",
    "lowest performing category in last 30 days",
    "compare top categories this month",
    "which machine needs assitance now",
    "which machines are highest risk right now?",
    "predict next 7 days revenue for Plainsview Market Synth 69",
    "forecast next day revenue for maple valley plaza",
    "cluster locations and explain the segments",
    "what trained models are available?",
]


def main() -> int:
    for question in QUESTION_SET:
        response = answer_chat(question, period="month")
        print(question)
        print(f"  mode={response['mode']} route={response['route']} scope={response.get('data_scope')}")
        print(f"  answer={response['answer']}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
