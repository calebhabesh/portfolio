# Hardware coursework publication

Published 2026-10-04. The four personal projects remain first, followed by the
capstone, then the two coursework additions. The project list now has seven entries.

| Project | Website | Public repository | Evidence |
| --- | --- | --- | --- |
| 4×4 NoC simulator | Main project entry | https://github.com/calebhabesh/systemc-noc | SystemC delivery checks and three-pattern load sweep |
| FPGA VGA Pong | Main project entry | https://github.com/calebhabesh/fpga-pong | Historical board photograph, fresh RTL frame/video/game checks |
| Write-back cache | Supporting GitHub project | https://github.com/calebhabesh/writeback-cache | Fresh hit/refill/dirty-eviction reference-memory verification |

All three repositories retain recovered source, explain course-provided components,
document the October 2026 refresh and supply repeatable checks plus CI. NoC is a
SystemC simulator. Pong's board photograph shows the original 2024 submission;
its refreshed RTL has simulation and GHDL synthesis elaboration evidence. Cache
has simulation and GHDL synthesis elaboration evidence. Neither refreshed VHDL
design claims a new board run or target timing closure.

The resume source bank has separate role-specific profiles for all three. Those
profiles identify exact verified commits, public links, evidence and candidate
bullets. The original course terms remain separate from the 2026 work; exact
personal start/end months are unconfirmed. Historical applications are not changed.

Validation: `npm run check` covers desktop/light and mobile/dark reduced-motion
rendering, both new entries and their GitHub links, search, image decoding, Pong's
two evidence captions, keyboard/dialog behavior and accessibility. The existing
search regression expectations are updated for seven entries and NoC's C++/CMake
tags. Static project markup is generated from the same project data.

Deployment uses the existing VPS release script after verification. The site keeps
the cache controller off the main project list, as recommended.
