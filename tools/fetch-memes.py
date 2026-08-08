#!/usr/bin/env python3
"""Re-fetch the reaction images in memes/ from Wikimedia Commons.

Provenance, so nobody has to take the licensing on trust. Every image here is
a photograph of a painting old enough that its copyright has expired; a
faithful reproduction of a flat public-domain work earns no new copyright of
its own, which is why Commons tags them PD-Art. This script refuses to save
anything whose licence field does not read exactly "Public domain", and
refuses anything carrying usage restrictions.

    python3 tools/fetch-memes.py            # verify licences and re-download
    python3 tools/fetch-memes.py --check    # verify only, touch nothing

The captions and the right/wrong tagging live in js/memes.js, not here.
"""

import argparse
import json
import os
import re
import struct
import subprocess
import sys

UA = "WordSplit-build/1.0 (https://github.com/LiamDaPanda/WordSplit; asset sourcing)"
API = "https://commons.wikimedia.org/w/api.php"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "memes")

# slug -> Commons file title. The slug is what js/memes.js references.
FILES = {
    "ducreux":   "File:Joseph Ducreux - Self-portrait of the artist as a mocker.jpg",
    "babbe":     "File:Malle Babbe (Frans Hals)-WUS03734.jpg",
    "cavalier":  "File:Frans Hals – The Laughing Cavalier.jpg",
    "lutenist":  "File:Jan Steen - Self-Portrait as a Lutenist - WGA21754.jpg",
    "leyster":   "File:Judith Leyster - Self-Portrait - Google Art Project.jpg",
    "zeuxis":    "File:Rembrandt Self-portrait as the Laughing Zeuxis while Painting an Old Woman.jpg",
    "scream":    "File:Edvard Munch - The Scream - Google Art Project.jpg",
    "desespere": "File:Gustave Courbet - Le Désespéré (1843).jpg",
    "madfear":   "File:The Man Made Mad with Fear by Gustave Courbet.jpg",
    "despair":   "File:Edvard Munch - Despair (1894).jpg",
}

# A meme card is at most ~360 CSS px wide. Commons snaps to its own buckets,
# so this asks for 460 and gets 500 — enough for a 2x display, small enough
# that ten of them stay under a megabyte in the offline precache.
WIDTH = 460


def api(**params):
    params.setdefault("format", "json")
    params.setdefault("action", "query")
    args = ["curl", "-sS", "-A", UA, "-G", API]
    for key, value in params.items():
        args += ["--data-urlencode", "%s=%s" % (key, value)]
    done = subprocess.run(args, capture_output=True, text=True, timeout=90)
    if done.returncode:
        raise SystemExit("commons request failed: " + done.stderr.strip())
    return json.loads(done.stdout)


def imageinfo(titles):
    """title -> {thumb, license, restrictions, artist, descurl}"""
    out = {}
    # the API takes a bounded number of titles per call
    batch = list(titles)
    for start in range(0, len(batch), 20):
        chunk = batch[start:start + 20]
        pages = api(titles="|".join(chunk), prop="imageinfo",
                    iiprop="url|extmetadata", iiurlwidth=WIDTH)["query"]["pages"]
        for page in pages.values():
            info = (page.get("imageinfo") or [None])[0]
            if not info:
                out[page["title"]] = None
                continue
            meta = info.get("extmetadata", {})
            get = lambda k: (meta.get(k) or {}).get("value", "")
            out[page["title"]] = {
                "thumb": (info.get("thumburl") or "").split("?")[0],
                "descurl": info.get("descriptionurl", ""),
                "license": get("LicenseShortName").strip(),
                "restrictions": get("Restrictions").strip(),
                "artist": re.sub(r"<[^>]+>", "", get("Artist")).strip(),
            }
    return out


def jpeg_size(path):
    """(width, height), or None when the bytes are not a JPEG at all — the
    thumbnailer answers with an HTML error page for widths it will not make."""
    data = open(path, "rb").read()
    if not data.startswith(b"\xff\xd8"):
        return None
    i = 2
    while i < len(data) - 9:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            height, width = struct.unpack(">HH", data[i + 5:i + 9])
            return width, height
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        i += 2 + struct.unpack(">H", data[i + 2:i + 4])[0]
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="verify licences without downloading")
    args = ap.parse_args()

    data = imageinfo(FILES.values())
    rejected = []
    approved = []

    for slug, title in FILES.items():
        info = data.get(title)
        if not info:
            rejected.append((slug, "not found on Commons"))
        elif info["license"].lower() != "public domain":
            rejected.append((slug, "licence is %r, not public domain" % info["license"]))
        elif info["restrictions"]:
            rejected.append((slug, "carries restrictions: " + info["restrictions"]))
        else:
            approved.append((slug, info))

    for slug, info in sorted(approved):
        print("  ok      %-10s %s — %s" % (slug, info["license"], info["artist"][:38]))
    for slug, why in sorted(rejected):
        print("  REJECT  %-10s %s" % (slug, why))

    if rejected:
        raise SystemExit("\n%d image(s) failed the licence check; nothing written."
                         % len(rejected))
    if args.check:
        print("\nAll %d public domain, no restrictions." % len(approved))
        return

    os.makedirs(OUT, exist_ok=True)
    total = 0
    for slug, info in sorted(approved):
        path = os.path.join(OUT, slug + ".jpg")
        subprocess.run(["curl", "-sSL", "-A", UA, "-o", path, info["thumb"]], check=True)
        size = jpeg_size(path)
        if not size:
            os.remove(path)
            raise SystemExit("%s: Commons returned something that is not a JPEG" % slug)
        total += os.path.getsize(path)
        print("  wrote   %-10s %dx%d  %d bytes" % (slug, size[0], size[1],
                                                   os.path.getsize(path)))

    print("\n%d images, %d KB total." % (len(approved), round(total / 1024)))
    print("Remember: memes/ is precached, so bump CACHE in sw.js when it changes.")


if __name__ == "__main__":
    sys.exit(main())
