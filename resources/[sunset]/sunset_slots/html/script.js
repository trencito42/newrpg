// Template replacement with language
for (let i = 1; i <= 12; i++) {
  $('#target' + i).text(languages[config.language]['target' + i]);
}

const SLOTS_PER_REEL = 12;
const REEL_RADIUS = 209;

var audios = [];
var audioIds = [
  "changeBet",
  "pornestePacanele",
  "alarma",
  "winLine",
  "collect",
  "winDouble",
  "seInvarte",
  "apasaButonul"
];

var coins = 0;
var bet = 50;

var rolling = 0;
var inFlight = false; // one server request at a time (server also enforces this)

function postAction(name, payload, onDone) {
  if (inFlight) return;
  inFlight = true;
  $.ajax({
    url: 'https://sunset_slots/' + name,
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify(payload || {}),
    dataType: 'json',
    success: function(res) { inFlight = false; onDone(res || { ok: false }); },
    error: function() { inFlight = false; onDone({ ok: false }); }
  });
}

function setCoins(n) {
  coins = n;
  $('#ownedCoins').empty().append(coins);
}

function playAudio(audioName) {
  if($('#sounds').is(':checked')) {
    for(var i = 0; i < audioIds.length; i++) {
      if(audioIds[i] == audioName) {
        audios[i].play();
      }
    }
  }
}

function setBet(amount) {
  // Convenience only: the server re-validates the stake against its own list.
  if(amount > 0) {
    if(amount > coins || amount > config.betCap) {
      amount = 50;
    }
    amount = Math.max(50, Math.floor(amount / 50) * 50);
    bet = amount;
    $('#ownedBet').empty().append(bet);
    playAudio("changeBet");
  }
}

var tbl1 = [], tbl2 = [], tbl3 = [], tbl4 = [], tbl5 = [];
var crd1 = [], crd2 = [], crd3 = [], crd4 = [], crd5 = [];

function createSlots(ring, id) {
	var slotAngle = 360 / SLOTS_PER_REEL;
	var seed = getSeed();

	for (var i = 0; i < SLOTS_PER_REEL; i ++) {
		var slot = document.createElement('div');
		var transform = 'rotateX(' + (slotAngle * i) + 'deg) translateZ(' + REEL_RADIUS + 'px)';
		slot.style.transform = transform;

    var imgID = (seed + i)%7 + 1;
    seed = getSeed();
    if (imgID == 7) {
      imgID = (seed + i)%7 + 1;
    }

    slot.className = 'slot' + ' fruit' + imgID;
    slot.id = id + 'id' + i;
		$(slot).empty().append('<p>' + createImage(imgID) + '</p>');

		// add the poster to the row
		ring.append(slot);
	}
}

function createImage(id) {
  return '<img src="img/item' + id + '.png" style="border-radius: 20px;" width=100 height=100>';
}

function getSeed() {
	return Math.floor(Math.random()*(SLOTS_PER_REEL));
}

function setWinner(cls, level) {
  if(level >= 1) {
    var cl = (level == 1) ? 'winner1' : 'winner2';
    $(cls).addClass(cl);
  }
}

function reverseStr(str) {
  return str.split("").reverse().join("");
}

var canDouble = 0;
var colorHistory = [-1];

var dubleDate = 0;

function endWithWin(x, sound, canGamble) {
  $('#win').empty().append(x);
  $('.win').show();

  $('.betUp').empty().append(languages[config.language].red).css({
    "background-color": "#B9384B"
  });
  $('.AllIn').empty().append(languages[config.language].black);
  $('.go').empty().append(languages[config.language].take_money);



  canDouble = x;

  if (canGamble === false) {
    $('.betUp').prop("disabled",true).css({
      "background": "#ccc",
    });
    $('.AllIn').prop("disabled",true).css({
      "background": "#ccc",
    });
  }

  if(sound == 1) { // WinAtDouble
    playAudio("winDouble");
  }
}

function looseDouble() {
  canDouble = 0;
  dubleDate = 0;
  $('.win').hide();

  $('.betUp').empty().append(languages[config.language].more_bet).css("background-color", "#4F4B4B").prop("disabled",false);
  $('.AllIn').empty().append(languages[config.language].allin).css("background-color", "#011627").prop("disabled",false);
  $('.go').empty().append(languages[config.language].roll);
}

function showHistory(drawn) {
  colorHistory[colorHistory.length] = drawn;
  var pls = 1;
  for(var cont = colorHistory.length; cont >= colorHistory.length-8; cont--) {
    var imgColor = "none";
    if(colorHistory[cont] == 1) { imgColor = 'black'; }
    if(colorHistory[cont] == 0) { imgColor = 'red'; }
    $('#h' + pls).empty();
    if(imgColor !== "none") {
      $('#h' + pls).append("<img src='img/" + imgColor + ".png' width=30px height=30px/>");
      pls++;
    }
  }
}

function voteColor(color) {
  postAction('gamble', { color: color }, function(res) {
    if (!res.ok) { return; }
    showHistory(res.drawn);
    setCoins(res.balance);
    if (res.won && res.pending > 0) {
      endWithWin(res.pending, 1, res.canGamble);
    } else if (res.won && res.autoCollected > 0) {
      playAudio("winDouble");
      playAudio("collect");
      looseDouble();
    } else {
      looseDouble();
    }
  });
}

function circDist(a, b) {
  var d = Math.abs(a - b) % SLOTS_PER_REEL;
  return Math.min(d, SLOTS_PER_REEL - d);
}

// Animates the reels so that the three visible cells of every reel show the
// SERVER-provided grid[reel][row] (symbols 1..7). The client chooses nothing.
function spin(timer, grid, res) {
  playAudio("seInvarte");
  var cords = [[], [], [], [], []];
  for(var i = 1; i < 6; i ++) {
    var oldSeed = -1;
    var oldClass = $('#ring'+i).attr('class');
    if(oldClass.length > 4) {
      oldSeed = parseInt(oldClass.slice(10));
    }
    var seed = getSeed();
    while(oldSeed >= 0 && circDist(oldSeed, seed) < 3) {
      seed = getSeed();
    }
    var pSeed = seed;
    var z = 2;
    for(var j = 1; j <= 5; j++) {
      pSeed += 1;
      if(pSeed == 12) { pSeed = 0; }
      if(j >= 3) {
        var sym = grid[i - 1][z];
        var cell = $('#' + i + 'id' + pSeed);
        cell.attr('class', 'slot fruit' + sym);
        cell.empty().append('<p>' + createImage(sym) + '</p>');
        cords[i - 1][z] = '#' + i + 'id' + pSeed;
        z -= 1;
      }
    }
    $('#ring'+i)
      .css('animation','back-spin 1s, spin-' + seed + ' ' + (timer + i*0.5) + 's')
      .attr('class','ring spin-' + seed);
  }

  var wins = res.wins || [];
  var lineCount = res.lines || wins.length;
  wins.forEach(function(line) {
    line.forEach(function(rc) {
      setTimeout(setWinner, 3200 + 0.4 * 1000 + 0.3 * 1000, cords[rc[0] - 1][rc[1] - 1], lineCount);
    });
  });
  // Server rows are 1-based top->bottom; cords rows were stored z=0..2 with
  // z=0 = first row. Row index above is therefore rc[1]-1.
  if (res.win > 0) {
    if (lineCount > 1) {
      setTimeout(playAudio, 3200 + 0.6 * 1000 + 0.3, "alarma");
    } else {
      setTimeout(playAudio, 3200 + 0.6 * 1000 + 0.3, "winLine");
    }
    setTimeout(endWithWin, 4400, res.win, 0, res.canGamble);
  }
  setTimeout(function(){ rolling = 0; }, 4500);
}

function pressROLL() {
  if(rolling == 0 && !inFlight) {
    if(canDouble == 0) {
      playAudio("apasaButonul");
      $('.slot').removeClass('winner1 winner2');
      if(coins >= bet && coins !== 0) {
        rolling = 1;
        postAction('spin', { bet: bet }, function(res) {
          if (!res.ok || !res.grid) {
            rolling = 0;
            if (typeof res.balance === 'number') { setCoins(res.balance); }
            return;
          }
          setCoins(res.balance);
          spin(2, res.grid, res);
        });
      } else if(bet != coins && bet != 50) {
        setBet(coins);
      }
    } else {
      postAction('collect', {}, function(res) {
        if (!res.ok) { return; }
        playAudio("collect");
        setTimeout(setCoins, 200, res.balance);
        looseDouble();
      });
    }
  }
}

function pressBLACK() {
  if(canDouble == 0) {
    setBet(Math.min(coins, config.betCap));
  } else {
    voteColor(1);
  }
}

function pressRED() {
  if(canDouble == 0) {
    setBet(bet + 50);
  } else {
    voteColor(0);
  }
}

var allFile;

function resetRings() {
  var rng1 = $("#ring1"),
      rng2 = $("#ring2"),
      rng3 = $("#ring3"),
      rng4 = $("#ring4"),
      rng5 = $("#ring5");

  rng1.empty()
    .removeClass()
    .addClass("ring")
    .removeAttr('id')
    .attr('id', 'ring1');

  rng2.empty()
    .removeClass()
    .addClass("ring")
    .removeAttr('id')
    .attr('id', 'ring2');

  rng3.empty()
    .removeClass()
    .addClass("ring")
    .removeAttr('id')
    .attr('id', 'ring3');

  rng4.empty()
    .removeClass()
    .addClass("ring")
    .removeAttr('id')
    .attr('id', 'ring4');

  rng5.empty()
    .removeClass()
    .addClass("ring")
    .removeAttr('id')
    .attr('id', 'ring5');

  createSlots($('#ring1'), 1);
  createSlots($('#ring2'), 2);
  createSlots($('#ring3'), 3);
  createSlots($('#ring4'), 4);
  createSlots($('#ring5'), 5);
}

function togglePacanele(start, banuti) {
  if(start == true) {
    allFile.css("display", "block");
    playAudio("pornestePacanele");
    setCoins(banuti);
    canDouble = 0;
    looseDouble();

    resetRings();

    rolling = 1;
    setTimeout(function(){ rolling = 0; }, 4000);
  } else {
    allFile.css("display", "none");
    $.post("https://sunset_slots/exitWith", JSON.stringify({}));
    setCoins(0);
  }
}

window.addEventListener('message', function(event) {
  if(event.data.showPacanele == "open") {
    var introdusi = event.data.coinAmount;
    togglePacanele(true, introdusi);
  }
});


$(document).ready(function() {
	allFile = $("#stage");
  allFile.css("display", "none");
  createSlots($('#ring1'), 1);
 	createSlots($('#ring2'), 2);
 	createSlots($('#ring3'), 3);
 	createSlots($('#ring4'), 4);
 	createSlots($('#ring5'), 5);
  for(var i = 0; i < audioIds.length; i++) {
    audios[i] = document.createElement('audio');
    audios[i].setAttribute('src', 'audio/' + audioIds[i] + '.mp3');
    audios[i].volume = 0.6;
    if(audioIds[i] == "seInvarte") {
      audios[i].volume = 0.09;
    }
  }

  $('.win').hide();

  $('#ownedCoins').empty().append(coins);
  $('#ownedBet').empty().append(bet);

  $('body').keyup(function(e){
    $(':focus').blur();
    switch (e.keyCode) {
      case 32: pressROLL(); // space
        break;
      case 13: pressROLL(); // enter
        break;
      case 37: pressRED(); // left-arrow
        break;
      case 39: pressBLACK(); // right-arrow
        break;
      case 38: setBet(bet + 50); // creste BET
        break;
      case 40: setBet(bet - 50); // scade BET
        break;
      case 27: togglePacanele(false, 0); // ESC
        break;
      case 80: togglePacanele(false, 0); // P - Pause Menu
        break;
    }
  });

  $('.betUp').on('click', function(){ // RED
    pressRED();
  })

  $('.AllIn').on('click', function(){ // BLACK
    pressBLACK();
  })

 	$('.go').on('click',function(){ // COLLECT
    pressROLL();
 	})
 });
