// =======================================
//
//         CHESS.COM STOCKFISH BOT
//
// Chess bot using stockfish to highlight
//        best moves on Chess.com.
//
//             Made by 3kh0
//    https://github.com/3kh0/ChessSword
//
// =======================================

console.log('Loaded content.js');
function waitForElm(selector) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    const observer = new MutationObserver((mutations) => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

last_opening_name = null;
last_solve_time = 0;

function updateCurrentOpenings(fen) {
  // Construct the URL with the query parameters
  const url = `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}`;
  console.log("Loading openings for " + fen);

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok. fen: " + fen);
      }
      return response.json();
    })
    .then((data) => {
      data["color"] = fen.split(" ")[1];
      data["moves"] = data.moves.filter((move) => move.black + move.white + move.draws >= 0);

      if (data.opening) {
        last_opening_name = data.opening.name;
      } else if (last_opening_name) {
        data.opening = { name: last_opening_name };
      }

      if (data.moves.length > 0) {
        chrome.storage.local.set({ openings: data });
      } else {
        chrome.storage.local.set({ openings: null });
      }
    })
    .catch((error) => {
      console.error("There was a problem with the fetch operation:", error);
      chrome.storage.local.set({ openings: null });
    });
}

// Each piece div class looks like this: 'piece wp square-61'. Parse the info from it.
function parsePiecePosition(piece_class_name) {
  var tokens = piece_class_name.split(" ");
  var piece_type = tokens.find(function (token) {
    return token.length == 2;
  });
  var piece_position = tokens.find(function (token) {
    return token.startsWith("square");
  });

  if (piece_type.startsWith("w")) {
    piece_type = piece_type[1].toUpperCase();
  } else {
    piece_type = piece_type[1].toLowerCase();
  }

  var piece_row = 7 - parseInt(piece_position.split("-")[1][1] - 1);
  var piece_col = parseInt(piece_position.split("-")[1][0] - 1);

  return {
    type: piece_type,
    row: piece_row,
    col: piece_col,
    color: piece_type == piece_type.toUpperCase() ? "w" : "b",
  };
}

// Returns 2d matrix of pieces on the board. [0][0] = a8.
function getPiecePositionMatrix() {
  var pieces = $.makeArray($('chess-board > div[class^="piece"]'));
  var piece_matrix = [...Array(8)].map((e) => Array(8).fill(0));
  pieces.map(function (piece) {
    p = parsePiecePosition(piece.className);
    piece_matrix[p.row][p.col] = p.type;
  });
  return piece_matrix;
}

function getFENCastlingString() {
  var piece_matrix = getPiecePositionMatrix();
  options = "";

  if (piece_matrix[7][4] == "K") {
    if (piece_matrix[7][7] == "R") {
      options += "K";
    }
    if (piece_matrix[7][0] == "R") {
      options += "Q";
    }
  }

  if (piece_matrix[0][4] == "k") {
    if (piece_matrix[0][7] == "r") {
      options += "k";
    }
    if (piece_matrix[0][0] == "r") {
      options += "q";
    }
  }

  return options != "" ? options : "-";
}

function getStartingFenString() {
  return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}

function getFENString(active_player_color = null) {
  if (active_player_color == null) {
    var active_player_color = getPlayerColor();
  }
  var piece_matrix = getPiecePositionMatrix();
  var row_fens = [];
  var empty_count = 0;

  for (i = 0; i < 8; i++) {
    var row_fen = "";
    for (j = 0; j < 8; j++) {
      if (piece_matrix[i][j] == 0) {
        empty_count += 1;
      } else {
        if (empty_count > 0) {
          row_fen += empty_count.toString();
          empty_count = 0;
        }
        row_fen += piece_matrix[i][j];
      }
    }
    if (empty_count > 0) {
      row_fen += empty_count.toString();
      empty_count = 0;
    }
    row_fens.push(row_fen);
  }

  var fen = row_fens.join("/");
  fen += " " + active_player_color;
  fen += " " + getFENCastlingString();
  fen += " - 0 1";
  return fen;
}

function clearMoveHighlights() {
  $('chess-board > div[id="move-highlight"]').remove();
}

function clearOpenBookMoveHighlights() {
  $('chess-board > div[move_type="open-book"]').remove();
}

function isOpenBookMoveHighlighted() {
  return $('chess-board > div[move_type="open-book"]').length > 0;
}

function isEngineMoveHighlighted() {
  return $('chess-board > div[move_type="engine"]').length > 0;
}

function _highlightMove(move, color, move_type) {
  clearMoveHighlights();

  var col_letters = ["a", "b", "c", "d", "e", "f", "g", "h"];
  var col1 = col_letters.indexOf(move[0]) + 1;
  var col2 = col_letters.indexOf(move[2]) + 1;

  $(`chess-board > div[class="highlight square-${col1 + move[1]}"]`).remove();
  var div = `<div move_type="${move_type}" id="move-highlight" class="highlight square-${col1 + move[1]}" style="background-color: ${color}; opacity: 0.50;"></div>`;
  $("chess-board").prepend(div);

  $(`chess-board > div[class="highlight square-${col2 + move[3]}"]`).remove();
  div = `<div move_type="${move_type}" id="move-highlight" class="highlight square-${col2 + move[3]}" style="background-color: ${color}; opacity: 0.50"></div>`;
  $("chess-board").prepend(div);
}

function highlightMove(move, move_type = "engine") {
  if (move_type == "engine") {
    chrome.storage.local.get(["engine_highlight_color"], function (result) {
      _highlightMove(move, result.engine_highlight_color, move_type);
    });
  } else if (move_type == "open-book") {
    _highlightMove(move, (color = "rgb(235, 97, 80)"), move_type);
  }
}

function isNewGame() {
  var piece_matrix = getPiecePositionMatrix();
  for (i = 0; i < 8; i++) {
    for (j = 0; j < 2; j++) {
      if (piece_matrix[j][i] == 0) {
        return false;
      }
    }
    for (j = 6; j < 8; j++) {
      if (piece_matrix[j][i] == 0) {
        return false;
      }
    }
  }
  return true;
}

function getPlayerColor() {
  return document.querySelector("chess-board").className.includes("flipped") ? "b" : "w";
}

function getOpponentColor() {
  return getPlayerColor() == "w" ? "b" : "w";
}

function storePlayerColor() {
  var color = getPlayerColor();
  chrome.storage.local.set({
    player_color: color,
  });
}

function newGameReset() {
  console.log("New Game!");
  storePlayerColor();
  clearMoveHighlights();
  last_opening_name = null;
  chrome.storage.local.set({ solver_result: null });
  chrome.runtime.sendMessage({ type: "newGame" });
  if (getPlayerColor() == "w") {
    chrome.runtime.sendMessage({
      type: "startSolve",
      fen_string: getStartingFenString(),
    });
  }
  updateCurrentOpenings(getStartingFenString());
}

function isPieceClassName(class_name) {
  var tokens = class_name.split(" ");
  if (tokens.length != 3) {
    return false;
  }
  var piece_type = tokens.find(function (token) {
    return token.length == 2;
  });
  var piece_position = tokens.find(function (token) {
    return token.startsWith("square");
  });
  return piece_type != undefined && piece_position != undefined;
}

function attachPieceObserverToBoard() {
  var observer_config = {
    attributes: true,
    subtree: true,
    attributeOldValue: true,
    attributeFilter: ["class"],
  };
  var observer = new MutationObserver(function (mutations) {
    if (
      mutations.some(function (mutation) {
        return (mutation.oldValue == "board" || mutation.oldValue == "board-flipped") && mutation.target.className != mutation.oldValue;
      })
    ) {
      newGameReset();
    }

    var move_mutation = mutations.filter(function (mutation) {
      return isPieceClassName(mutation.oldValue) && isPieceClassName(mutation.target.className);
    });
    if (move_mutation.length > 0) {
      console.log("Move detected!");
      if (isNewGame()) {
        newGameReset();
      } else {
        storePlayerColor();
        clearMoveHighlights();
        p_new = parsePiecePosition(move_mutation[0].target.className);
        if (p_new.color != getPlayerColor()) {
          setTimeout(function () {
            const fen = getFENString();
            chrome.runtime.sendMessage({
              type: "startSolve",
              fen_string: fen,
            });
            updateCurrentOpenings(fen);
          }, 300);
        } else {
          setTimeout(function () {
            updateCurrentOpenings(getFENString(getOpponentColor()));
          }, 300);
          chrome.runtime.sendMessage({
            type: "stopSolve",
          });
        }
      }
    }
  });
  var board = document.querySelector("chess-board");
  observer.observe(board, observer_config);
}

function main() {
  newGameReset();
  attachPieceObserverToBoard();
}

waitForElm("chess-board").then((elm) => {
  console.log("Board is loaded!");
  main();
});

// Runtime message listeners
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  switch (message.type) {
    // Popup queries this to check if board detected
    case "isBoardPresent":
      sendResponse({ isBoardPresent: true });
      break;
    // Popup queries this to highlight hovered move
    case "highlightBookMove":
      console.log("Highlighting book move: " + message.move);
      highlightMove(message.move, (move_type = "open-book"));
      sendResponse({});
      break;
    case "unhighlightBookMove":
      clearOpenBookMoveHighlights();
      console.log("unhighlighting book move");
      chrome.storage.local.get(["solver_result", "enabled"], (result) => {
        if (result.solver_result && result.enabled && result.solver_result.fen == getFENString()) {
          highlightMove(result.solver_result.best_move);
        }
      });
      sendResponse({});
      break;
    default:
    // Do nothing
  }
});

// Highlight best move if solver_result updates in db
chrome.storage.onChanged.addListener(function (changes, namespace) {
  if ("solver_result" in changes && changes.solver_result !== undefined && changes.solver_result.newValue !== undefined) {
    last_solve_time = Date.now();
    chrome.storage.local.get(["enabled"], (result) => {
      if (result.enabled && (!isEngineMoveHighlighted() || changes.solver_result.newValue.best_move != changes.solver_result.oldValue.best_move) && !isOpenBookMoveHighlighted() && changes.solver_result.newValue.fen == getFENString()) {
        console.log("Best engine move: " + changes.solver_result.newValue.best_move);
        highlightMove(changes.solver_result.newValue.best_move);
      }
    });
  }
});

// Clear highlights when disabled or start solve when enabled
chrome.storage.onChanged.addListener(function (changes, namespace) {
  if ("enabled" in changes && changes.enabled.newValue == false) {
    clearMoveHighlights();
  } else if ("enabled" in changes && changes.enabled.newValue == true) {
    chrome.runtime.sendMessage({
      type: "startSolve",
      fen_string: getFENString(),
    });
  }
});
