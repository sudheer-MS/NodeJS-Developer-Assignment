# NodeJS Developer Assignment - Leaderboard for games

Given an `app.js` file and a database file `game.db` consisting of four tables `users`, `games`, `event_results`, and `admins`.

Wrote APIs to perform operations on the tables `users`, `games`, `event_results`, and `admins` containing the following columns,

**users Table**

| Column       | Type    |
| ------------ | ------- |
| user_id      | INTEGER |
| name         | TEXT    |
| age          | INTEGER |
| location     | TEXT    |
| email        | TEXT    |
| phone_number | TEXT    |
| password     | TEXT    |

**games Table**

| Column    | Type    |
| --------- | ------- |
| game_id   | INTEGER |
| game_name | TEXT    |

**event_results Table**

| Column   | Type    |
| -------- | ------- |
| event_id | INTEGER |
| game_id  | INTEGER |
| user_id  | INTEGER |
| score    | INTEGER |
| is_won   | BOOLEAN |

**admins Table**

| Column      | Type    |
| ----------- | ------- |
| admin_id    | INTEGER |
| username    | TEXT    |
| email       | TEXT    |
| designation | TEXT    |
| password    | TEXT    |

Before starting `app.js` file,
Use `npm install` to install the packages.

API Tests written in `app.http` file.
