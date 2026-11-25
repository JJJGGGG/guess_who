# guess_who security review

I found 23 security issues. The root cause is that there's no authentication: a player's identity is just the name typed into the URL, so anyone can act as anyone. On top of that, the TLS private key is in the GitHub history and one bad request can crash the server.

The review walked through every view and then checked bin/www (now `server/index.js`), app.js, main.tsx, the configs and the git history. Each finding was then checked against the source. Findings run from most clear to most ambiguous, and solutions are ranked best first.

**Labels:** Very clear → direct execution. Medium and Ambiguous → plan mode.

> **Layout change (2026-11-25):** the project is now one app. `backend/` became `server/` (with `bin/www` → `server/index.js`), `frontend/` became `client/`, `backend/prisma` became `prisma/`, and there is one root `package.json` and `.env`. Express serves the client, and every API route is now under `/api` (e.g. `/rooms/join` → `/api/rooms/join`). The paths and routes below use the new names; line numbers refer to the files as they were reviewed.

**Checked and found no problem:**
- **XSS:** no `dangerouslySetInnerHTML`, `innerHTML` or `eval`, and React escapes chat text.
- **SQL injection:** all queries go through Prisma's typed API, with no raw queries.

---

## Very clear → direct execution

**1. The `/api/rooms/leave` membership check never rejects anyone.** ✅ Done
`room.boards.map(b => b.playerId == playerId).length == 0` is only true when the room is empty, so any name can be removed from any room.
*Files:* `server/routes/rooms.js:64`
- Replace the check with `!room.boards.some(b => b.playerId === playerId)`, and return 404 if the room doesn't exist.

**2. Missing null checks crash the whole server.** ✅ Done
`room`, `board` and `tile` are used without checking they exist. An unknown roomId, a room with no boards on `/start`, or an out-of-range tile throws inside an async handler. Express 4 doesn't catch that, so Node exits.
*Files:* `rooms.js:36, 64, 103, 158, 206, 214`
- Check each lookup and return a 4xx status:
  ```js
  if (!room) return res.sendStatus(404)
  if (!room.boards.length) return res.sendStatus(400)
  if (!tile) return res.sendStatus(400)
  ```

**3. `/api/rooms/selectcharacter` accepts any coordinates and can be called repeatedly.** ✅ Done
There's no 0–5 range check, and a player can change their character mid-game.
*Files:* `rooms.js:174-192`
- Reject the request if row or col isn't an integer from 0 to 5, or if `chosenRow` is already set (load the board first).

**4. Anyone can start any room, and `startGame` goes to every connected client.** ✅ Done
`/api/rooms/start` doesn't check that there are 2 players or that the caller is one of them.
*Files:* `rooms.js:86-140` (emit at 132), `client/src/Room.tsx:27`
- Require `room.boards.length === 2` and that the caller is in the room.
- Send the event only to that room's channel (see #13), or include the roomId and filter strictly on the client.

**5. Two saved MyAnimeList pages run third-party scripts on the app's own domain.** ✅ Done
`frontend/public/3_1.html` and `3_2.html` each contain 28 `<script>` tags (Google ads, unblockia, Google Tag Manager and others). They're served at `/3_1.html`.
- Delete both files. Only the `.webp` images are used.

**6. Env and database files are committed.** ✅ Done
`frontend/.env` was committed and `frontend/.gitignore` didn't exclude it. `backend/.env.bak` and `backend/prisma/dev.db` were also tracked. (Now: one root `.env` and `.gitignore`, and the database is `prisma/dev.db`.) They hold no secrets today, but this setup will leak real ones later.
- Add `.env`, `*.env.bak` and `prisma/*.db` to the gitignores, run `git rm --cached` on the files, and commit a `.env.example` instead.

**7. CORS allows every origin when `FRONTEND_URL` is unset.** ✅ Done
`backend/.env` (now the root `.env`) didn't exist (only `.env.bak`), so the origin is `undefined`, which means "allow all" for both Express and socket.io.
*Files:* `server/app.js:14`, `server/routes/socket.js:12`

> **Update (2026-11-25):** CORS and `FRONTEND_URL` were removed entirely. The client is now served from the same origin, so no cross-origin access is allowed at all.
- Refuse to start without it:
  ```js
  if (!process.env.FRONTEND_URL) throw new Error("FRONTEND_URL required")
  ```

**8. Stack traces can leak, and security headers are missing.** ✅ Done
There's no 404 or error handler, so outside production Express sends full stack traces (for example on invalid JSON). The `x-powered-by` header is on, there's no helmet, and debug `console.log` calls are still in the code.
*Files:* `app.js:18, 20-31`, `rooms.js:197`
- Add `app.use(helmet())`, a 404 handler, and a final error handler such as `(err, req, res, next) => res.status(500).json({error: "internal"})`.
- Run with `NODE_ENV=production` and remove the debug logs.

**9. playerId goes into link URLs without encoding.** ✅ Done
A name like `a&x=y` adds extra query parameters. It can't run scripts.
*Files:* `client/src/Rooms.tsx:77`, `Spectate.tsx:174, 184`
- Build the URLs with `createSearchParams({playerId})`, as `Rooms.tsx:45` already does.

**10. Frontend dev tooling has known vulnerabilities.** ✅ Done
vite 5.4.11 and esbuild 0.21.5 have published issues that let other sites read files from, or send requests to, the dev server. This only matters if `vite dev` can be reached from the network. (Vite now runs inside Express in dev, which binds to 127.0.0.1 unless `HOST` is set.)
- Upgrade vite to the latest patched 5.x or 6.x (`npm audit fix`), and don't expose the dev server on 0.0.0.0.

---

## Medium → plan mode

**11. The TLS private key is in the git history on GitHub.**
`backend/cert/key.pem` (plus `cert.pem` and `csr.pem`) has been tracked since commit bb756be and is still in HEAD. The cert is self-signed and expired, but treat the key as compromised.
1. Untrack and ignore the folder (`git rm -r --cached backend/cert`, add it to .gitignore), generate a new key, purge the history with `git filter-repo --path backend/cert --invert-paths`, then force-push.
2. Same as 1, but purge with BFG Repo-Cleaner (simpler, older tool).
3. Only remove the files from HEAD, without rewriting history. This is acceptable only because the key is expired and self-signed, and it must never be reused.

> **Fixed (2026-11-25), option 1:** `backend/cert/` is untracked and ignored (the root `.gitignore` now ignores `cert/` and `*.pem`). `git filter-repo` purged `backend/cert`, `backend/.env`, `backend/.env.bak`, `frontend/.env` and `backend/prisma/dev.db` from all history, and the result was force-pushed to `origin/main` (d6b6fa9). The old key must never be reused. For HTTPS in dev (#12), make a new cert with `mkcert` and keep it outside the repo (`TLS_KEY`/`TLS_CERT` in `.env`). Any secret from the old `.env` files counts as leaked and must be rotated.

**12. HTTPS is turned off.**
Commit b59e916 (d94c392 before the history rewrite) went back to `http.createServer`, so the API, websockets and chat travel unencrypted. `frontend/.env` pointed to `http://localhost:3000`.
*Files:* `backend/bin/www:9, 26-30` (now `server/index.js`), `frontend/.env:1` (removed)
1. Handle TLS in a reverse proxy (Caddy, or nginx with Let's Encrypt) and keep Node on HTTP behind it, with `app.set('trust proxy', 1)`.
2. Use `https.createServer` in Node (the old code called `http` by mistake), with key and cert paths from env variables outside the repo:
   ```js
   https.createServer({key: fs.readFileSync(process.env.TLS_KEY), cert: fs.readFileSync(process.env.TLS_CERT)}, app)
   ```
3. For development, make a locally trusted cert with `mkcert` and keep it out of git.

> **Fixed (2026-11-25):** frontend and backend are now one app on one origin. In production, TLS is terminated by the platform (Render now, an AWS load balancer later), and Node stays on HTTP behind it with `trust proxy` set. For LAN testing, `server/index.js` serves HTTPS itself when `TLS_KEY` and `TLS_CERT` point to mkcert files outside the repo (options 2 and 3). The old `http.createServer({key, cert})` bug is gone. Helmet sends HSTS and, in production, a CSP with `upgrade-insecure-requests`.

**13. Every websocket event goes to every client.** ✅ Done
`updateRooms`, `updateChat` and `startGame` all use `io.emit`, so every client gets every room's chat and every board.
*Files:* `server/utils.js:7, 11`, `socket.js:21-39`, `rooms.js:132, 229`
1. Use socket.io rooms: the client sends `join` with the roomId, the server calls `socket.join("room:" + id)`, and events go out with `io.to("room:" + id).emit(...)`.
2. Use one socket.io namespace per room. This needs more code, and namespaces are meant to be fixed rather than created per room.
3. Keep broadcasting, but only a short room list (ids and player counts), and fetch the details over HTTP with access checks.

> **Fixed (2026-11-25), option 1:** each socket sends `watch` with `"lobby"` or a roomId, and re-sends it on every reconnect. The server keeps the socket in exactly one `lobby` / `room:<id>` channel. The lobby gets `updateRooms` with a summary only (ids, players, no tiles or chosen characters), which also covers `GET /api/rooms`. A room channel gets `updateRoom` (that one room) and `updateChat`. Room pages load from the new `GET /api/rooms/:id`. `startGame` stays on `player:<id>`. The room payload still included chosen characters for spectators; fixed in #14.

**14. Every client gets the opponent's secret character and full board.** ✅ Done
`GET /api/rooms` and `updateRooms` include `chosenRow`/`chosenCol` for every board. The Spectate screen shows them openly, so a player can spectate their own game to cheat.
*Files:* `rooms.js:11`, `utils.js:4-8`, `client/src/Spectate.tsx:198-200`
1. Remove `chosenRow`/`chosenCol` (and the tiles) from public responses, and add a `GET /api/rooms/:id/board` that returns only the logged-in player's board:
   ```js
   prisma.room.findMany({select: {id: true, boards: {select: {playerId: true}}}})
   ```
2. Send each player their own board on their socket (`io.to(board.socketId).emit("board", board)`), using the server-side socket mapping from #16.
3. Hide chosen characters from spectators until the game ends, and stop players from spectating their own room.

> **Fixed (2026-11-25), options 1 + 2 (+ part of 3):** the room channel and `GET /api/rooms/:id` now send a public view only (`publicRoom` in `server/utils.js`): players, `disconnectedAt`, a `ready` flag, and tiles as `{row, col, flipped}`. `chosenRow`/`chosenCol` are never in it. Each player gets their own full board from the new `GET /api/rooms/:id/board` (auth required, own board only), and `updateRoom` pushes a `board` event to `player:<id>` for every board in the room. #16's socketId is gone, so this channel is server-side. Identity is per tab, so anything a spectator sees, a player can see too. Spectators therefore see flipped tiles but never chosen characters. There is no end-of-game state yet; revealing characters at the end would need one. Spectate redirects a player in that room to their game page, but that's only a UX guard.

**15. The server doesn't validate input.** ✅ Done
Nothing checks the type or length of playerId, roomId, message, row, col or socketId. Chat messages have no length limit, duplicate names are allowed, and the same player can join twice.
*Files:* `rooms.js:22-49, 209-232`
1. Validate each route with a zod schema in middleware, for example `z.object({roomId: z.number().int(), playerId: z.string().min(1).max(32)})`.
2. Use express-validator on each route.
3. Write the checks by hand in each handler. This adds no dependency but is repetitive and easy to forget.

> **Fixed (2026-11-25), with yup instead of zod (done together with #19):** every route that takes input runs a yup schema through the `validate(schema, source)` middleware in `server/utils.js`. Invalid input gets `400 {error}`. The cast value replaces `req.body`/`req.query`, so strings are trimmed and unknown keys dropped. Each schema lives in the file that uses it: `roomId`, `row`/`col` (0–5) and `message` (1–500 chars after trim) in `server/routes/rooms.js`, and `name` (1–20) in `server/routes/session.js`. The client validates the name (`Layout.tsx`) and chat message (`Chat.tsx`) with its own yup schemas before sending, and shows the error inline. Prisma's `PrismaClientValidationError` → 400 stays as a backstop. Duplicate names are still allowed, since identity is the token, not the name. Joining twice was already prevented by #17.

**16. The client picks its own socketId, and everyone's socketId is broadcast.** ✅ Done
`/api/rooms/join` stores whatever socketId it's sent, and `updateRooms` shows every player's socketId. An attacker can attach a board to the victim's socket, which also breaks the cleanup that runs on disconnect.
*Files:* `rooms.js:25, 40-46`, `socket.js:23-38`, `Rooms.tsx:40`
1. Join over the socket (`socket.on("join", ...)`), so the server uses its own `socket.id`.
2. Keep joining over HTTP, but check that the socketId is a connected socket whose handshake token matches the player (needs #20).
3. At minimum, remove socketId from everything sent to clients.

> **Fixed (2026-11-25), via #20 (beyond option 1):** there is no socketId anymore. Migration `20261022021129_auth_grace_period` dropped `Board.socketId`. `/api/rooms/join` takes the player from the signed token (`requireAuth`), and each socket is authenticated by its handshake token (`socketAuth`) and joined to a server-side `player:<id>` channel. Disconnect cleanup is per player (`disconnectedAt` + grace-period sweep in `server/routes/socket.js`). No socket id is sent to clients (`lobbySelect`, `publicRoom`, `privateBoard` in `server/utils.js`).

**17. Simultaneous requests can break `/api/rooms/join` and `/api/rooms/start`.** ✅ Done
`/join` checks capacity and inserts in two separate queries, so parallel joins can put more than 2 players in a room. `/start` has the same gap, so parallel starts both create tiles and then crash.
*Files:* `rooms.js:36-46, 103-127`, `prisma/schema.prisma` (unique constraint on Tile)
1. Do the check and the write in one interactive `prisma.$transaction`. SQLite runs writes one at a time.
2. Let the database enforce it: add a `slot` field (0 or 1) on Board with `@@unique([roomId, slot])`, and a `started` flag on Room that is set with a conditional `updateMany({where: {id, started: false}})`.
3. Use a per-room lock in the Node process. This only works with a single server instance.

> **Fixed (2026-11-25), option 2:** migration `20261125000000_board_slot_room_started` adds `Board.slot` (0 or 1) with `@@unique([roomId, slot])` and `@@unique([roomId, playerId])`, plus `Room.started`. `/join` picks the free slot, and a concurrent duplicate fails in the database and returns 409. `/start` claims the room with `updateMany({where: {id, started: false}})`, so only one request creates tiles. Both boards' tiles are created in one transaction, and if that fails the claim is undone. New `resetGames` in `server/utils.js` (tiles, chosen characters, `started`) runs on `/leave` as well as in the grace sweep. Before, `/leave` left the remaining player's tiles, so the room could never start again. The migration backfills slots and `started`, and drops boards that would break the new constraints. Checked with 6 parallel joins (2 succeed), 5 parallel self-joins (1 succeeds), 6 parallel starts (1 creates tiles, 36 per board) and leave → rejoin → start.

**18. Async errors aren't caught globally (beyond the null checks in #2).** ✅ Done
Any other Prisma error, such as a wrong value type, still crashes the server.
*Files:* `rooms.js` (all handlers), `server/index.js`
1. Upgrade to Express 5, which passes rejected promises to the error handler.
2. Add `require('express-async-errors')` at the top of `app.js`.
3. Wrap each handler in a small `asyncHandler(fn)` helper, and add `process.on('unhandledRejection', log)` as a last resort.

> **Fixed (2026-11-25), option 1:** upgraded to Express 5, which forwards a rejected promise from any route handler to the error handler on its own, so new routes are covered without needing a per-route wrapper. An earlier `asyncHandler` wrapper was removed. `process.on('unhandledRejection')` in `server/index.js` stays as a last resort for socket.io handlers, which are not Express routes. Express 5 follow-ups: `/:id(\\d+)` routes became `/:id` plus yup validation of `req.params` (a non-numeric id now gets 400), the SPA fallback is `/{*splat}`, and `validate()` redefines `req.query` (a read-only getter in Express 5) and treats a missing body as `{}`.

**19. No rate limiting, and data grows without limit.** ✅ Done
Rooms and chat messages can be created without limit and are never deleted. Every change re-reads all rooms and sends them to every client.
*Files:* `rooms.js:14-20, 209-232`, `utils.js:4-8`, `app.js`
1. Add `express-rate-limit` on the POST routes, a maximum message length, and a cap on open rooms.
2. Add a periodic cleanup job that deletes empty or idle rooms and old messages.
3. Rate-limit at the platform or a reverse proxy (e.g. nginx `limit_req`) in front of Node.

> **Fixed (2026-11-25), options 1 + 2:**
> - **Rate limits** (`express-rate-limit` in `server/app.js`, per IP and per minute, overridable via env): all non-GET `/api` requests 120 (`RATE_LIMIT_WRITES_PER_MIN`), `POST /api/session` 10, `POST /api/rooms` 5, `POST /api/rooms/message` 30. Over the limit → `429 {error}` with `RateLimit` headers.
> - **Caps:** at most `MAX_OPEN_ROOMS` (default 50) rooms. `POST /api/rooms` answers 503 beyond that, which also bounds what `updateLobby` re-reads and broadcasts per change. Messages are at most 500 chars (see #15). Each room keeps the newest 200 messages: older ones are deleted on post. `GET`/`POST /message` return only the newest 100.
> - **Cleanup:** migration `20261125164229_room_created_at` adds `Room.createdAt`. Every 60 s, `cleanupRooms` in `server/routes/socket.js` deletes rooms with no boards older than `EMPTY_ROOM_TTL_MINUTES` (default 10), and their messages cascade with them. Rooms abandoned by disconnected players become empty through the existing grace sweep, then age out. `/join` on a room deleted mid-request returns 404 (P2003), not 500.
> - The migration backfills existing rooms with integer milliseconds. That is Prisma's SQLite DateTime format. SQLite's `CURRENT_TIMESTAMP` default stores text, which never compares as older than the cutoff.
> - **Not done (option 3):** limits live in memory, so they are per process and reset on restart. With more traffic or multiple instances, rate-limit at the platform (Render/AWS WAF) or a reverse proxy (nginx `limit_req`) too.
> - Checked with curl against a copy of the dev DB: invalid names, room ids, rows and messages → 400; 300 posts → 200 stored, 100 returned; 6th room create → 429; create over the cap → 503; 11th session → 429; empty rooms (including migrated ones) deleted after the TTL while a room with a player stays.

---

## Ambiguous → plan mode

**20. No authentication: a player is just a name in the URL.** ✅ Done
`playerId` comes from `?playerId=` and is copied into request bodies, so anyone can act as anyone. This causes #21–23 and limits the fixes for #4, #14 and #16.
*Files:* `client/src/Rooms.tsx:11-13, 38`, `rooms.js:24, 53, 88, 143, 210`, `app.js`
1. On join, give the player a random token and store a hash of it on the Board. The client sends it in an `Authorization` header and in the socket handshake, and the server gets playerId from the token:
   ```js
   const token = crypto.randomBytes(32).toString("hex") // store a hash on Board
   ```
2. Use a signed httpOnly session cookie (express-session, or a signed cookie-parser cookie) with SameSite=strict. (Same origin now, so no CORS changes would be needed.)
3. Use a JWT signed with a server secret that holds `{playerId, roomId}`.
4. Move all game actions onto the authenticated socket connection, so the server identifies players by their socket.
5. Add real accounts (OAuth or password). That's a lot for a casual game, but it gives players a lasting identity.

**21. Anyone can flip another player's tiles.** ✅ Done
`/api/rooms/tiles/flip` finds the board using the `roomId` and `playerId` from the request body.
*Files:* `rooms.js:142-172`
1. After #20, use the authenticated playerId instead of the one in the body.
2. Before #20, require a per-board secret that only `/api/rooms/join` returns.

**22. Anyone can change any player's secret character.** ✅ Done
`/api/rooms/selectcharacter` updates whatever `boardId` it's sent and never checks who owns it. (Input validation is covered in #3.)
*Files:* `rooms.js:174-192`, `client/src/Game.tsx:102`
1. After #20, use `update({where: {id: boardId, playerId: authPlayerId}})`, or drop boardId and find the board from the token.
2. Before #20, use the same per-board secret as option 2 of #21.

**23. Anyone can post chat as any name, in any room.** ✅ Done
`POST /api/rooms/message` accepts any playerId and roomId and doesn't check membership.
*Files:* `rooms.js:209-232`, `client/src/hooks/useMessages.tsx:221-239`
1. After #20, take the sender from the token, and only let room members post (plus spectators, if you want that).
2. Decide whether spectators can chat. That product decision sets the membership rule.

> **Fixed (2026-11-25), via #20 (option 1):** `POST /api/rooms/message` uses `requireAuth` and takes the sender (`playerId`, `playerName`) from the signed token (`req.player`). Any playerId in the body is ignored. Only players with a board in the room can post; anyone else gets 403. Spectators can read chat but not post, by design (`<Chat readOnly />` in `client/src/Spectate.tsx`). The body is validated (`messageSchema`: positive int roomId, trimmed message of 1–500 chars) and each room keeps at most 200 messages (`MAX_MESSAGES_PER_ROOM`).

24: testing is missing. 
25: update app dependencies. all is several years long.
26: ui is ugly

---

## Suggested order
1. Fix #1–10 directly. ✅ Done
2. Plan #20 (how players are identified) first, because #14, #16, #21, #22, #23 and parts of #4 and #13 depend on it.
3. Then plan #11–12 (TLS and the leaked key).
4. Then #13, #15 and #17–19.

## How to check the fixes
- Call each route with `curl` using a missing or unknown roomId, wrong value types, and another player's name. You should get 4xx responses and the server should stay up.
- Open two browsers plus a spectator. In the network and socket traffic, the opponent and other rooms should never receive chosen characters or socketIds.
- Send parallel `/api/rooms/join` and `/api/rooms/start` requests (with `xargs -P`). A room should never have more than 2 boards and the server shouldn't crash.
- After purging the history, `git log --all -- backend/cert` should print nothing. Run `npm audit` at the repo root.
