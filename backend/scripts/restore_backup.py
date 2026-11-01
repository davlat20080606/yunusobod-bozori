"""Restore a nightly backup (see app/services/backup.py).

    cd backend
    BACKUP_KEY=... python scripts/restore_backup.py 2026-11-02.json.gz.enc                 # only read it: row counts
    BACKUP_KEY=... python scripts/restore_backup.py 2026-11-02.json.gz.enc --into URL --yes  # write it into a database

The file comes from R2 (bucket → backups/). URL is the database to fill, e.g. a new empty Neon branch:
it is brought to the latest schema first, then its rows are REPLACED by the copy's. Restore into a new, empty
database first and check it; only then point the server at it.
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("file")
    parser.add_argument("--into", help="database URL to restore into")
    parser.add_argument("--yes", action="store_true", help="really replace the rows in that database")
    args = parser.parse_args()
    if args.into:
        # The app reads its database from the environment when it is imported
        os.environ["DATABASE_URL"] = args.into
    from app.services import backup

    data = backup.unpack(Path(args.file).read_bytes(), os.environ.get("BACKUP_KEY", ""))
    print(f"Copy made {data['made_at']} UTC, schema {data['schema']}")
    for name, rows in data["tables"].items():
        print(f"  {name:20} {len(rows):6} rows")
    if not args.into:
        return
    if not args.yes:
        sys.exit("Add --yes to replace the rows in that database")

    from app.database import engine
    from app.services.migrate import upgrade

    async def restore():
        async with engine.begin() as conn:
            await conn.run_sync(upgrade)
            counts = await conn.run_sync(backup.load_tables, data)
        await engine.dispose()
        return counts

    counts = asyncio.run(restore())
    wrong = {name: (len(rows), counts.get(name)) for name, rows in data["tables"].items() if counts.get(name) != len(rows)}
    if wrong:
        sys.exit(f"Row counts differ: {wrong}")
    print(f"Restored: {sum(counts.values())} rows, every table matches the copy")


if __name__ == "__main__":
    main()
