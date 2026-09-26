"""Stamp every local script and stylesheet in index.html with a hash of its contents.

  python3 tools/stamp.py          # rewrite ?v= values in index.html
  python3 tools/stamp.py --check  # exit 1 if any stamp is stale (for CI or a pre-commit check)

Browsers cache these files, so index.html references them as file.js?v=<stamp>. A stamp taken from
the file's contents changes exactly when the file does: changed files are fetched again, unchanged
ones stay cached. Run it before every commit that touches js/, styles/, narration/*.js or app.js.
"""

import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
REF = re.compile(r'((?:src|href)=")([^"?:]+\.(?:js|css))(?:\?v=([^"]*))?(")')


def stamp(path):
    return hashlib.sha1((ROOT / path).read_bytes()).hexdigest()[:10]


def main():
    html = INDEX.read_text()
    stale = []

    def replace(match):
        prefix, path, old, quote = match.groups()
        if not (ROOT / path).is_file():
            return match.group(0)
        new = stamp(path)
        if old != new:
            stale.append(path)
        return f"{prefix}{path}?v={new}{quote}"

    updated = REF.sub(replace, html)
    if "--check" in sys.argv:
        if stale:
            print("stale stamps:", *stale, sep="\n  ")
            sys.exit(1)
        print("all stamps current")
        return
    INDEX.write_text(updated)
    print(f"{len(stale)} stamp{'s' if len(stale) != 1 else ''} updated" + (":\n  " + "\n  ".join(stale) if stale else ""))


if __name__ == "__main__":
    main()
