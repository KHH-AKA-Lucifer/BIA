from __future__ import annotations

import json
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.predictive_service import train_all_models


def main() -> int:
    models = train_all_models(force=True)
    print(json.dumps(models, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
