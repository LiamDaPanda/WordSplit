#!/usr/bin/env python3
"""Re-fetch the reaction images in memes/ from Wikimedia Commons.

Provenance, so nobody has to take the licensing on trust. Two kinds of image
are here:

  - photographs of paintings old enough that copyright has expired. A faithful
    reproduction of a flat public-domain work carries no new copyright of its
    own, which is why Commons tags these PD-Art.
  - freely licensed modern photographs, mostly of animals, which is where
    reaction images actually live. An all-paintings set reads as a museum
    gift shop rather than as memes.

Only licences that permit redistribution are accepted: public domain, CC0,
CC BY, CC BY-SA. NonCommercial and NoDerivatives are refused, because this
ships in a public repository anyone may fork. Author and licence are printed
for every image so they can be checked against the credits in js/memes.js —
which is the attribution CC BY and CC BY-SA require, and the reason the app
shows a credits list at all.

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
import time

# Licences that allow redistribution. NonCommercial and NoDerivatives are
# refused: this ships in a public repository that anyone may fork.
FREE = re.compile(r"^(public domain|cc0|cc by)", re.I)
NONFREE = re.compile(r"-nc|-nd|noncommercial|noderiv", re.I)

UA = "WordSplit-build/1.0 (https://github.com/LiamDaPanda/WordSplit; asset sourcing)"
API = "https://commons.wikimedia.org/w/api.php"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, "memes")

# slug -> Commons file title. The slug is what js/memes.js references.
FILES = {
    # paintings, public domain
    "ducreux":   "File:Joseph Ducreux - Self-portrait of the artist as a mocker.jpg",
    "babbe":     "File:Malle Babbe (Frans Hals)-WUS03734.jpg",
    "zeuxis":    "File:Rembrandt Self-portrait as the Laughing Zeuxis while Painting an Old Woman.jpg",
    "scream":    "File:Edvard Munch - The Scream - Google Art Project.jpg",
    "desespere": "File:Gustave Courbet - Le Désespéré (1843).jpg",
    "madfear":   "File:The Man Made Mad with Fear by Gustave Courbet.jpg",
    # photographs, freely licensed
    "retriever": "File:Golden Retriever with tongue out.jpg",
    "bouncing":  "File:Maltipoo dog bouncing (11875).jpg",
    "tongueout": "File:Dog sticking its tongue out a little bit (24044).jpg",
    "puppy":     "File:Mixed-breed dog Labradoodle Miniature poodle puppy 6 weeks outdoors grass yawn open mouth (hund blandingsrase puddel-valp på gress gjesper med åpen munn) Tjøme Norway 2022-06 DSC06973.jpg",
    "outraged":  "File:2008-08-20 IMG 1883 Cat just yawning.jpg",
    "badouzi":   "File:2017-02-05 Yawning cat at Badouzi.jpg",
    "deadpan":   "File:2020-11-11 21 50 05 A tabby cat yawning while lying in a box in the Franklin Farm section of Oak Hill, Fairfax County, Virginia.jpg",
    "sneer":     "File:2021-04-03 16-39-15 chat.jpg",
    "istanbul":  "File:A feral cat in Istanbul-2014-01-23-2.jpg",
    "ava":       "File:Ava Yawning.jpg",
    "bart":      "File:Bart - Flickr - dcJohn.jpg",
    "blini":     "File:Blini58673737.jpg",
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
        elif not FREE.match(info["license"]) or NONFREE.search(info["license"]):
            rejected.append((slug, "licence %r does not permit redistribution"
                             % info["license"]))
        elif info["restrictions"]:
            rejected.append((slug, "carries restrictions: " + info["restrictions"]))
        else:
            approved.append((slug, info))

    for slug, info in sorted(approved):
        print("  ok      %-11s %-13s %s" % (slug, info["license"], info["artist"][:36]))
    for slug, why in sorted(rejected):
        print("  REJECT  %-10s %s" % (slug, why))

    if rejected:
        raise SystemExit("\n%d image(s) failed the licence check; nothing written."
                         % len(rejected))
    if args.check:
        print("\nAll %d redistributable, no restrictions." % len(approved))
        return

    os.makedirs(OUT, exist_ok=True)
    total = 0
    for slug, info in sorted(approved):
        path = os.path.join(OUT, slug + ".jpg")
        # Commons rate-limits a burst and answers with an HTML error page, so a
        # download is only accepted once it parses as a JPEG. Paced and retried
        # rather than hammered.
        size = None
        for attempt in range(4):
            if attempt:
                time.sleep(2 * attempt)
            subprocess.run(["curl", "-sSL", "--retry", "2", "--max-time", "30",
                            "-A", UA, "-o", path, info["thumb"]], check=True)
            size = jpeg_size(path)
            if size:
                break
        if not size:
            if os.path.exists(path):
                os.remove(path)
            raise SystemExit("%s: Commons would not serve a JPEG (rate limited?)" % slug)
        total += os.path.getsize(path)
        print("  wrote   %-11s %dx%d  %d bytes" % (slug, size[0], size[1],
                                                   os.path.getsize(path)))
        time.sleep(0.4)

    print("\n%d images, %d KB total." % (len(approved), round(total / 1024)))
    print("Remember: memes/ is precached, so bump CACHE in sw.js when it changes.")


if __name__ == "__main__":
    sys.exit(main())
