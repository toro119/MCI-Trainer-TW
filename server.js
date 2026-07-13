
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "MCI Trainer TW",
    time: new Date().toISOString()
  });
});


const rooms = new Map();

function makePatients(count = 12) {
  const templates = [
    { age:28, sex:"男", walk:false, breath:true, rr:34, pulse:false, command:false, correct:"red", note:"右大腿開放性骨折，大量出血" },
    { age:45, sex:"女", walk:true, breath:true, rr:22, pulse:true, command:true, correct:"green", note:"額頭撕裂傷，可自行行走" },
    { age:61, sex:"男", walk:false, breath:false, afterAirway:false, rr:0, pulse:false, command:false, correct:"black", note:"無呼吸，開放呼吸道後仍無呼吸" },
    { age:34, sex:"女", walk:false, breath:true, rr:24, pulse:true, command:true, correct:"yellow", note:"骨盆疼痛，無法行走" },
    { age:52, sex:"男", walk:false, breath:true, rr:29, pulse:false, command:true, correct:"red", note:"胸部鈍傷，橈動脈摸不到" },
    { age:31, sex:"女", walk:false, breath:true, rr:20, pulse:true, command:true, correct:"yellow", note:"左小腿變形，生命徵象穩定" }
  ];
  return Array.from({ length: count }, (_, i) => ({
    ...templates[i % templates.length],
    id: "A" + String(i + 1).padStart(2, "0"),
    primaryResult: null,
    primaryBy: "",
    secondaryResult: null,
    secondaryBy: "",
    transported: false
  }));
}

function publicState(room) {
  return {
    roomCode: room.roomCode,
    scenarioName: room.scenarioName,
    scenarioType: room.scenarioType,
    patients: room.patients,
    members: room.members,
    resources: room.resources,
    transportLogs: room.transportLogs,
    started: room.started
  };
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, scenarioName, scenarioType, patientCount }, cb) => {
    let roomCode;
    do {
      roomCode = String(Math.floor(100000 + Math.random() * 900000));
    } while (rooms.has(roomCode));

    const room = {
      roomCode,
      scenarioName: scenarioName || "大量傷病患演練",
      scenarioType: scenarioType || "遊覽車翻覆",
      patients: makePatients(Number(patientCount) || 12),
      members: [],
      resources: [],
      transportLogs: [],
      started: false
    };
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.name = name || "教官";
    socket.data.role = "instructor";
    room.members.push({ socketId: socket.id, name: socket.data.name, role: "instructor" });
    cb({ ok: true, roomCode, state: publicState(room) });
    io.to(roomCode).emit("state", publicState(room));
  });

  socket.on("joinRoom", ({ roomCode, name, role }, cb) => {
    const room = rooms.get(String(roomCode));
    if (!room) return cb({ ok: false, message: "找不到房間" });
    socket.join(String(roomCode));
    socket.data.roomCode = String(roomCode);
    socket.data.name = name || "未具名";
    socket.data.role = role || "primary";
    room.members.push({ socketId: socket.id, name: socket.data.name, role: socket.data.role });
    cb({ ok: true, state: publicState(room) });
    io.to(String(roomCode)).emit("state", publicState(room));
  });

  socket.on("startExercise", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    room.started = true;
    io.to(room.roomCode).emit("state", publicState(room));
  });

  socket.on("submitPrimary", ({ patientId, result }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const p = room.patients.find(x => x.id === patientId);
    if (!p || p.primaryResult) return;
    p.primaryResult = result;
    p.primaryBy = socket.data.name;
    io.to(room.roomCode).emit("state", publicState(room));
  });

  socket.on("submitSecondary", ({ patientId, result }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const p = room.patients.find(x => x.id === patientId);
    if (!p || !p.primaryResult) return;
    p.secondaryResult = result;
    p.secondaryBy = socket.data.name;
    io.to(room.roomCode).emit("state", publicState(room));
  });

  socket.on("dispatchAmbulances", ({ count }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const stations = ["平鎮","中壢","龍岡","大溪","八德","楊梅","埔心","幼獅"];
    for (let i = 0; i < Number(count || 1); i++) {
      const station = stations[Math.floor(Math.random() * stations.length)];
      const unit = Math.random() < 0.5 ? "91" : "92";
      const name = station + unit;
      if (!room.resources.some(r => r.name === name)) {
        room.resources.push({ type:"ambulance", name, status:"到達現場" });
      }
    }
    io.to(room.roomCode).emit("state", publicState(room));
  });

  socket.on("transport", ({ patientIds, ambulance, hospital }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb({ ok:false, message:"房間不存在" });
    const ps = (patientIds || []).map(id => room.patients.find(p => p.id === id)).filter(Boolean);
    if (!ps.length || ps.length > 3) return cb({ ok:false, message:"每車需載送 1 至 3 人" });
    const colors = ps.map(p => p.secondaryResult || p.primaryResult);
    const red = colors.filter(c => c === "red").length;
    const yellow = colors.filter(c => c === "yellow").length;
    if (red > 1 || yellow > 1 || (red && yellow)) {
      return cb({ ok:false, message:"不符合載送規則：紅黃不可同車，紅票或黃票每車最多 1 人" });
    }
    ps.forEach(p => p.transported = true);
    const amb = room.resources.find(r => r.name === ambulance);
    if (amb) amb.status = "後送中";
    room.transportLogs.push({
      time: new Date().toLocaleTimeString("zh-TW", { hour12:false }),
      patientIds: ps.map(p => p.id),
      ambulance,
      hospital
    });
    io.to(room.roomCode).emit("state", publicState(room));
    cb({ ok:true });
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    room.members = room.members.filter(m => m.socketId !== socket.id);
    io.to(room.roomCode).emit("state", publicState(room));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`MCI Trainer TW running on http://localhost:${PORT}`));
