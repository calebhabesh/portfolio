"""Turn tb_record's run-length scanlines into a 60 fps MP4.

Pixels are exactly the sampled VHDL RGB outputs; frames are only scaled 2x
(nearest neighbour) and given a caption strip.

usage: render.py frames.rle out.mp4
"""
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

W, H, SCALE, STRIP = 640, 480, 2, 120
CAPTION = "Frames sampled from the refreshed VHDL's RGB outputs in GHDL · 60 Hz, board motion rate"
DETAIL = "Scripted switch inputs track the ball; the right player parks for one rally to show a goal and reset"


def frames(path):
    rows = []
    with open(path) as f:
        for line in f:
            row = bytearray()
            for token in line.split():
                colour, run = (int(v) for v in token.split(":"))
                row += bytes((colour >> 16, (colour >> 8) & 255, colour & 255)) * run
            assert len(row) == W * 3, len(row)
            rows.append(bytes(row))
            if len(rows) == H:
                yield b"".join(rows)
                rows = []
    assert not rows


def font(size):
    for name in ("DejaVuSans.ttf", "/usr/share/fonts/TTF/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    src, out = sys.argv[1:3]
    ow, oh = W * SCALE, H * SCALE + STRIP
    ffmpeg = subprocess.Popen(
        ["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ow}x{oh}",
         "-r", "60", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart", out],
        stdin=subprocess.PIPE)
    canvas = Image.new("RGB", (ow, oh), (17, 24, 32))
    draw = ImageDraw.Draw(canvas)
    draw.text((32, H * SCALE + 26), CAPTION, fill=(236, 240, 238), font=font(26))
    draw.text((32, H * SCALE + 70), DETAIL, fill=(160, 172, 166), font=font(21))
    count = 0
    for raw in frames(src):
        frame = Image.frombytes("RGB", (W, H), raw).resize((W * SCALE, H * SCALE), Image.NEAREST)
        canvas.paste(frame, (0, 0))
        ffmpeg.stdin.write(canvas.tobytes())
        count += 1
    ffmpeg.stdin.close()
    assert ffmpeg.wait() == 0
    print(f"{count} frames")


if __name__ == "__main__":
    main()
