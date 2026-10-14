library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use std.textio.all;
use std.env.all;

-- Records consecutive frames from the unmodified pong top level at its board
-- MOTION_CYCLES, run-length encoding each active scanline of the sampled RGB
-- outputs. A scripted player sets the four switches between frames using only
-- what the video shows: the ball row and each paddle's top row.
entity tb_record is
  generic(FRAMES : positive := 900);
end;
architecture test of tb_record is
  signal clk : std_logic := '0';
  signal sw : std_logic_vector(3 downto 0) := "1010";
  signal h, v, dac : std_logic;
  signal r, g, b : std_logic_vector(7 downto 0);
begin
  clk <= not clk after 10 ns;
  dut: entity work.pong port map(clk, sw(0), sw(1), sw(2), sw(3), h, v, dac, r, g, b);
  process
    file runs : text open write_mode is "frames.rle";
    variable l : line;
    variable colour, previous : natural;
    variable run : natural;
    variable ball_y, left_top, right_top : integer;
    variable target : integer;
    variable left_sw, right_sw : std_logic_vector(1 downto 0);
  begin
    for frame in 0 to FRAMES - 1 loop
      ball_y := -1; left_top := -1; right_top := -1;
      for y in 0 to 524 loop
        run := 0; previous := 0;
        for x in 0 to 799 loop
          wait until rising_edge(dac); wait for 1 ns;
          if x < 640 and y < 480 then
            colour := to_integer(unsigned(r)) * 65536 + to_integer(unsigned(g)) * 256 + to_integer(unsigned(b));
            if colour = 16#FFFF00# and ball_y < 0 then ball_y := y; end if;
            if x = 55 and colour = 16#0000FF# and left_top < 0 then left_top := y; end if;
            if x = 585 and colour = 16#FF00FF# and right_top < 0 then right_top := y; end if;
            if x = 0 then previous := colour; run := 1;
            elsif colour = previous then run := run + 1;
            else
              write(l, previous); write(l, string'(":")); write(l, run); write(l, string'(" "));
              previous := colour; run := 1;
            end if;
            if x = 639 then
              write(l, previous); write(l, string'(":")); write(l, run); writeline(runs, l);
            end if;
          end if;
        end loop;
      end loop;
      -- SW0/SW2 = 1 moves up, SW1/SW3 = 1 holds. Each player centres on the ball.
      left_sw := "10"; right_sw := "10";
      if ball_y >= 0 and left_top >= 0 then
        target := ball_y + 5 - 40;
        if target < left_top - 2 then left_sw := "01";
        elsif target > left_top + 2 then left_sw := "00"; end if;
      end if;
      -- The right player parks at the top for one rally so a goal and reset are recorded.
      if frame >= 470 and frame < 556 then right_sw := "01";
      elsif ball_y >= 0 and right_top >= 0 then
        target := ball_y + 5 - 40;
        if target < right_top - 2 then right_sw := "01";
        elsif target > right_top + 2 then right_sw := "00"; end if;
      end if;
      sw <= right_sw & left_sw;
      if frame mod 50 = 0 then report "frame " & integer'image(frame); end if;
    end loop;
    file_close(runs); finish;
  end process;
end;
