const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8"
};

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname.startsWith("/api/")) {
      try {
        return withCors(await handleApi(request, env, url));
      } catch (error) {
        return json({ error: error.message || "Unexpected error" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleApi(request, env, url) {
  const db = createSupabaseClient(env);
  const room = await getRoom(db, env.ROOM_CODE || "biao-homegame");
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/state") {
    return json(await loadState(db, room.id));
  }

  if (request.method === "POST" && path === "/api/players") {
    const body = await readJson(request);
    const name = String(body.name || "").trim();
    if (!name) return json({ error: "Player name is required" }, 400);

    const existingPlayers = await db.get(
      `/players?room_id=eq.${encodeURIComponent(room.id)}&name=ilike.${encodeURIComponent(name)}&select=id`
    );
    if (!existingPlayers.length) {
      await db.post("/players", {
        room_id: room.id,
        name
      });
    }
    return json(await loadState(db, room.id));
  }

  if (request.method === "POST" && path === "/api/games") {
    const body = await readJson(request);
    const date = body.date || todayISO();
    const title = await getNextGameTitle(db, room.id, date);
    const [game] = await db.post("/games?select=*", {
      room_id: room.id,
      date,
      title
    });

    if (body.creatorPlayerId) {
      await joinGame(db, game.id, body.creatorPlayerId);
    }

    return json(await loadState(db, room.id, game.id, body.creatorPlayerId || null));
  }

  const joinMatch = path.match(/^\/api\/games\/([^/]+)\/join$/);
  if (request.method === "POST" && joinMatch) {
    const body = await readJson(request);
    await joinGame(db, joinMatch[1], body.playerId);
    return json(await loadState(db, room.id, joinMatch[1], body.playerId || null));
  }

  const lockMatch = path.match(/^\/api\/games\/([^/]+)\/lock$/);
  if (request.method === "POST" && lockMatch) {
    const body = await readJson(request);
    const status = body.status === "locked" ? "locked" : "open";
    await db.patch(`/games?id=eq.${encodeURIComponent(lockMatch[1])}`, { status });
    return json(await loadState(db, room.id, lockMatch[1], body.selectedPlayerId || null));
  }

  const deleteMatch = path.match(/^\/api\/games\/([^/]+)$/);
  if (request.method === "DELETE" && deleteMatch) {
    const body = await readJson(request, {});
    await db.delete(`/games?id=eq.${encodeURIComponent(deleteMatch[1])}`);
    return json(await loadState(db, room.id, null, body.selectedPlayerId || null));
  }

  if (request.method === "POST" && path === "/api/entries") {
    const body = await readJson(request);
    if (!body.gameId || !body.playerId) {
      return json({ error: "gameId and playerId are required" }, 400);
    }

    await joinGame(db, body.gameId, body.playerId);
    await db.post("/entries?on_conflict=game_id,player_id", {
      game_id: body.gameId,
      player_id: body.playerId,
      amount: Number.parseInt(body.amount, 10) || 0,
      updated_at: new Date().toISOString()
    }, { prefer: "resolution=merge-duplicates" });
    return json(await loadState(db, room.id, body.gameId, body.playerId));
  }

  return json({ error: "Not found" }, 404);
}

function createSupabaseClient(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  async function request(method, path, body, options = {}) {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1${path}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: options.prefer ? `return=representation,${options.prefer}` : "return=representation"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase ${method} ${path} failed: ${text}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  return {
    delete: (path) => request("DELETE", path),
    get: (path) => request("GET", path),
    patch: (path, body) => request("PATCH", path, body),
    post: (path, body, options) => request("POST", path, body, options)
  };
}

async function getRoom(db, roomCode) {
  const rooms = await db.get(`/rooms?code=eq.${encodeURIComponent(roomCode)}&select=*`);
  if (rooms[0]) return rooms[0];

  const [room] = await db.post("/rooms?select=*", {
    code: roomCode,
    name: "Homegame Ledger"
  });
  await db.post("/players", [
    { room_id: room.id, name: "Biao" },
    { room_id: room.id, name: "Jiarou" }
  ]);
  return room;
}

async function loadState(db, roomId, selectedGameId = null, selectedPlayerId = null) {
  const [players, games, participants, entries] = await Promise.all([
    db.get(`/players?room_id=eq.${encodeURIComponent(roomId)}&select=*&order=created_at.asc`),
    db.get(`/games?room_id=eq.${encodeURIComponent(roomId)}&select=*&order=date.desc,created_at.desc`),
    db.get("/game_participants?select=*"),
    db.get("/entries?select=*")
  ]);

  const roomGameIds = new Set(games.map((game) => game.id));
  const playerIds = new Set(players.map((player) => player.id));
  const participantIdsByGame = new Map();

  for (const participant of participants) {
    if (!roomGameIds.has(participant.game_id)) continue;
    const list = participantIdsByGame.get(participant.game_id) || [];
    list.push(participant.player_id);
    participantIdsByGame.set(participant.game_id, list);
  }

  return {
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      createdAt: player.created_at
    })),
    games: games.map((game) => ({
      id: game.id,
      date: game.date,
      title: game.title,
      participantIds: participantIdsByGame.get(game.id) || [],
      status: game.status,
      createdAt: game.created_at
    })),
    entries: entries
      .filter((entry) => roomGameIds.has(entry.game_id) && playerIds.has(entry.player_id))
      .map((entry) => ({
        id: entry.id,
        gameId: entry.game_id,
        playerId: entry.player_id,
        amount: entry.amount,
        note: entry.note || "",
        updatedAt: entry.updated_at
      })),
    selectedPlayerId,
    selectedGameId
  };
}

async function getNextGameTitle(db, roomId, date) {
  const games = await db.get(
    `/games?room_id=eq.${encodeURIComponent(roomId)}&date=eq.${encodeURIComponent(date)}&select=id`
  );
  return `${date} 对局${gameNumberToLabel(games.length + 1)}`;
}

async function joinGame(db, gameId, playerId) {
  if (!playerId) return;

  await db.post("/game_participants?on_conflict=game_id,player_id", {
    game_id: gameId,
    player_id: playerId
  }, { prefer: "resolution=merge-duplicates" });

  await db.post("/entries?on_conflict=game_id,player_id", {
    game_id: gameId,
    player_id: playerId,
    amount: 0
  }, { prefer: "resolution=merge-duplicates" });
}

function gameNumberToLabel(number) {
  const labels = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return number >= 1 && number <= 10 ? labels[number] : String(number);
}

function todayISO(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readJson(request, fallback = null) {
  try {
    return await request.json();
  } catch {
    return fallback ?? {};
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
