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

try {
  console.log("Loading scripts...");
  importScripts("./lib/chess.js", "./background.js");
} catch (e) {
  console.error(e);
}