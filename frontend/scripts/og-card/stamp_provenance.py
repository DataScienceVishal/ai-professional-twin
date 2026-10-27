"""Record where the share card came from inside its PNG, as tEXt chunks.

Usage: python3 stamp_provenance.py PNG --renderer "Chrome for Testing 153.0.8010.12" --date 2026-10-15

Running it again replaces the chunks it wrote before, so the file never carries
two answers to the same question.
"""

import argparse
import struct
import zlib
from pathlib import Path

SIGNATURE = b"\x89PNG\r\n\x1a\n"
SOURCE = "frontend/scripts/og-card/og-card.html"


def chunk(kind: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", crc)


def stamp(path: Path, fields: dict[str, str]) -> None:
    raw = path.read_bytes()
    if not raw.startswith(SIGNATURE):
        raise SystemExit(f"{path} is not a PNG")
    keys = {key.encode("latin-1") for key in fields}
    out = [SIGNATURE]
    pos = len(SIGNATURE)
    while pos < len(raw):
        (length,) = struct.unpack(">I", raw[pos : pos + 4])
        kind = raw[pos + 4 : pos + 8]
        end = pos + 12 + length
        data = raw[pos + 8 : pos + 8 + length]
        if kind == b"IEND":
            for key, value in fields.items():
                out.append(chunk(b"tEXt", key.encode("latin-1") + b"\0" + value.encode("latin-1")))
        if not (kind == b"tEXt" and data.split(b"\0", 1)[0] in keys):
            out.append(raw[pos:end])
        pos = end
    path.write_bytes(b"".join(out))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("png", type=Path)
    parser.add_argument("--renderer", required=True)
    parser.add_argument("--date", required=True)
    args = parser.parse_args()
    stamp(
        args.png,
        {
            "Source": SOURCE,
            "Software": f"{args.renderer}, headless, CDP Page.captureScreenshot at 1200x630",
            "Creation Time": args.date,
        },
    )


if __name__ == "__main__":
    main()
