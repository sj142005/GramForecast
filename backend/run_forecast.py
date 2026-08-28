"""Run forecasts for a business using the configured database."""

import argparse
import os
import subprocess
import sys
from pathlib import Path

import psycopg2


REPO_ROOT = Path(__file__).resolve().parent.parent
FORECASTER = REPO_ROOT / "ml-service" / "forecaster.py"
DEMO_MOBILE = "+919876543210"


def main():
    parser = argparse.ArgumentParser(description="Generate the next 7 days of forecasts")
    parser.add_argument("--business-id", help="business UUID; defaults to the seeded demo business")
    args = parser.parse_args()

    database_url = os.environ["DATABASE_URL"]
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    connect_args = {"sslmode": "require"} if database_url.startswith("postgresql://") else {}

    with psycopg2.connect(database_url, **connect_args) as connection:
        with connection.cursor() as cursor:
            business_id = args.business_id
            if not business_id:
                cursor.execute("SELECT business_id FROM users WHERE mobile = %s", (DEMO_MOBILE,))
                row = cursor.fetchone()
                if not row:
                    raise RuntimeError("Demo user was not found; run database/seed.py --reset first")
                business_id = str(row[0])

    environment = os.environ.copy()
    environment["DATABASE_URL"] = database_url
    result = subprocess.run(
        [sys.executable, str(FORECASTER), "--business_id", business_id],
        cwd=str(FORECASTER.parent),
        env=environment,
        check=False,
    )
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
