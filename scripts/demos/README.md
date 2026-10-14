# Demo video generators

Recorded demos for projects without a live site. Both are generated from the
projects' own simulations, so they can be reproduced from their repositories.

## SystemC NoC · `public/projects/systemc-noc/traffic-demo.mp4`

Replays two runs of the [systemc-noc](https://github.com/calebhabesh/systemc-noc)
simulator from their VCD traces: injections and deliveries are trace events, and
the delivered counts and mean latencies match the simulator's JSON summaries.

```sh
(mkdir -p stride && cd stride && /path/to/systemc-noc/build/noc stride 50 100 | grep '^{' > summary.json)
(mkdir -p hotspot && cd hotspot && /path/to/systemc-noc/build/noc hotspot 50 100 | grep '^{' > summary.json)
python3 scripts/demos/systemc-noc/render.py frames stride/NoC_trace.vcd:stride/summary.json hotspot/NoC_trace.vcd:hotspot/summary.json
ffmpeg -framerate 30 -i frames/f%04d.png -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart traffic-demo.mp4
```

## FPGA Pong · `public/projects/fpga-pong/rtl-gameplay.mp4`

Fifteen seconds (900 frames at 60 Hz) of the refreshed
[fpga-pong](https://github.com/calebhabesh/fpga-pong) RTL in GHDL, sampled from
its RGB outputs at the board's motion rate. Takes about 20 minutes.

```sh
cp /path/to/fpga-pong/rtl/*.vhd scripts/demos/fpga-pong/tb_record.vhd work/ && cd work
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work ghdl/ghdl:5.1.1-mcode-ubuntu-24.04 \
  bash -c 'ghdl -a --std=08 vga_timing.vhd pong_game.vhd pong.vhd tb_record.vhd && ghdl -r --std=08 tb_record'
python3 ../scripts/demos/fpga-pong/render.py frames.rle rtl-gameplay.mp4
```
