# Tak — A Beautiful Game

A responsive, browser-based Tak game for two people sharing a device. Includes
3×3, 4×4, 5×5, 6×6, and 8×8 boards, opening color swap, flats, standing stones,
capstones, stack spreading, road and flat wins, undo, and an in-game rules guide.
The board and pieces are drawn in CSS; no image assets are required.

## Play locally

With Node.js 18+ and Python 3 installed:

```sh
npm start
```

Open **http://localhost:5173**. No package installation or build step is needed.
You can also serve the `public` directory with any static web server. Games are
kept in memory; refreshing the page starts over. There is no AI or online multiplayer.

## Controls

- **Place a piece:** choose a flat, standing stone, or capstone, then click an empty
  square. The first two turns place an opponent’s flat stone automatically.
- **Move a stack:** click a stack with your color on top, choose how many pieces to
  carry, and enter a drop pattern whose counts add up to that number. Click a
  highlighted destination. For example, `1,2` carries three pieces two squares.
- **Undo** reverses the last turn, including a game-ending move.
- **New game** uses the selected board size and asks before discarding an active game.
- Open **How to play** for the complete rules used here. Capstones count toward
  roads, but not flat scoring; no komi is applied.

## Tests

```sh
npm test
```

Rules tests use Node’s built-in test runner. The rules engine in `public/game.js`
is separate from the browser interface and validates moves without mutating the
previous state. The app has no runtime dependencies. Optional Google Fonts have
local system-font fallbacks.