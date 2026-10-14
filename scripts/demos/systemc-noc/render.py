"""Render a side-by-side NoC demo from two SystemC VCD traces.

Every event comes from the trace: a change to a source channel is an injected flit,
and a change to a sink channel is a delivered flit (matched in source order, as the
simulator's scoreboard does). Routes are drawn by the model's XY rule; the trace
does not record per-hop positions, so a route is lit while any of its flits are
injected but not yet delivered.

usage: render.py OUT_DIR LEFT.vcd:LEFT.json RIGHT.vcd:RIGHT.json
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

FPS = 30
SECONDS = 22
W, H = 1600, 900
INK, MUTED, PAPER, LINE = "#161f1b", "#5b655f", "#f7f6f2", "#d5dbd6"
ACCENT, HOT, DONE = "#1f7a8c", "#c2410c", "#1d6141"


def parse(path):
    ids, scopes = {}, None
    events = {"source": defaultdict(list), "sink": defaultdict(list)}
    values = {}
    with open(path) as f:
        for line in f:
            if line.startswith("$scope module si_"):
                m = re.match(r"\$scope module si_(source|sink)\((\d+)\)", line)
                scopes = (m.group(1), int(m.group(2)))
            elif line.startswith("$var") and scopes:
                parts = line.split()
                ids[parts[3]] = (*scopes, parts[4])
            elif line.startswith("$enddefinitions"):
                break
        # A flit is any change to a channel's struct; flush once per timestamp.
        t, dirty = 0, set()

        def flush():
            for kind, node in sorted(dirty):
                get = lambda field: values.get((kind, node, field), 0)
                events[kind][node].append((t / 1000.0, get("id"), get("dest")))
            dirty.clear()

        for line in f:
            line = line.strip()
            if not line or line[0] not in "#b01":
                continue
            if line[0] == "#":
                if t > 0:
                    flush()
                dirty.clear()
                t = int(line[1:])
                continue
            if line[0] == "b":
                val, code = line[1:].split()
                val = int(val, 2)
            else:
                val, code = int(line[0]), line[1:]
            if code not in ids:
                continue
            kind, node, field = ids[code]
            values[(kind, node, field)] = val
            dirty.add((kind, node))
        if t > 0:
            flush()
    flits = []
    by_source = defaultdict(list)
    for sink, evs in events["sink"].items():
        for t, src, _ in evs:
            by_source[src].append((t, sink))
    for src, injected in events["source"].items():
        delivered = sorted(by_source[src])
        assert len(injected) == len(delivered), (path, src, len(injected), len(delivered))
        for (ti, _, dest), (td, sink) in zip(injected, delivered):
            assert dest == sink
            flits.append((src, dest, ti, td))
    return flits


def xy_route(src, dest):
    x, y = src % 4, src // 4
    dx, dy = dest % 4, dest // 4
    hops = [(x, y)]
    while x != dx:
        x += 1 if dx > x else -1
        hops.append((x, y))
    while y != dy:
        y += 1 if dy > y else -1
        hops.append((x, y))
    return hops


def draw_panel(ax, title, subtitle, flits, summary, now, step, colour):
    ax.set_xlim(-1.3, 4.3)
    ax.set_ylim(4.35, -1.25)
    ax.axis("off")
    ax.text(-1.2, -1.05, title, fontsize=21, weight="bold", color=INK, va="top")
    ax.text(-1.2, -0.62, subtitle, fontsize=12.5, color=MUTED, va="top")
    for i in range(4):
        ax.plot([0, 3], [i, i], color=LINE, lw=3, zorder=1)
        ax.plot([i, i], [0, 3], color=LINE, lw=3, zorder=1)
    in_flight = defaultdict(int)
    backlog = defaultdict(int)
    delivered, latency, recent = 0, 0.0, defaultdict(float)
    for src, dest, ti, td in flits:
        # A frame spans `step` ns; light routes with any flit in flight during it.
        if ti < now and td > now - step:
            in_flight[(src, dest)] += 1
        if ti <= now < td:
            backlog[src] += 1
        if td <= now:
            delivered += 1
            latency += td - ti
            if now - td < 60:
                recent[dest] = max(recent[dest], 1 - (now - td) / 60)
    for (src, dest), n in in_flight.items():
        pts = xy_route(src, dest)
        ax.plot([p[0] for p in pts], [p[1] for p in pts], color=colour,
                lw=1.5 + min(n, 20) * 0.35, alpha=min(0.25 + n * 0.06, 0.9),
                solid_capstyle="round", zorder=2)
    for node in range(16):
        x, y = node % 4, node // 4
        b = backlog[node]
        fill = colour if b else PAPER
        alpha = min(0.15 + b / 40, 1.0) if b else 1.0
        ax.add_patch(plt.Circle((x, y), 0.27, facecolor=PAPER, edgecolor="none", zorder=3))
        ax.add_patch(plt.Circle((x, y), 0.27, facecolor=fill, alpha=alpha, edgecolor="none", zorder=3))
        ax.add_patch(plt.Circle((x, y), 0.27, facecolor="none", edgecolor=INK, lw=1.6, zorder=4))
        if recent[node]:
            ax.add_patch(plt.Circle((x, y), 0.27 + 0.12 * recent[node], facecolor="none",
                                    edgecolor=colour, lw=3, alpha=recent[node], zorder=4))
        ax.text(x, y, str(node), ha="center", va="center", fontsize=13, weight="bold",
                color="white" if b > 18 else INK, zorder=5)
    total = summary["flits_sent"]
    done = delivered == total
    mean = latency / delivered if delivered else 0
    stats = [
        ("Delivered", f"{delivered:,} / {total:,} flits"),
        ("Mean flit latency", f"{mean:,.2f} ns"),
        ("Status", f"all verified · {summary['delivery_window_ns'] / 1000:.2f} µs" if done else "in flight"),
    ]
    for i, (k, v) in enumerate(stats):
        ax.text(-1.2 + i * 1.9, 3.72, k.upper(), fontsize=9.5, color=MUTED, va="top", weight="bold")
        ax.text(-1.2 + i * 1.9, 3.95, v, fontsize=13.5, color=DONE if (i == 2 and done) else INK, va="top")


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    runs = []
    for arg in sys.argv[2:4]:
        vcd, js = arg.split(":")
        summary = json.loads(Path(js).read_text())
        flits = parse(vcd)
        assert len(flits) == summary["flits_received"], (len(flits), summary)
        runs.append((summary, flits))
    end = max(max(td for *_, td in f) for _, f in runs) + 400
    frames = FPS * SECONDS
    plt.rcParams["font.family"] = "DejaVu Sans"
    only = [int(a) for a in sys.argv[4:]]
    for k in only or range(frames):
        now = end * min(1.0, k / (frames - FPS * 3))
        fig = plt.figure(figsize=(W / 100, H / 100), dpi=100, facecolor=PAPER)
        fig.text(0.04, 0.95, "4×4 SystemC NoC · same injection rate, two traffic patterns", fontsize=24,
                 weight="bold", color=INK, va="top")
        fig.text(0.04, 0.895, f"Simulated time {now / 1000:6.2f} µs   ·   16 sources × 100 flits, one flit every 50 ns   ·   "
                 "routes lit while their flits are injected but not yet delivered", fontsize=13, color=MUTED, va="top")
        for i, ((summary, flits), colour) in enumerate(zip(runs, (ACCENT, HOT))):
            ax = fig.add_axes([0.03 + i * 0.49, 0.03, 0.45, 0.8])
            name = summary["pattern"]
            sub = ("node n sends to n+4 mod 16" if name == "stride" else
                   "every node sends to node 0 (node 0 sends to 15)" if name == "hotspot" else "")
            draw_panel(ax, name.capitalize(), sub, flits, summary, now, end / (frames - FPS * 3), colour)
        fig.savefig(out / f"f{k:04d}.png", facecolor=PAPER)
        plt.close(fig)


if __name__ == "__main__":
    main()
