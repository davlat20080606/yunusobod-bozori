"""Tokens, keys and passwords live only in .env and Render, never in Git.
The repository is public: anything committed can be read by anyone, forever (Git keeps the history).
This test fails, here and on GitHub, when a file Git tracks looks like it holds a real secret."""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PATTERNS = {
    "Telegram bot token": re.compile(r"\b\d{8,10}:AA[A-Za-z0-9_-]{30,}"),
    "database URL with a password": re.compile(r"postgres(?:ql)?(?:\+asyncpg)?://[^\s:/@'\"]+:([^\s@'\"]+)@([^\s/'\"]+)"),
    "private key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "Cloudflare/AWS style secret": re.compile(r"(?i)(secret_access_key|access_key_id)\s*[=:]\s*['\"]?[A-Za-z0-9/+]{20,}"),
}
# Example and test values, not real ones
ALLOWED_DB = {("postgres", "localhost:5432"), ("password", "ep-xxx.eu-central-1.aws.neon.tech")}
SKIP = re.compile(r"\.(png|jpg|jpeg|webp|gif|ico|woff2?|lock)$|package-lock\.json$")


def tracked_files():
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return [ROOT / f for f in out.splitlines() if not SKIP.search(f)]


def test_env_files_are_ignored():
    for name in ("backend/.env", "frontend/.env", "backend/.env.production", "key.pem"):
        result = subprocess.run(["git", "check-ignore", "-q", name], cwd=ROOT)
        assert result.returncode == 0, f"{name} must be in .gitignore"
    assert not [f for f in tracked_files() if re.search(r"(^|/)\.env(\.(?!example$)[^/]*)?$", str(f.relative_to(ROOT)))], \
        "a .env file is tracked by Git"


def test_no_secrets_in_tracked_files():
    found = []
    for path in tracked_files():
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
            continue
        for what, pattern in PATTERNS.items():
            for match in pattern.finditer(text):
                if what == "database URL with a password" and (match.group(1), match.group(2).split("/")[0]) in ALLOWED_DB:
                    continue
                line = text.count("\n", 0, match.start()) + 1
                found.append(f"{path.relative_to(ROOT)}:{line}: {what}")  # never print the value itself
    assert not found, "Secrets must live in .env / Render, not in Git:\n" + "\n".join(found)
