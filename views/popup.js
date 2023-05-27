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

const toggle = document.getElementById('switch');

function setDisabledStatusLight() {
  $('.blob').css('background', 'red');
  $('.blob').css('animation', 'none');
  $('#status').text('Disabled');
}

function setIdleStatusLight() {
  $('.blob').css('animation', 'none');
  $('.blob').css('background', 'limegreen');
  $('#status').text('Idle');
}

function setSolvingStatusLight() {
  $('.blob').css('animation', 'pulse-green 0.5s infinite');
  $('.blob').css('background', 'limegreen');
  $('#status').text('Solving...');
}

// Initialize enabled toggle to stored setting
chrome.storage.local.get(['enabled'], result => {
  if (result.enabled == undefined || result.enabled) {
    toggle.checked = true;
  } else {
    toggle.checked = false;
  }
});

function messageActiveTab(message, callback=() => {}) {
  chrome.tabs.query({ active: true, currentWindow: true }, 
    function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, message, callback)
    }
  );
}

// Set initial status light
messageActiveTab(
  {type: "isBoardPresent"},
  function(response) {
    if (!response) {
      $('.blob').css('background', 'red');
      $('#status').text('No board found!');
      console.warn('No board found! Try reloading?');
      toggle.checked = false;
      toggle.disabled = 'disabled';
    } else {
      chrome.storage.local.get(['isSolving'], result => {
        if (!toggle.checked) {
          setDisabledStatusLight();
        }
        else if (result.isSolving) {
          setSolvingStatusLight();
        } else {
          setIdleStatusLight();
        }
      });
    }
  }
)

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z / 300));
}

function updateEngineEvaluationBar() {
  chrome.storage.local.get(['player_color', 'solver_result'], result => {
    if (result.player_color) {
      var left = result.player_color == 'w' ? 'white' : '#403d39';
      var right = result.player_color == 'w' ? '#403d39' : 'white';
      if (
        result.solver_result != null
        && result.solver_result.evaluation != null
        && result.solver_result.evaluation.includes("M")
      ) {
        var score =  result.solver_result.evaluation[0] == '-' ? -10000 : 10000;
        var text = result.solver_result.evaluation;
      }
      else {
        var score = result.solver_result != undefined ? result.solver_result.evaluation : 0;
        var sign = score > 0 ? '+' : '';
        var text = sign + (score / 100).toFixed(2);
      }
      
      var cutoff = sigmoid(score) * 100;
      $('.evaluation-bar').css(
        'background',  
        `linear-gradient(to right, ${left} 0%, ${left} ${cutoff}%, ${right} ${cutoff}%, ${right} 100%)`
      );
      $('.evaluation').text(text);
    } 
  });
}
updateEngineEvaluationBar();

// Update the status light when solve is started or stopped
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if ("isSolving" in changes && toggle.checked) {
    messageActiveTab(
        {type: "isBoardPresent"},
        function(response) {
          if (response) {
            if (changes.isSolving.newValue) {
              setSolvingStatusLight();
            } else {
              setIdleStatusLight();
            }
          }
        }
      )
  }
  if ("solver_result" in changes) {
    updateEngineEvaluationBar();
  }
  if ("openings" in changes) {
    updateOpeningBookMoves();
  }
  if ("enabled" in changes) {
    if (changes.enabled.newValue) {
      setSolvingStatusLight();
      toggle.checked = true;
    } else {
      setDisabledStatusLight();
      toggle.checked = false;
    }
  }
});

// Enabled toggle listener 
toggle.addEventListener("change", function() {
  if (this.checked) {
    chrome.storage.local.set({enabled: true});
  } else {
    chrome.storage.local.set({enabled: false});
  }
});

function generateOpeningBookElement(opening_move, player_color) {
  var left_color = player_color == 'w' ? '#fff' : '#403d39';
  var right_color = player_color == 'w' ? '#403d39' : '#fff';
  var total_games = opening_move.black + opening_move.draws + opening_move.white;
  var player_wins = player_color == 'w' ? opening_move.white : opening_move.black;
  var opponent_wins = player_color == 'w' ? opening_move.black : opening_move.white;
  var perc_player_win =  player_wins / total_games * 100;
  var perc_draw = opening_move.draws / total_games * 100;
  var perc_opponent_win = opponent_wins / total_games * 100;

  bar_divs = "";
  if (perc_player_win > 0) {
    bar_divs += `
    <div id='win-stats' class="opening-win-stats-white" style="flex-grow: ${perc_player_win.toFixed(1)}; background-color: ${left_color};">
      <span class="opening-win-stats-percent-label">${perc_player_win > 15 ? perc_player_win.toFixed(0) + "%" : ''}</span>
    </div> 
    `
  }
  if (perc_draw > 0) {
    bar_divs += `
    <div id='win-stats' class="opening-win-stats-draw" style="flex-grow: ${perc_draw.toFixed(1)};">
      <span class="opening-win-stats-percent-label">${perc_draw > 15 ? perc_draw.toFixed(0) + "%" : ''}</span>
    </div> 
    `
  }
  if (perc_opponent_win > 0) {
    bar_divs += `
    <div id='win-stats' class="opening-win-stats-black" style="flex-grow: ${perc_opponent_win.toFixed(1)}; background-color: ${right_color};">
      <span class="opening-win-stats-percent-label">${perc_opponent_win > 15 ? perc_opponent_win.toFixed(0) + "%" : ''}</span>
    </div>
    `
  }

  element = $(`
  <li class="opening-moves-list-item" uci_move="${opening_move.uci}" title="">
  <span class="opening-move-san">${opening_move.san}</span>
  <span class="opening-move-total-games">${Intl.NumberFormat('en-US', {notation: "compact", maximumFractionDigits: 1}).format(total_games)}</span>
  <div class="opening-win-stats-bar">
    ${bar_divs}
  </div>
  </li>`);

  if (perc_draw == 100 | perc_player_win == 100 | perc_opponent_win == 100) {
    element.find('#win-stats').css('border-radius', '0.2rem');
  }

  return element;
}

function updateOpeningBookMoves() {
  chrome.storage.local.get(['openings', 'player_color'], result => {
    var opening_book_moves = $('#opening-moves-list');
    opening_book_moves.empty();

    if (result.openings) {
      if (result.openings.opening) {
        opening_book_moves.append(`<li class="opening-moves-list-item" style="padding-bottom: 6px;"><span>${result.openings.opening.name}</span></li>`);
      }
      console.log(result.openings);
      for (var opening of result.openings.moves) {
        element = generateOpeningBookElement(opening, result.player_color);
        element.mouseover(function() { 
          var move = $(this).attr('uci_move');
          messageActiveTab({type: "highlightBookMove", move: move});
        });
        opening_book_moves.append(element);
      }
      opening_book_moves.mouseleave(function() { 
        messageActiveTab({type: "unhighlightBookMove"});
      });
    } else {
      opening_book_moves.append('<p style="text-align:center;">No opening book data available</p>')
    }
  });  
}
updateOpeningBookMoves();