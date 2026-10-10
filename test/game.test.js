import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, flatCounts, moveStack, placePiece, roadPath, SUPPLIES } from '../public/game.js';

const flat = owner => ({ owner, type: 'flat' });
const wall = owner => ({ owner, type: 'wall' });
const cap = owner => ({ owner, type: 'cap' });
const midgame = (size = 5) => ({ ...createGame(size), ply: 2 });

test('standard board sizes have independent stacks and correct reserves', () => {
  for (const size of [3, 4, 5, 6, 8]) {
    const game = createGame(size);
    assert.equal(game.board.length, size * size);
    assert.deepEqual(game.reserves, [SUPPLIES[size], SUPPLIES[size]]);
    assert.notEqual(game.reserves[0], game.reserves[1]);
    assert.notEqual(game.board[0], game.board[1]);
  }
  assert.throws(() => createGame(7), /Unsupported/);
});

test('opening swaps colors and deducts the opponent’s reserve without mutating input', () => {
  const original = createGame();
  const first = placePiece(original, 0);
  assert.deepEqual(first.board[0], [flat(1)]);
  assert.equal(first.reserves[1].stones, 20);
  assert.equal(original.board[0].length, 0);
  const second = placePiece(first, 1);
  assert.deepEqual(second.board[1], [flat(0)]);
  assert.equal(second.turn, 0);
  assert.deepEqual(placePiece(second, 2, 'wall').board[2], [wall(0)]);
  assert.throws(() => placePiece(original, 0, 'wall'), /opening/);
  assert.throws(() => moveStack(first, 0, 'east', [1]), /opening/);
});

test('placements require an empty square, valid piece, and available reserve', () => {
  const game = midgame();
  game.board[0] = [flat(0)];
  assert.throws(() => placePiece(game, 0), /empty/);
  assert.throws(() => placePiece(game, -1), /square/);
  assert.throws(() => placePiece(game, 1, 'invalid'), /Unknown/);
  game.reserves[0].stones = 0;
  assert.throws(() => placePiece(game, 1, 'wall'), /No pieces/);
  assert.deepEqual(placePiece(game, 1, 'cap').board[1], [cap(0)]);
  assert.throws(() => placePiece(midgame(3), 1, 'cap'), /No pieces/);
});

test('stack spreads preserve bottom-to-top order and leave uncarried stones behind', () => {
  const game = midgame();
  game.board[10] = [flat(1), flat(0), flat(1), cap(0)];
  game.board[11] = [flat(1)];
  const next = moveStack(game, 10, 'east', [1, 2]);
  assert.deepEqual(next.board[10], [flat(1)]);
  assert.deepEqual(next.board[11], [flat(1), flat(0)]);
  assert.deepEqual(next.board[12], [flat(1), cap(0)]);
  assert.equal(next.turn, 1);
  assert.equal(game.board[10].length, 4);
});

test('movement enforces ownership, carry limits, valid drops and board edges', () => {
  const game = midgame(3);
  game.board[0] = [flat(1), flat(0), flat(0), flat(0)];
  game.board[1] = [flat(1)];
  assert.throws(() => moveStack(game, 1, 'south', [1]), /your piece/);
  assert.throws(() => moveStack(game, 0, 'east', [4]), /Carry/);
  assert.throws(() => moveStack(game, 0, 'east', [1, 0]), /at least one/);
  assert.throws(() => moveStack(game, 0, 'east', [1.5]), /at least one/);
  assert.throws(() => moveStack(game, 0, 'east', []), /at least one/);
  assert.throws(() => moveStack(game, 0, 'diagonal', [1]), /orthogonal/);
  assert.throws(() => moveStack(game, 0, 'west', [1]), /off the board/);
  assert.throws(() => moveStack(game, 0, 'north', [1]), /off the board/);
  assert.throws(() => moveStack(game, 0, 'east', [1, 1, 1]), /off the board/);
  assert.equal(game.board[0].length, 4);
  assert.equal(game.board[2].length, 0);
});

test('capstones cannot be covered and only a final lone capstone flattens walls', () => {
  const game = midgame();
  game.board[10] = [flat(0), flat(1), cap(0)];
  game.board[11] = [wall(1)];
  game.board[12] = [wall(1)];
  assert.throws(() => moveStack(game, 10, 'east', [2]), /lone capstone/);
  const next = moveStack(game, 10, 'east', [1]);
  assert.deepEqual(next.board[11], [flat(1), cap(0)]);
  assert.deepEqual(game.board[11], [wall(1)]);
  assert.throws(() => moveStack(game, 10, 'east', [1, 1]), /lone capstone/);
  game.board[11] = [flat(1)];
  const spread = moveStack(game, 10, 'east', [1, 1]);
  assert.deepEqual(spread.board[12], [flat(1), cap(0)]);
  game.board[11] = [cap(1)];
  assert.throws(() => moveStack(game, 10, 'east', [1]), /cannot be covered/);
  game.board[10] = [wall(0)];
  game.board[11] = [wall(1)];
  assert.throws(() => moveStack(game, 10, 'east', [1]), /lone capstone/);
});

test('roads use visible flats and capstones, not walls or diagonal connections', () => {
  const game = midgame(3);
  game.board[0] = [flat(1), flat(0)];
  game.board[1] = [cap(0)];
  game.board[2] = [flat(0)];
  assert.deepEqual(new Set(roadPath(game, 0)), new Set([0, 1, 2]));
  game.board[1] = [wall(0)];
  assert.deepEqual(roadPath(game, 0), []);
  game.board[1] = [];
  game.board[2] = [];
  game.board[4] = [flat(0)];
  game.board[8] = [flat(0)];
  assert.deepEqual(roadPath(game, 0), []);
  game.board[3] = [cap(0)];
  game.board[6] = [flat(0)];
  assert.equal(roadPath(game, 0).length, 3);
});

test('road wins immediately and prevents further moves', () => {
  const game = midgame(3);
  game.board[0] = [flat(0)];
  game.board[1] = [flat(0)];
  const next = placePiece(game, 2);
  assert.equal(next.result.winner, 0);
  assert.equal(next.result.reason, 'road');
  assert.throws(() => placePiece(next, 3), /ended/);
  assert.throws(() => moveStack(next, 0, 'south', [1]), /ended/);
});

test('the mover wins simultaneous roads', () => {
  const game = midgame(3);
  game.board[0] = [flat(1)];
  game.board[1] = [flat(1), flat(0)];
  game.board[2] = [flat(1)];
  game.board[3] = [flat(0)];
  game.board[5] = [flat(0)];
  const next = moveStack(game, 1, 'south', [1]);
  assert.equal(roadPath(next, 0).length, 3);
  assert.equal(roadPath(next, 1).length, 3);
  assert.equal(next.result.winner, 0);
});

test('uncovering an opponent’s road awards the opponent the win', () => {
  const game = midgame(3);
  game.board[0] = [flat(1)];
  game.board[1] = [flat(1), flat(0)];
  game.board[2] = [flat(1)];
  assert.equal(moveStack(game, 1, 'south', [1]).result.winner, 1);
});

test('flat scoring excludes capstones, walls and buried stones', () => {
  const game = midgame();
  game.board[0] = [flat(1), flat(0)];
  game.board[1] = [cap(0)];
  game.board[2] = [wall(0)];
  game.board[3] = [flat(1)];
  assert.deepEqual(flatCounts(game), [1, 1]);
  game.reserves[0] = { stones: 1, caps: 0 };
  const next = placePiece(game, 4);
  assert.deepEqual(next.result, { winner: 0, reason: 'flats', counts: [2, 1] });
});

test('using all stones does not end a game if a capstone remains', () => {
  const game = midgame();
  game.reserves[0] = { stones: 1, caps: 1 };
  assert.equal(placePiece(game, 0).result, null);
});

test('a full board triggers flat scoring, including draws', () => {
  const game = midgame(3);
  game.board = Array.from({ length: 9 }, () => [wall(1)]);
  game.board[8] = [];
  game.board[0] = [flat(1)];
  assert.deepEqual(placePiece(game, 8).result, { winner: null, reason: 'flats', counts: [1, 1] });
});

test('roads take priority over reserve exhaustion', () => {
  const game = midgame(3);
  game.board[0] = [flat(0)];
  game.board[1] = [flat(0)];
  game.reserves[0].stones = 1;
  assert.equal(placePiece(game, 2).result.reason, 'road');
});
