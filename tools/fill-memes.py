#!/usr/bin/env python3
"""Fetch only the memes/ files that are missing or not valid JPEGs.

tools/fetch-memes.py fetches the whole set in one go, which is the right thing
for a fresh checkout and the wrong thing when Commons is rate-limiting: a burst
gets answered with HTML error pages, and a bulk run that trips halfway leaves
some files written and some not. It has been seen to write an error page over a
valid JPEG.

This is the recovery path. It looks at what is on disk, fetches only what is
absent or unparseable, goes one at a time with generous pacing, and verifies
each file before moving on. Safe to re-run as many times as it takes — a
complete set makes it a no-op.

    python3 tools/fill-memes.py

Licence checking is not duplicated here; it reuses fetch-memes.py, so an image
whose licence does not permit redistribution is refused in exactly one place.
"""

import importlib.util
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, os.pardir, "memes")

spec = importlib.util.spec_from_file_location(
    "fetch_memes", os.path.join(HERE, "fetch-memes.py"))
fm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fm)


def usable(path):
    """A file counts as present only if it parses as a JPEG. Size alone is not
    enough: a rate-limit error page is several KB of perfectly good HTML."""
    if not os.path.exists(path) or os.path.getsize(path) < 3000:
        return False
    return fm.jpeg_size(path) is not None


def main():
    todo = [slug for slug in fm.FILES
            if not usable(os.path.join(OUT, slug + ".jpg"))]
    if not todo:
        print("All %d images present and valid; nothing to do." % len(fm.FILES))
        return 0

    print("Missing or unreadable: %s" % ", ".join(todo))
    os.makedirs(OUT, exist_ok=True)
    info = fm.imageinfo([fm.FILES[slug] for slug in todo])
    failed = []

    for slug in todo:
        meta = info.get(fm.FILES[slug])
        if not meta:
            failed.append((slug, "not found on Commons"))
            continue
        if not fm.FREE.match(meta["license"]) or fm.NONFREE.search(meta["license"]):
            failed.append((slug, "licence %r does not permit redistribution"
                           % meta["license"]))
            continue
        if meta["restrictions"]:
            failed.append((slug, "carries restrictions: " + meta["restrictions"]))
            continue

        path = os.path.join(OUT, slug + ".jpg")
        for attempt in range(6):
            if attempt:
                time.sleep(5 * attempt)
            subprocess.run(["curl", "-sSL", "--retry", "2", "--max-time", "40",
                            "-A", fm.UA, "-o", path, meta["thumb"]])
            if usable(path):
                break
        if usable(path):
            size = fm.jpeg_size(path)
            print("  %-11s %-13s %dx%d  %d bytes"
                  % (slug, meta["license"], size[0], size[1],
                     os.path.getsize(path)))
        else:
            # never leave an error page sitting there looking like an image
            if os.path.exists(path):
                os.remove(path)
            failed.append((slug, "Commons would not serve a JPEG (rate limited?)"))
        time.sleep(3)

    for slug, why in failed:
        print("  FAILED  %-11s %s" % (slug, why))
    if failed:
        print("\n%d still missing. Re-run; this is idempotent." % len(failed))
        return 1
    print("\nComplete. memes/ is precached, so bump CACHE in sw.js if it changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
