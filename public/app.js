import { createGame, flatCounts, moveStack, placePiece, top } from './game.js';

const $ = id => document.getElementById(id);
const names = ['Ivory', 'Walnut'];
let game = createGame();
let history = [];
let mode = 'place';
let pieceType = 'flat';
let selected = null;
let destinations = new Map();

function coordinate(index) {
  return `${String.fromCharCode(65 + index % game.size)}${game.size - Math.floor(index / game.size)}`;
}

function feedback(message, error = false) {
  $('feedback').textContent = message;
  $('feedback').classList.toggle('error', error);
}

function readDrops() {
  const value = $('drops').value.trim();
  if (!/^\d+(\s*,\s*\d+)*$/.test(value)) return null;
  const drops = value.split(',').map(Number);
  return drops.every(n => n > 0) && drops.reduce((a, b) => a + b, 0) === Number($('carry').value) ? drops : null;
}

function updateDestinations() {
  destinations = new Map();
  const drops = readDrops();
  if (mode !== 'move' || selected === null || !drops || game.result) return;
  for (const [direction, dr, dc] of [['north', -1, 0], ['east', 0, 1], ['south', 1, 0], ['west', 0, -1]]) {
    const row = Math.floor(selected / game.size) + dr * drops.length;
    const col = selected % game.size + dc * drops.length;
    if (row < 0 || row >= game.size || col < 0 || col >= game.size) continue;
    try {
      moveStack(game, selected, direction, drops);
      destinations.set(row * game.size + col, direction);
    } catch {
      // Illegal directions are not offered as destinations.
    }
  }
}

function renderBoard() {
  updateDestinations();
  $('board').style.setProperty('--size', game.size);
  $('column-labels').style.setProperty('--size', game.size);
  $('row-labels').style.setProperty('--size', game.size);
  $('column-labels').replaceChildren(...Array.from({ length: game.size }, (_, col) => {
    const label = document.createElement('span');
    label.textContent = String.fromCharCode(65 + col);
    return label;
  }));
  $('row-labels').replaceChildren(...Array.from({ length: game.size }, (_, row) => {
    const label = document.createElement('span');
    label.textContent = game.size - row;
    return label;
  }));
  $('board').replaceChildren(...game.board.map((stack, index) => {
    const square = document.createElement('button');
    square.className = `square ${(Math.floor(index / game.size) + index % game.size) % 2 ? 'dark-square' : ''}`;
    square.classList.toggle('source', selected === index);
    square.classList.toggle('destination', destinations.has(index));
    square.classList.toggle('road-square', game.result?.path?.includes(index) ?? false);
    square.disabled = Boolean(game.result);
    const description = stack.length ? stack.map(p => `${names[p.owner]} ${p.type === 'cap' ? 'capstone' : p.type === 'wall' ? 'standing stone' : 'flat'}`).join(', ') : 'empty';
    square.setAttribute('aria-label', `${coordinate(index)}: ${description}${destinations.has(index) ? ', legal destination' : ''}`);
    square.title = `${coordinate(index)} · ${description}${stack.length ? ' (bottom to top)' : ''}`;
    stack.slice(-5).forEach((piece, level, shown) => {
      const token = document.createElement('span');
      token.className = `stone ${piece.type} ${piece.owner === 0 ? 'ivory' : 'walnut'}`;
      token.style.setProperty('--lift', `${(shown.length - 1 - level) * 5}px`);
      token.setAttribute('aria-hidden', 'true');
      square.append(token);
    });
    if (stack.length > 1) {
      const count = document.createElement('span');
      count.className = 'stack-count';
      count.textContent = stack.length;
      count.setAttribute('aria-hidden', 'true');
      square.append(count);
    }
    square.addEventListener('click', () => playSquare(index));
    return square;
  }));
}

function render() {
  const opening = game.ply < 2;
  const owner = opening ? 1 - game.turn : game.turn;
  $('board-label').textContent = `${game.size} × ${game.size} board`;
  $('size-caption').textContent = `Carry limit: ${game.size}`;
  $('turn-number').textContent = `Turn ${game.ply + 1}`;
  $('phase').textContent = game.result ? 'GAME COMPLETE' : opening ? 'OPENING SWAP' : 'YOUR MOVE';
  $('status').textContent = game.result
    ? game.result.winner === null ? 'A beautiful draw.' : `${names[game.result.winner]} wins!`
    : `${names[game.turn]}’s turn`;
  $('instruction').textContent = game.result
    ? game.result.reason === 'road' ? 'An unbroken road. Well played.' : `Flat count: Ivory ${game.result.counts[0]} · Walnut ${game.result.counts[1]}.`
    : opening ? `Place a ${names[owner].toLowerCase()} flat stone on any empty square.` : 'Place a piece or move a stack to shape your road.';
  $('undo').disabled = history.length === 0;
  $('place-mode').classList.toggle('active', mode === 'place');
  $('move-mode').classList.toggle('active', mode === 'move');
  $('place-mode').setAttribute('aria-pressed', mode === 'place');
  $('move-mode').setAttribute('aria-pressed', mode === 'move');
  $('move-mode').disabled = opening || Boolean(game.result);
  $('place-mode').disabled = Boolean(game.result);
  $('placement-controls').hidden = mode !== 'place';
  $('movement-controls').hidden = mode !== 'move';
  document.querySelectorAll('[data-piece]').forEach(button => {
    const type = button.dataset.piece;
    button.disabled = Boolean(game.result) || (opening && type !== 'flat') || !game.reserves[owner][type === 'cap' ? 'caps' : 'stones'];
    button.classList.toggle('selected', type === pieceType);
    button.setAttribute('aria-pressed', type === pieceType);
    button.querySelector('.piece-demo').classList.toggle('ivory', owner === 0);
    button.querySelector('.piece-demo').classList.toggle('walnut', owner === 1);
  });
  const flats = flatCounts(game);
  $('players').replaceChildren(...names.map((name, player) => {
    const row = document.createElement('div');
    row.className = `player-row ${!game.result && game.turn === player ? 'current-player' : ''}`;
    const avatar = document.createElement('span');
    avatar.className = `player-avatar ${player === 0 ? 'ivory' : 'walnut'}`;
    const details = document.createElement('div');
    const label = document.createElement('strong');
    label.textContent = name;
    const score = document.createElement('small');
    score.textContent = `${flats[player]} visible flat${flats[player] === 1 ? '' : 's'}`;
    details.append(label, score);
    const reserve = document.createElement('div');
    reserve.className = 'reserve';
    const stones = document.createElement('strong');
    stones.textContent = `${game.reserves[player].stones}`;
    const caps = document.createElement('small');
    caps.textContent = `${game.reserves[player].caps} capstone${game.reserves[player].caps === 1 ? '' : 's'}`;
    reserve.append(stones, caps);
    row.append(avatar, details, reserve);
    return row;
  }));
  renderBoard();
}

function resetSelection() {
  selected = null;
  $('carry').value = 1;
  $('carry').max = 1;
  $('carry-value').textContent = 1;
  $('drops').value = '1';
}

function commit(next, message) {
  history.push(game);
  game = next;
  resetSelection();
  render();
  feedback(game.result ? 'Game complete. Start a new game to play again, or undo the last move.' : message);
}

function playSquare(index) {
  try {
    if (mode === 'place') {
      commit(placePiece(game, index, pieceType), `Piece placed on ${coordinate(index)}. ${names[game.turn === 0 ? 1 : 0]} plays next.`);
    } else if (destinations.has(index)) {
      commit(moveStack(game, selected, destinations.get(index), readDrops()), `Stack moved to ${coordinate(index)}. Next player’s turn.`);
    } else if (top(game.board[index])?.owner === game.turn) {
      selected = index;
      $('carry').max = Math.min(game.size, game.board[index].length);
      $('carry').value = 1;
      $('carry-value').textContent = 1;
      $('drops').value = '1';
      renderBoard();
      feedback(`Selected ${coordinate(index)}. Choose your carry and drops, then a highlighted destination.`);
    } else {
      throw new Error('Select a stack you control or a highlighted destination.');
    }
  } catch (error) {
    feedback(error.message, true);
  }
}

for (const action of ['place', 'move']) {
  $(`${action}-mode`).addEventListener('click', () => {
    mode = action;
    resetSelection();
    render();
    feedback(action === 'place' ? 'Choose a piece, then an empty square.' : 'Choose a stack with your color on top.');
  });
}
document.querySelectorAll('[data-piece]').forEach(button => {
  button.addEventListener('click', () => {
    pieceType = button.dataset.piece;
    render();
    feedback('Choose an empty square to place your piece.');
  });
});
$('carry').addEventListener('input', () => {
  $('carry-value').textContent = $('carry').value;
  $('drops').value = $('carry').value;
  renderBoard();
  feedback(destinations.size ? 'Click a highlighted destination, or adjust your drops.' : 'No legal destination for this pattern. Try a different carry or drop pattern.');
});
$('drops').addEventListener('input', () => {
  renderBoard();
  feedback(!readDrops() ? 'Enter positive drop counts that add up to the carry count.' : destinations.size ? 'Click a highlighted destination to spread the stack.' : 'No legal destination for this pattern.', !readDrops());
});
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  game = history.pop();
  mode = 'place';
  pieceType = 'flat';
  resetSelection();
  render();
  feedback('Last move undone.');
});
$('new-game').addEventListener('click', () => {
  if (game.ply && !game.result && !window.confirm('End this game and start a new one?')) return;
  game = createGame(Number($('board-size').value));
  history = [];
  mode = 'place';
  pieceType = 'flat';
  resetSelection();
  render();
  feedback('New game. Ivory places a walnut flat stone first.');
});
for (const id of ['rules-open', 'rules-bottom']) $(id).addEventListener('click', () => $('rules-dialog').showModal());
$('rules-close').addEventListener('click', () => $('rules-dialog').close());
$('rules-dialog').addEventListener('click', event => {
  if (event.target === $('rules-dialog')) {
    const bounds = $('rules-dialog').getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('rules-dialog').close();
  }
});
render();
feedback('Opening swap: place a walnut flat stone on an empty square.');
