var socket = io(); // Initalize socket.io

// Name input elements
var nameElm;
var languageElm;
var occupationElm;
var foodElm;
var gameElm;
var inQueueElm;
var notFilledElm;

// When window loads...
window.addEventListener("load", () => {
  // Initialize input elements
  nameElm = document.getElementById("name");
  languageElm = document.getElementById("language");
  occupationElm = document.getElementById("occupation");
  foodElm = document.getElementById("food");
  gameElm = document.getElementById("game");
  inQueueElm = document.getElementById("inQueue");
  notFilledElm = document.getElementById("notFilled");
});

var inGame = false;

function joinGame(live) {
  // Get input values
  var s = {
    live: live,
    name: nameElm.value,
    language: languageElm.value,
    occupation: occupationElm.value,
    food: foodElm.value,
    game: gameElm.value
  };

  // Verify
  if (
    !inGame &&
    s.name.length > 0 &&
    s.language.length > 0 &&
    s.occupation.length > 0 &&
    s.food.length > 0 &&
    s.game.length > 0
  ) {
    socket.emit('queue', s); // Request to join the queue
    inQueueElm.style.display = "inline"; // In queue element
    notFilledElm.style.display = "none";
  } else {
    notFilledElm.style.display = "inline";
  }
}

// Globals
var user1Pos = 0;
var user1Info = []; // Revealed information for player 1
var user2Pos = 0;
var user2Info = []; // Revealed information for player 2
var ballX = 0;
var ballY = 0;
var currentText = ""; // Current text to show up in middle

// Connected to a game
socket.on('connected', (msg) => {
  document.getElementById("screen1").style.display = "none"; // Hide instructions
  document.getElementById("screen2").style.display = "inline"; // Show canvas
  inQueueElm.style.display = "none"; // Hide in queue elem
  inGame = true;
});

// Data sent each server tick
socket.on('game info', (msg) => {
  user1Pos = msg.user1Pos;
  user1Info = msg.user1Info;
  user2Pos = msg.user2Pos;
  user2Info = msg.user2Info;
  ballX = msg.ballX;
  ballY = msg.ballY;
  currentText = msg.currentText;

  // Play pong sound when ball hits a paddle
  if (msg.pongSound) {
    pongSound.play();
  }

  // Play wall sound when ball hits a wall
  if (msg.wallSound) {
    wallSound.play();
  }
});

var s; // Display scale (ratio - 16:9)

var pongSound;
var wallSound;

// Initialize p5.js
function setup() {
  // Initialize/load audio
  pongSound = loadSound("pong.mp3");
  pongSound.setVolume(0.9);
  wallSound = loadSound("wall.mp3");
  wallSound.setVolume(0.7);

  // Create canvas
  let ifW = document.body.clientWidth/16; // How much to scale if going by width
  let ifH = document.body.clientHeight/9; // How much to scale if going by height
	s = ifW < ifH ? ifW : ifH; // Choose which scale to go by
	var canvas = createCanvas(16*s, 9*s); // Initialize canvas
  canvas.parent("screen2"); // Parent canvas to screen2 div
}

// On window resized
function windowResized() {
  // Resize canvas
  let ifW = document.body.clientWidth/16; // How much to scale if going by width
  let ifH = document.body.clientHeight/9; // How much to scale if going by height
	s = ifW < ifH ? ifW : ifH; // Choose which scale to go by based on which is smaller
	resizeCanvas(16*s, 9*s); // Resize canvas
}

var lastDir = 0; // The last direction the player went - used to reduce unnecessary calls to server

function draw() {
	background(0); // Set background to black
  
  // If player is in a game
  if (inGame) {
    // Test for UP controls
    let up = (
      keyIsDown(87) || // W
      keyIsDown(65) || // A
      keyIsDown(38) || // Up Arrow
      keyIsDown(37) // Left Arrow
    );

    // Test for DOWN controls
    let down = (
      keyIsDown(83) || // S
      keyIsDown(68) || // D
      keyIsDown(40) || // Down Arrow
      keyIsDown(39) // Right Arrow
    )

    // Get direction - up biased
    let dir = up ? -1 : (down ? 1 : 0);

    // Send direction to server if different than last direction
    if (dir !== lastDir) {
      socket.emit('move dir', dir);
      lastDir = dir;
    }

    // Draw midline
    for (let i = 0; i < 20; i++) {
      push();
      noStroke();
      fill(138, 0, 7);
      rect(7.95*s, 9/20*i*s, 0.075*s, 9/20*0.85*s);
      pop();
    }

    // Draw userInfo
    let beginnings = ["Name", "Programming Language", "Occupation", "Food", "Game"];
    for (let i = 0; i < 2; i++) {
      let isUser1 = i === 0;
      push();
      textAlign(isUser1 ? LEFT : RIGHT);
      textSize(0.2588996763754045*s);
      fill(255);
      let textX = isUser1 ? 1.1*s : 14.9*s;
      let userInfo = isUser1 ? user1Info : user2Info;
      for (let j = 0; j < 5; j++) {
        text(beginnings[j]+": " + (userInfo.length > j ? userInfo[j] : "???"), textX, (1+0.5*j)*s)
      }
      pop();
    }

    // Draw users/paddles
    push();
    noStroke();
    fill(255);
    rect(0.75*s, (user1Pos+3.5)*s, 0.25*s, 2*s); // User1
    rect(15*s, (user2Pos+3.5)*s, 0.25*s, 2*s); // User2

    // Draw ball
    ellipse(width/2+ballX*s, height/2+ballY*s, 0.25*s, 0.25*s);
    pop();

    // Draw current Text
    push();
    textAlign(CENTER);
    textSize(0.3883495145631068*s);
    fill(105, 230, 255);
    text(currentText, width/2, height/3);
    pop();
  } else {
    // Draw "Join a game" text
    push();
    textAlign(CENTER);
    textSize(s);
    fill(105, 230, 255);
    text("Join A Game :D", width/2, height/2);
    pop();
  }
}

// Disable arrow keys default function
window.addEventListener("keydown", function(e) {
  if([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
    e.preventDefault();
  }
});