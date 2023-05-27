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

color_picker = $("#color-picker-input");
max_depth_input = $("#max-depth-input");
max_depth = $("#max-depth");

chrome.storage.local.get(["engine_highlight_color"], (result) => {
  console.log("Engine move highlight color set to " + result.engine_highlight_color);
  color_picker.val(result.engine_highlight_color);
});
chrome.storage.local.get(["max_depth"], (result) => {
  console.log("Max depth set to " + result.max_depth);
  max_depth_input.val(result.max_depth);
  max_depth.text(result.max_depth);
});

color_picker.change(function (event) {
  console.log("Engine move highlight color set to " + event.target.value);
  chrome.storage.local.set({ engine_highlight_color: event.target.value });
});
max_depth_input.on("input", function (event) {
  console.log(event.target.value);
  chrome.storage.local.set({ max_depth: event.target.value });
  max_depth.text(event.target.value);
});
