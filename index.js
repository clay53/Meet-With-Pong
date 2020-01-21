// Import required packages
const express = require('express');
const http = require('http');
const sio = require('socket.io');

var app = express(); // Create Express instance
var server = http.createServer(app); // Create HTTP instance with Express
var io = sio(server); // Start socket.io server using HTTP instance

// Public directory
app.get('/w/*', (req, res) => {
	let path = __dirname + req.path;
	console.log("Sending file: " + req.path);
	res.sendFile(path);
});

// Redirect "/" to "/w/index.html" to maintain common directory
app.get('/', (req, res) => {
	res.redirect('/w/index.html');
});

// Game queue
var queue = [];

// Class for game
var Game = function (live, user1, user2=false) {
  // Note: game dimensions are 16x9

  console.log("New game started");

  this.updateSpeed = 60; // Tick speed

  this.moveSpeed = 8/this.updateSpeed; // Set speed to 8 units

  // Set user variables
  this.user1Pos = 0;
  this.user1Dir = 0;
  this.user1Info = [];
  this.user2Pos = 0;
  this.user2Dir = 0;
  this.user2Info = [];

  // Set ball variables
  this.ballX = 0;
  this.ballY = 0;
  this.ballSpeed = 7/this.updateSpeed;
  this.ballBounce = 0; // Number of time ball has hit a paddle in a volley
  this.ballBounceV = 0.2/this.updateSpeed; // How much faster to move the ball per volley
  this.ballR = (Math.random() >= 0.5 ? 180 : 0)+(Math.random()*(45+45)-45); // Initialize ball rotation between Left/Right at a 45-45 degree angle
  
  // Set sound variables
  this.pongSound = false; // Tell players to play pong sound
  this.wallSound = false; // Tell players to play wall sound

  // Tell clients they've connected and update server variables
  user1.game = this;
  user1.queued = false;
  user1.socket.emit('connected', true);
  if (live) {
    user2.game = this;
    user2.queue = false;
    user2.socket.emit('connected', true);
  } else {
    // Give user2 ONLY data if no player for user2
    user2 = {
      data: {
        name: "Clayton Hickey",
        language: "C#",
        occupation: "High School Student",
        food: "Steamed Shrimp",
        game: "Minecraft"
      }
    };
  }

  // Logic for center screen text
  this.currentText = "";
  this.clearTextTimeout;
  // Function for updating center screen text for limited time
  this.addText = (text, millis) => {
    // Clear clear text timeout just in case
    if (this.clearTextTimeout !== undefined) {
      clearTimeout(this.clearTextTimeout);
    }
    this.currentText = text; // Update current text
    this.clearTextTimeout = setTimeout(() => {this.currentText = ""}, millis); // Set timeout to reset text after specified time
  }
  this.addText("Have Fun :D", 3000);

  // Function for moving the game ball
  this.moveBall = () => {
    // Calculate predicted ball location
    let ballRRad = this.ballR*Math.PI/180; // Convert ball rotation to radians from degrees
    let ballVelocity = (this.ballSpeed+this.ballBounce*this.ballBounceV); // Calculated ball velocity
    // Predict ball movement based on ONLY rotation and velocity
    let fBallX = this.ballX+Math.cos(ballRRad)*ballVelocity;
    let fBallY = this.ballY+Math.sin(ballRRad)*ballVelocity;
    
    // Score condition
    if (fBallX > 7.875 || fBallX < -7.875) {
      let user2Win = fBallX < 0; // If user 2 won
      let loser = user2Win ? user1 : user2;
      let loserInfo = user2Win ? this.user1Info : this.user2Info;
      let winner = user2Win ? user2 : user1;
      let winnerInfo = user2Win ? this.user2Info : this.user1Info;

      // Pause game
      let _ballSpeed = this.ballSpeed;
      this.ballSpeed = 0;

      // Test for win conditions and reveals
      if (loserInfo.length < 5) {
        let revealed = ["name", "language", "occupation", "food", "game"][loserInfo.length]; // What is revealed about the loser
        loserInfo.push(loser.data[revealed]); // Reveal next info of the loser of the volley
        // Update center screen text with reveal text
        this.addText(
          (
            revealed === "name"
          ) ? (
            "Their name is:\n" + loser.data[revealed]
          ) : (
            (
              revealed === "language" ||
              revealed === "food" ||
              revealed === "game"
            ) ? (
              loser.data.name + "'s favorite " + revealed + " is " + loser.data[revealed]
            ) : (
              loser.data.name + " is a " + loser.data[revealed]
            )
          ),
          2000
        );
        // Check for win condition
        if (loserInfo.length === 5 && winnerInfo.length === 5) {
          setTimeout(() => {this.currentText = "Game over!\nBoth of you have learned\n all about eachother!"}, 2000); // Show win text after reveal text
        } else {
          setTimeout(() => {this.ballSpeed = _ballSpeed}, 2000); // Resume game after 2 seconds
        }
      } else if (winnerInfo.length === 5) {
        setTimeout(() => {this.currentText = "Game over!\nBoth of you have learned\n all about eachother!"}, 2000); // Show win text after reveal text
      } else {
        this.addText("All of " + loser.data.name + "'s info has been revealed!\nReveal the other's!", 2000); // Show no information to reveal
        setTimeout(() => {this.ballSpeed = _ballSpeed}, 2000); // Resume game after 2 seconds
      }

      // Reset ball
      this.ballX = 0;
      this.ballY = 0;
      this.ballBounce = 0;
      this.ballR = (Math.random() >= 0.5 ? 180 : 0)+(Math.random()*(45+45)-45);
    } 
    // If hit against top/bottom
    else if (fBallY > 4.375 || fBallY < -4.375) {
      this.wallSound = true; // Play wall sound
      this.ballR = -this.ballR; // Change ball rotation
      this.moveBall(); // Recalculate ball movement
    }
    // Hit user1's paddle
    else if (
      fBallX < -6.875 && // ball behind front
      fBallX > -7.375 && // ball in front of back
      fBallY < this.user1Pos+1.125 && // ball below top
      fBallY > this.user1Pos-1.125 // ball above bottom
    ) {
      this.pongSound = true; // Play pong sound
      this.ballR = (this.ballY-this.user1Pos+1.25)/2.5*120-60; // Bounce ball at angle proportional to how close the ball is to the edge of the paddle
      this.ballBounce++; // Increase ball bounce count
      this.moveBall(); // Recalculate ball movement
    }
    // Hit user2's paddle
    else if (
      fBallX > 6.875 && // ball behind front
      fBallX < 7.375 && // ball in front of back
      fBallY < this.user2Pos+1.125 && // ball below top
      fBallY > this.user2Pos-1.125 // ball above bottom
    ) {
      this.pongSound = true; // Play pong sound
      this.ballR = (this.user2Pos-this.ballY+1.25)/2.5*120+120; // Bounce ball at angle proportional to how close the ball is to the edge of the paddle
      this.ballBounce++; // Increase ball bounce count
      this.moveBall(); // Recalculate ball movement
    } 
    // No collisions, just move the ball
    else {
      this.ballX = fBallX;
      this.ballY = fBallY;
    }
  }

  this.update = () => {
    // Reset sound variables
    this.pongSound = false;
    this.wallSound = false;

    // Shutdown game if both players disconnected
    if (!(user1.socket.connected || (live ? user2.socket.connected : false))) {
      console.log("Everyone disconnected from a game. Shutting it down...");
      clearInterval(this.updateInterval);
    }
  
    // Move user1
    let fUser1Pos = this.user1Pos+this.user1Dir*this.moveSpeed; // User1's possible future pos
    this.user1Pos = fUser1Pos > 3.5 ? 3.5 : (fUser1Pos < -3.5 ? -3.5 : fUser1Pos); // Clamp user1 position

    // If playing against bot, do AI stuff
    if (!live) {
      this.user2Dir = (this.ballY < this.user2Pos+1 && this.ballY > this.user2Pos-1 ? 0 : (this.ballY > this.user2Pos ? 1 : -1))*0.6; // Move towards ball at slow speed to make easier for player
    }
    
    // Move user2
    let fUser2Pos = this.user2Pos+this.user2Dir*this.moveSpeed; // User2's possible future pos
    this.user2Pos = fUser2Pos > 3.5 ? 3.5 : (fUser2Pos < -3.5 ? -3.5 : fUser2Pos); // Clamp user2 position

    // Move ball
    this.moveBall();

    // Send game info to users
    user1.socket.emit('game info', {
      user1Pos: this.user1Pos,
      user1Info: this.user1Info,
      user2Pos: this.user2Pos,
      user2Info: this.user2Info,
      ballX: this.ballX,
      ballY: this.ballY,
      currentText: this.currentText,
      pongSound: this.pongSound,
      wallSound: this.wallSound
    });
    // Only send game info to user2 if present
    if (live) {
      user2.socket.emit('game info', {
        user1Pos: this.user2Pos,
        user1Info: this.user2Info,
        user2Pos: this.user1Pos,
        user2Info: this.user1Info,
        ballX: -this.ballX,
        ballY: this.ballY,
        currentText: this.currentText,
        pongSound: this.pongSound,
        wallSound: this.wallSound
      });
    }
  };

  // Function for updating the user's position - called from socket.io
  this.updateUserDir = (id, dir) => {
    if (!live || user1.socket.id === id) {
      this.user1Dir = dir;
    } else {
      this.user2Dir = dir;
    }
  }

  // Start update loop
  this.updateInterval = setInterval(this.update, 1000/this.updateSpeed);
}

// Main socket.io entry point
io.on('connection', (socket) => {
	console.log(socket.id + ' connected to main');
  var user = {data: false, game: false, queued: false, socket: socket}; // Initialize user variables

  // On client queue request
  socket.on('queue', (msg) => {
    if (!user.queued && !user.game) {
      // Validify sent data
      if (
        typeof(msg) === "object" &&
        Object.keys(msg).length === 6 &&
        typeof(msg.live) === "boolean" &&
        typeof(msg.name) === "string" &&
        msg.name.length > 0 &&
        typeof(msg.language) === "string" &&
        msg.language.length > 0 &&
        typeof(msg.occupation) === "string" &&
        msg.occupation.length > 0 &&
        typeof(msg.food) === "string" &&
        msg.food.length > 0 &&
        typeof(msg.game) === "string" &&
        msg.game.length > 0
      ) {
        user.data = msg; // Set validated data as the user's data
        if (msg.live) {
          user.queued = true;
          if (queue.length === 0) {
            queue.unshift(user); // Add user to last in queue
            console.log(socket.id + " joined queue");
          } else {
            new Game(true, queue.pop(), user); // Create game with 2 players
          }
        } else {
          new Game(false, user); // Create game with AI
        }
      }
    }
  });

  // On request to change move direction
  socket.on('move dir', (msg) => {
    // Validify sent data
    if (
      user.game &&
      typeof(msg) === "number" && 
      (
        msg === 1 ||
        msg === 0 ||
        msg === -1
      )
    ) {
      user.game.updateUserDir(socket.id, msg); // Update user's direction
    }
  });

  // On disconnect
	socket.on('disconnect', function(){
		console.log(socket.id + ' disconnected from main');
    
    // Remove user from queue if queued
    if (user.queued) {
      queue.splice(queue.indexOf(user), 1);
    }
	});
});

// Start HTTP server
server.listen(3000, () => {
	console.log('server started');
});