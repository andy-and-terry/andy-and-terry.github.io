// Classic Snake on a canvas grid.
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const CELL = 20;
const COLS = canvas.width / CELL;
const ROWS = canvas.height / CELL;
const TICK_MS = 120;

let snake, direction, nextDirection, food, score, gameOver, timer;

function randomCell() {
  return {
    x: Math.floor(Math.random() * COLS),
    y: Math.floor(Math.random() * ROWS),
  };
}

function placeFood() {
  let cell;
  do {
    cell = randomCell();
  } while (snake.some((s) => s.x === cell.x && s.y === cell.y));
  return cell;
}

function reset() {
  snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
  direction = { x: 1, y: 0 };
  nextDirection = direction;
  food = placeFood();
  score = 0;
  gameOver = false;
  statusEl.textContent = "Score: 0";
}

function step() {
  if (gameOver) return;

  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) {
    gameOver = true;
    statusEl.textContent = `Game over! Score: ${score} — press Space to restart`;
    draw();
    return;
  }

  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    score += 1;
    statusEl.textContent = `Score: ${score}`;
    food = placeFood();
  } else {
    snake.pop();
  }

  draw();
}

function draw() {
  ctx.fillStyle = "#14171f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ff6b6b";
  ctx.fillRect(food.x * CELL, food.y * CELL, CELL - 1, CELL - 1);

  ctx.fillStyle = "#7c8cff";
  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? "#93a1ff" : "#7c8cff";
    ctx.fillRect(seg.x * CELL, seg.y * CELL, CELL - 1, CELL - 1);
  });
}

const KEY_DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

document.addEventListener("keydown", (e) => {
  if (e.key === " " && gameOver) {
    reset();
    return;
  }
  const dir = KEY_DIRECTIONS[e.key];
  if (!dir) return;
  // Ignore reversing directly into the snake's own body.
  if (dir.x === -direction.x && dir.y === -direction.y) return;
  nextDirection = dir;
});

reset();
draw();
setInterval(step, TICK_MS);
