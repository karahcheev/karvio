#!/usr/bin/env python3
"""
Bootstrap — create default project and admin user.

Run explicitly after deployment or when DB is empty. Use instead of
BOOTSTRAP_ENABLED=true to avoid unexpected data changes on every startup.

Example:
  python -m scripts.bootstrap
  # or from backend root:
  uv run python scripts/bootstrap.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import AsyncSessionLocal
from app.services.bootstrap import ensure_default_data


async def amain() -> None:
    async with AsyncSessionLocal() as db:
        await ensure_default_data(db)
    print("Bootstrap: default project and admin user ensured.")


def main() -> None:
    asyncio.run(amain())


if __name__ == "__main__":
    main()
