const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "game.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDatabase = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDatabase();

// Register User
app.post("/register/user/", async (request, response) => {
  const { name, age, location, email, phone_number, password } = request.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const isUserExistQuery = `SELECT * FROM users WHERE phone_number = '${phone_number}';`;

  const isUserExist = await db.get(isUserExistQuery);

  if (isUserExist === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
        INSERT INTO 
            users
        (name, age, location, email, phone_number, password)
            VALUES
        ('${name}',${age},'${location}','${email}','${phone_number}','${hashedPassword}');`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// User Login
app.post("/login/user/", async (request, response) => {
  const { phone_number, password } = request.body;

  const isUserExistQuery = `SELECT * FROM users WHERE phone_number = '${phone_number}';`;

  const isUserExist = await db.get(isUserExistQuery);

  if (isUserExist === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      isUserExist.password
    );
    if (isPasswordMatched === true) {
      const payload = { user_id: isUserExist.user_id };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// user authentication
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.user_id = payload.user_id;
        next();
      }
    });
  }
};

// Get list of games
app.get("/games/", authentication, async (request, response) => {
  const getGamesQuery = `SELECT * FROM games`;

  const listOfGames = await db.all(getGamesQuery);

  response.send(listOfGames);
});

// Updating user details
app.put("/user/update/", authentication, async (request, response) => {
  const { user_id } = request;

  const previousUserDataQuery = `
    SELECT 
        *
    FROM 
        users 
    WHERE
        user_id = ${user_id};`;

  const previousUserData = await db.get(previousUserDataQuery);

  const {
    name = previousUserData.name,
    age = previousUserData.age,
    location = previousUserData.location,
    email = previousUserData.email,
  } = request.body;

  const updateUserDetailsQuery = `
    UPDATE
        users
    SET
        name = '${name}',
        age = ${age},
        location = '${location}',
        email = '${email}'
    WHERE
       user_id = ${user_id};`;

  await db.run(updateUserDetailsQuery);
  response.send(`User Details Updated Successfully`);
});

// User gets his aggregated data for each game
app.get("/user/leaderboard/", authentication, async (request, response) => {
  const { user_id } = request;

  const getUserLeaderboardQuery = `
    SELECT 
        game_id,
        user_id,
        SUM(score) as totalPoints,
        COUNT(CASE WHEN is_won='true' then 1 ELSE NULL END) as total_wins
    FROM
        event_results
    WHERE user_id = ${user_id}
    GROUP BY game_id;`;

  const getUserLeaderboard = await db.all(getUserLeaderboardQuery);

  response.send(getUserLeaderboard);
});

// user gets aggregated data of other users for a specific game
app.get("/games/:gameId/", authentication, async (request, response) => {
  const { gameId } = request.params;

  const getGameLeaderboardQuery = `
    SELECT 
        game_id,
        user_id,
        SUM(score) as totalPoints,
        COUNT(CASE WHEN is_won='true' then 1 ELSE NULL END) as total_wins,
        row_number() over(ORDER BY SUM(score) DESC) as Rank
    FROM
        event_results
    WHERE game_id = ${gameId}
    GROUP BY user_id ORDER BY totalPoints DESC;`;

  const getGameLeaderboard = await db.all(getGameLeaderboardQuery);

  response.send(getGameLeaderboard);
});

// Register admin
app.post("/register/admin/", async (request, response) => {
  const { username, email, designation, password } = request.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const isAdminExistQuery = `SELECT * FROM admins WHERE username = '${username}';`;

  const isAdminExist = await db.get(isAdminExistQuery);

  if (isAdminExist === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createAdminQuery = `
        INSERT INTO 
            admins
        (username, email, designation, password)
            VALUES
        ('${username}','${email}','${designation}','${hashedPassword}');`;
      await db.run(createAdminQuery);
      response.send("Admin created successfully");
    }
  } else {
    response.status(400);
    response.send("Admin already exists");
  }
});

// Admin Login API
app.post("/login/admin/", async (request, response) => {
  const { username, password } = request.body;

  const isAdminExistQuery = `SELECT * FROM admins WHERE username = '${username}';`;

  const isAdminExists = await db.get(isAdminExistQuery);

  if (isAdminExists === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      isAdminExists.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY_1");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// admin authentication
const adminAuthentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY_1", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// Admin post result of the game
app.post("/post/result/", adminAuthentication, async (request, response) => {
  const { u1Id, u2Id, scoreU1, scoreU2, win, gameId } = request.body;

  const isU1Won = win;
  const isU2Won = !isU1Won;

  const eventId = Date.now();

  const insertU1ScoreQuery = `
  INSERT INTO event_results
    (event_id, game_id, user_id, score, is_won)
  VALUES
    (${eventId}, ${gameId}, ${u1Id}, ${scoreU1}, '${isU1Won.toString()}');`;

  await db.run(insertU1ScoreQuery);

  const insertU2ScoreQuery = `
  INSERT INTO event_results
    (event_id, game_id, user_id, score, is_won)
  VALUES
    (${eventId}, ${gameId}, ${u2Id}, ${scoreU2}, '${isU2Won.toString()}');`;

  await db.run(insertU2ScoreQuery);

  response.send("Result posted successfully");
});

module.exports = app;
