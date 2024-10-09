# Rasengan
CS 174A Project, Winter Quarter 2022

What to Expect: 

The goal of the game is to destroy as many walls as 
possible within 1 minute. The player moves with the
"i", "j", and "l" keys.  Most of the code is in the
rasengan.js file and the index.html file. The player
can press "p" to start and end the game, and walls
will randomly generate which the player can then destroy
with the rasengan which is generated using the "e" key.


The two advanced features that we implemented were
physics based movement and collision detection.
We used the collision-demo.js file provided by the
TAs to do collision detection.  The rasengan detects
collisions with the walls to destroy the walls and 
itself.  The player can collide with walls, which will
push him away, but there are some clipping issues. 
The player is the only object that experiences the
physics based movement which relies on velocity changes.

Task Distribution:
Collision Detection and Physics Movement - Valentin Lagunes and Lingtao Chen
Timer and Leaderboard - Lingtao Chen
Environment and Shading - Ethan Truong
