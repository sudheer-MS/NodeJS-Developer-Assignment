const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");

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

// Register User API - 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const isUserExistQuery = `SELECT * FROM user WHERE username = '${username}';`;

  const isUserExist = await db.get(isUserExistQuery);

  if (isUserExist === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
        INSERT INTO 
            user
        (username, password, name, gender)
            VALUES
        ('${username}', '${hashedPassword}', '${name}', '${gender}');`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// User Login API - 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const isUserExistQuery = `SELECT * FROM user WHERE username = '${username}';`;

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
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// authentication API - 2
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
        request.username = payload.username;
        next();
      }
    });
  }
};

const convertTweets = (eachTweet) => {
  return {
    username: eachTweet.username,
    tweet: eachTweet.tweet,
    dateTime: eachTweet.dateTime,
  };
};
// Get latest User Tweets API - 3
app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;

  const getTweetsQuery = `
    SELECT 
    user.username as username, 
    tweet.tweet as tweet, 
    tweet.date_time as dateTime 
    FROM 
    user 
    INNER JOIN 
    follower ON user.user_id = follower.following_user_id 
    INNER JOIN
    tweet ON follower.following_user_id = tweet.user_id
    WHERE 
    tweet.user_id in (SELECT following_user_id FROM follower WHERE follower_user_id = ${userId})
    ORDER BY tweet.date_time DESC
    LIMIT 4 OFFSET 0;`;
  const latestTweets = await db.all(getTweetsQuery);
  response.send(latestTweets.map((eachTweet) => convertTweets(eachTweet)));
});

// names of users that he follows API - 4
app.get("/user/following/", authentication, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;

  const getUsersQuery = `
    SELECT
     name 
    FROM 
     user 
    WHERE 
    user_id IN (SELECT following_user_id FROM follower WHERE follower_user_id = ${userId});`;

  const users = await db.all(getUsersQuery);
  response.send(users);
});

// names of users that follows him API - 5
app.get("/user/followers/", authentication, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;

  const getUsersQuery = `
    SELECT
     name
    FROM 
     user 
     WHERE 
    user_id IN (SELECT follower_user_id FROM follower WHERE following_user_id = ${userId});`;

  const users = await db.all(getUsersQuery);
  response.send(users);
});

// get tweets API - 6
app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;

  // getting followers from database
  const getFollowingUsersQuery = `
    SELECT 
     following_user_id 
    FROM
     follower 
    WHERE 
    follower_user_id = (SELECT user_id FROM user WHERE username = '${username}');`;

  const followingUsers = await db.all(getFollowingUsersQuery);
  const followingUsersArr = followingUsers.map((obj) => obj.following_user_id);

  // getting tweet user from database
  const getTweetUserQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;

  const getTweetUser = await db.get(getTweetUserQuery);
  const tweetUser = getTweetUser.user_id;

  const isTweetUserExists = followingUsersArr.includes(tweetUser);

  // Check if follower exists
  if (isTweetUserExists === true) {
    const getDataQuery = `
        SELECT tweet, 
        (select COUNT(like_id) FROM like WHERE tweet_id = ${tweetId}) as likes, 
        (SELECT COUNT(reply_id) FROM reply WHERE tweet_id = ${tweetId}) as replies,
        date_time
        from 
        tweet
        WHERE tweet_id = ${tweetId};`;

    const tweetData = await db.get(getDataQuery);
    const tweetDataObj = {
      tweet: tweetData.tweet,
      likes: tweetData.likes,
      replies: tweetData.replies,
      dateTime: tweetData.date_time,
    };
    response.send(tweetDataObj);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

// return the list of usernames who liked the tweet API - 7
app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;

    // getting followers from database
    const getFollowingUsersQuery = `
    SELECT 
     following_user_id 
    FROM
     follower 
    WHERE 
    follower_user_id = (SELECT user_id FROM user WHERE username = '${username}');`;

    const followingUsers = await db.all(getFollowingUsersQuery);
    const followingUsersArr = followingUsers.map(
      (obj) => obj.following_user_id
    );

    // getting tweet user from database
    const getTweetUserQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;

    const getTweetUser = await db.get(getTweetUserQuery);
    const tweetUser = getTweetUser.user_id;

    const isTweetUserExists = followingUsersArr.includes(tweetUser);

    // Check if follower exists
    if (isTweetUserExists === true) {
      const getlikedUsersQuery = `
        SELECT 
        username 
        FROM 
        user
        WHERE user_id in (select user_id from like where tweet_id = ${tweetId});`;

      const likedUsers = await db.all(getlikedUsersQuery);
      const likedUsersArr = likedUsers.map((obj) => obj.username);

      response.send({ likes: likedUsersArr });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// return the list of replies API - 8
app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;

    // getting followers from database
    const getFollowingUsersQuery = `
    SELECT 
     following_user_id 
    FROM
     follower 
    WHERE 
    follower_user_id = (SELECT user_id FROM user WHERE username = '${username}');`;

    const followingUsers = await db.all(getFollowingUsersQuery);
    const followingUsersArr = followingUsers.map(
      (obj) => obj.following_user_id
    );

    // getting tweet user from database
    const getTweetUserQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;

    const getTweetUser = await db.get(getTweetUserQuery);
    const tweetUser = getTweetUser.user_id;

    const isTweetUserExists = followingUsersArr.includes(tweetUser);

    // Check if follower exists
    if (isTweetUserExists === true) {
      const getTweetQuery = `SELECT tweet FROM tweet Where tweet_id=${tweetId};`;

      const getTweet = await db.get(getTweetQuery);

      const getRepliedUsersQuery = `
        SELECT 
        user.username as name,
        reply.reply as reply
        FROM
        user INNER JOIN reply on user.user_id = reply.user_id
        WHERE reply.tweet_id = ${tweetId};`;

      const repliedUsers = await db.all(getRepliedUsersQuery);

      response.send({ tweet: getTweet.tweet, replies: repliedUsers });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// get list of all tweets of the user API - 9
app.get("/user/tweets/", authentication, async (request, response) => {
  let { username } = request;

  const getUserTweetsQuery = `
    SELECT 
     tweet.tweet AS tweet,
     (select count(*) FROM like WHERE tweet_id = tweet.tweet_id) as likes,
     (select count(*) FROM reply WHERE tweet_id = tweet.tweet_id) as replies,
     tweet.date_time as dateTime
    FROM 
    tweet INNER JOIN like on tweet.tweet_id = like.tweet_id
    INNER JOIN reply on reply.tweet_id = tweet.tweet_id
    WHERE tweet.user_id = (SELECT user_id from user WHERE username = '${username}')
    GROUP by tweet.tweet_id;`;

  const userTweets = await db.all(getUserTweetsQuery);
  response.send(userTweets);
});

// post a tweet API - 10
app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  let { username } = request;

  const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;

  const getUserId = await db.get(getUserIdQuery);

  const userId = getUserId.user_id;

  const insertTweetQuery = `
    INSERT INTO tweet
    (tweet, user_id, date_time)
    VALUES
    ('${tweet}', ${userId}, datetime('now', 'localtime'));`;

  await db.run(insertTweetQuery);
  response.send("Created a Tweet");
});

// delete a tweet API - 11
app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;

  const getTweetUserQuery = `  SELECT user_id FROM tweet WHERE tweet_id=${tweetId};`;
  const getTweetUser = await db.get(getTweetUserQuery);
  const tweetUser = getTweetUser.user_id;

  const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const userId = getUserId.user_id;

  if (tweetUser === userId) {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId};`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
