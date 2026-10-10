export const SUPPLIES = {
  3: { stones: 10, caps: 0 },
  4: { stones: 15, caps: 0 },
  5: { stones: 21, caps: 1 },
  6: { stones: 30, caps: 1 },
  8: { stones: 50, caps: 2 },
};

export function createGame(size = 5) {
  if (!Object.hasOwn(SUPPLIES, size)) throw new Error('Unsupported board size.');
  return {
    size,
    board: Array.from({ length: size * size }, () => []),
    reserves: [{ ...SUPPLIES[size] }, { ...SUPPLIES[size] }],
    turn: 0,
    ply: 0,
    result: null,
  };
}

export const top = stack => stack.at(-1);

export function flatCounts(game) {
  const counts = [0, 0];
  for (const stack of game.board) {
    const piece = top(stack);
    if (piece?.type === 'flat') counts[piece.owner]++;
  }
  return counts;
}

export function roadPath(game, owner) {
  const { size, board } = game;
  const isRoad = index => {
    const piece = top(board[index]);
    return piece?.owner === owner && piece.type !== 'wall';
  };
  for (const vertical of [true, false]) {
    const queue = [];
    const parents = new Map();
    for (let i = 0; i < size; i++) {
      const start = vertical ? i : i * size;
      if (isRoad(start)) {
        queue.push(start);
        parents.set(start, null);
      }
    }
    for (let q = 0; q < queue.length; q++) {
      const index = queue[q];
      const row = Math.floor(index / size);
      const col = index % size;
      if (vertical ? row === size - 1 : col === size - 1) {
        const path = [];
        for (let at = index; at !== null; at = parents.get(at)) path.push(at);
        return path;
      }
      const neighbors = [];
      if (row > 0) neighbors.push(index - size);
      if (row < size - 1) neighbors.push(index + size);
      if (col > 0) neighbors.push(index - 1);
      if (col < size - 1) neighbors.push(index + 1);
      for (const next of neighbors) {
        if (!parents.has(next) && isRoad(next)) {
          parents.set(next, index);
          queue.push(next);
        }
      }
    }
  }
  return [];
}

function finishTurn(game, mover) {
  // The mover wins if a stack spread creates roads for both players.
  for (const owner of [mover, 1 - mover]) {
    const path = roadPath(game, owner);
    if (path.length) {
      game.result = { winner: owner, reason: 'road', path };
      break;
    }
  }
  if (!game.result && (game.board.every(stack => stack.length) ||
      game.reserves.some(reserve => reserve.stones + reserve.caps === 0))) {
    const counts = flatCounts(game);
    game.result = {
      winner: counts[0] === counts[1] ? null : Number(counts[1] > counts[0]),
      reason: 'flats',
      counts,
    };
  }
  game.ply++;
  game.turn = 1 - mover;
  return game;
}

function assertActive(game) {
  if (game.result) throw new Error('This game has ended. Start a new game or undo.');
}

function assertSquare(game, index) {
  if (!Number.isInteger(index) || index < 0 || index >= game.board.length) {
    throw new Error('Choose a square on the board.');
  }
}

export function placePiece(game, index, type = 'flat') {
  assertActive(game);
  assertSquare(game, index);
  if (!['flat', 'wall', 'cap'].includes(type)) throw new Error('Unknown piece type.');
  if (game.board[index].length) throw new Error('Place new pieces on empty squares only.');
  if (game.ply < 2 && type !== 'flat') throw new Error('The opening two moves must be flat stones.');
  const owner = game.ply < 2 ? 1 - game.turn : game.turn;
  const supply = type === 'cap' ? 'caps' : 'stones';
  if (!game.reserves[owner][supply]) throw new Error('No pieces of this type remain.');
  const next = structuredClone(game);
  next.reserves[owner][supply]--;
  next.board[index].push({ owner, type });
  return finishTurn(next, game.turn);
}

export function moveStack(game, from, direction, drops) {
  assertActive(game);
  assertSquare(game, from);
  if (game.ply < 2) throw new Error('Place an opponent’s flat stone during the opening.');
  if (top(game.board[from])?.owner !== game.turn) throw new Error('Choose a stack with your piece on top.');
  const vectors = { north: [-1, 0], east: [0, 1], south: [1, 0], west: [0, -1] };
  if (!Object.hasOwn(vectors, direction)) throw new Error('Move in a straight, orthogonal direction.');
  if (!Array.isArray(drops) || !drops.length || drops.some(n => !Number.isInteger(n) || n < 1)) {
    throw new Error('Drop at least one piece on every square.');
  }
  const carry = drops.reduce((sum, n) => sum + n, 0);
  if (carry > game.size || carry > game.board[from].length) {
    throw new Error(`Carry at most ${Math.min(game.size, game.board[from].length)} pieces from this stack.`);
  }
  const next = structuredClone(game);
  const hand = next.board[from].splice(-carry);
  let row = Math.floor(from / game.size);
  let col = from % game.size;
  const [dr, dc] = vectors[direction];
  for (const count of drops) {
    row += dr;
    col += dc;
    if (row < 0 || col < 0 || row >= game.size || col >= game.size) {
      throw new Error('The stack cannot move off the board.');
    }
    const destination = next.board[row * game.size + col];
    const landing = top(destination);
    if (landing?.type === 'cap') throw new Error('A capstone cannot be covered.');
    if (landing?.type === 'wall') {
      if (hand.length !== 1 || count !== 1 || hand[0].type !== 'cap') {
        throw new Error('Only a lone capstone can flatten a standing stone.');
      }
      landing.type = 'flat';
    }
    destination.push(...hand.splice(0, count));
  }
  return finishTurn(next, game.turn);
}
