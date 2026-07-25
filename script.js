const ROUND_SECONDS = 45;
const WIN_SCORE = 100;
const CELL_COUNT = 12;
const MILESTONES = [25, 50, 75, 100];

const pointsByKind = {
  can: 10,
  bonus: 20,
  hazard: -10,
};

const feedbackByKind = {
  can: "Clean water collected! +10",
  bonus: "Golden delivery! +20",
  hazard: "Contamination! −10",
};

const scoreElement = document.querySelector("#score");
const timeElement = document.querySelector("#time");
const bestElement = document.querySelector("#best");
const timerCard = document.querySelector("#timer-card");
const feedbackElement = document.querySelector("#feedback");
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const progressPercent = document.querySelector("#progress-percent");
const playfield = document.querySelector("#playfield");
const overlay = document.querySelector("#game-overlay");
const overlayCard = document.querySelector("#overlay-card");
const resetButton = document.querySelector("#reset-button");
const confetti = document.querySelector("#confetti");

let phase = "ready";
let score = 0;
let timeLeft = ROUND_SECONDS;
let activeTarget = null;
let targetId = 0;
let countdownTimer = null;
let spawnTimer = null;
let highScore = Number(localStorage.getItem("water-relay-high-score")) || 0;

bestElement.textContent = highScore;

const cells = Array.from({ length: CELL_COUNT }, (_, index) => {
  const button = document.createElement("button");
  button.className = "game-cell";
  button.type = "button";
  button.tabIndex = -1;
  button.setAttribute("aria-label", "Empty collection spot");
  button.addEventListener("click", () => collectTarget(index));
  playfield.append(button);
  return button;
});

function getTargetKind() {
  const roll = Math.random();
  if (roll < 0.14) return "hazard";
  if (roll < 0.25) return "bonus";
  return "can";
}

function targetMarkup(kind) {
  if (kind === "hazard") {
    return `
      <span class="ground-shadow" aria-hidden="true"></span>
      <span class="dirty-drop" aria-hidden="true"><span></span></span>
    `;
  }

  return `
    <span class="ground-shadow" aria-hidden="true"></span>
    <span class="jerry-can ${kind === "bonus" ? "jerry-can-bonus" : ""}" aria-hidden="true">
      <span class="can-handle"></span>
      <span class="can-cap"></span>
      <span class="can-ridge can-ridge-one"></span>
      <span class="can-ridge can-ridge-two"></span>
      <span class="can-drop"></span>
    </span>
  `;
}

function renderTarget() {
  cells.forEach((cell, index) => {
    const isActive = activeTarget && activeTarget.index === index;
    cell.className = isActive
      ? `game-cell has-${activeTarget.kind}`
      : "game-cell";
    cell.innerHTML = isActive ? targetMarkup(activeTarget.kind) : "";
    cell.tabIndex = isActive ? 0 : -1;

    if (!isActive) {
      cell.setAttribute("aria-label", "Empty collection spot");
    } else if (activeTarget.kind === "hazard") {
      cell.setAttribute("aria-label", "Avoid: contaminated water");
    } else if (activeTarget.kind === "bonus") {
      cell.setAttribute(
        "aria-label",
        "Collect golden jerry can for 20 points",
      );
    } else {
      cell.setAttribute("aria-label", "Collect yellow jerry can for 10 points");
    }
  });

  if (activeTarget) cells[activeTarget.index].focus({ preventScroll: true });
}

function spawnTarget() {
  if (phase !== "playing") return;
  targetId += 1;
  activeTarget = {
    index: Math.floor(Math.random() * CELL_COUNT),
    kind: getTargetKind(),
    id: targetId,
  };
  renderTarget();
}

function updateScoreboard() {
  scoreElement.textContent = score;
  timeElement.textContent = timeLeft;
  bestElement.textContent = highScore;
  timerCard.classList.toggle("urgent", phase === "playing" && timeLeft <= 10);

  const progress = Math.min((score / WIN_SCORE) * 100, 100);
  progressFill.style.width = `${progress}%`;
  progressPercent.textContent = `${Math.round(progress)}%`;
  progressTrack.setAttribute("aria-valuenow", score);

  document.querySelectorAll("[data-milestone]").forEach((milestone) => {
    const value = Number(milestone.dataset.milestone);
    const unlocked = score >= value;
    milestone.classList.toggle("unlocked", unlocked);
    milestone.setAttribute(
      "aria-label",
      `${value} point milestone ${unlocked ? "unlocked" : "locked"}`,
    );
  });
}

function saveHighScore() {
  highScore = Math.max(highScore, score);
  localStorage.setItem("water-relay-high-score", String(highScore));
  bestElement.textContent = highScore;
}

function clearTimers() {
  window.clearInterval(countdownTimer);
  window.clearInterval(spawnTimer);
  countdownTimer = null;
  spawnTimer = null;
}

function startRound() {
  clearTimers();
  phase = "playing";
  score = 0;
  timeLeft = ROUND_SECONDS;
  activeTarget = null;
  feedbackElement.textContent = "Go! Find the yellow jerry cans.";
  resetButton.textContent = "Reset round";
  overlay.classList.add("hidden");
  confetti.replaceChildren();
  updateScoreboard();
  spawnTarget();

  countdownTimer = window.setInterval(() => {
    timeLeft -= 1;
    updateScoreboard();
    if (timeLeft <= 0) {
      endRound(score >= WIN_SCORE ? "won" : "lost");
    }
  }, 1000);

  spawnTimer = window.setInterval(spawnTarget, 720);
}

function collectTarget(index) {
  if (
    phase !== "playing" ||
    !activeTarget ||
    activeTarget.index !== index
  ) {
    return;
  }

  const kind = activeTarget.kind;
  score = Math.max(0, score + pointsByKind[kind]);
  feedbackElement.textContent = feedbackByKind[kind];
  activeTarget = null;
  renderTarget();
  updateScoreboard();

  if (score >= WIN_SCORE) endRound("won");
}

function endRound(result) {
  clearTimers();
  phase = result;
  activeTarget = null;
  renderTarget();
  saveHighScore();
  updateScoreboard();
  overlay.classList.remove("hidden");

  if (result === "won") {
    feedbackElement.textContent =
      "Goal reached! You powered the clean water relay.";
    overlayCard.innerHTML = `
      <span class="overlay-icon win-icon" aria-hidden="true">✓</span>
      <h3>Relay complete!</h3>
      <p>You scored <strong>${score} points</strong> and powered the clean water mission.</p>
      <button type="button" id="overlay-button">Play again</button>
    `;
    launchConfetti();
  } else {
    feedbackElement.textContent =
      `Time’s up! You delivered ${score} points of clean water.`;
    overlayCard.innerHTML = `
      <span class="overlay-icon" aria-hidden="true">${score}</span>
      <h3>Keep the water moving.</h3>
      <p>You were ${Math.max(0, WIN_SCORE - score)} points away.</p>
      <button type="button" id="overlay-button">Try again</button>
    `;
  }

  document.querySelector("#overlay-button").addEventListener("click", startRound);
}

function launchConfetti() {
  confetti.replaceChildren();
  const colors = ["#ffc907", "#2e9df7", "#ffffff"];

  for (let index = 0; index < 42; index += 1) {
    const piece = document.createElement("i");
    piece.style.setProperty("--x", `${(index * 37) % 100}vw`);
    piece.style.setProperty("--delay", `${(index % 9) * 0.08}s`);
    piece.style.setProperty("--drift", `${((index % 7) - 3) * 18}px`);
    piece.style.setProperty("--color", colors[index % colors.length]);
    confetti.append(piece);
  }
}

resetButton.addEventListener("click", startRound);
document.querySelector("#overlay-button").addEventListener("click", startRound);
updateScoreboard();
