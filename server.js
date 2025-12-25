const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { WebcastPushConnection } = require("tiktok-live-connector");

// ====== إعداد السيرفر ======
const app = express();
app.use(cors());
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// ====== متغيرات المزاد ======
let tiktok = null;
let auctionRunning = false;

let timer = 120;
let snipeDelay = 20;
let minBid = 1;

let leader = null;
let userTotals = {};

// ====== Socket.IO ======
io.on("connection", socket => {
    console.log("🟢 Client connected:", socket.id);

    // ====== الاتصال بتيك توك ======
    socket.on("connect_tiktok", username => {
        console.log("🔗 Connecting to TikTok:", username);

        if (tiktok) {
            tiktok.disconnect();
            tiktok = null;
        }

        tiktok = new WebcastPushConnection(username, {
            enableExtendedGiftInfo: true
        });

        tiktok.connect()
            .then(state => {
                console.log("✅ Connected to room:", state.roomId);
                io.emit("status", "🟢 TikTok Connected");
            })
            .catch(err => {
                console.error("❌ TikTok Error:", err);
                socket.emit("status", "❌ Failed to connect TikTok");
            });

        // ====== استقبال الهدايا (الحل النهائي) ======
        tiktok.on("gift", data => {
            if (!auctionRunning) return;

            // ❌ لا نحسب إلا عند نهاية الإرسال
            if (!data.repeatEnd) return;

            const user = data.nickname || data.uniqueId;
            const avatar = data.profilePictureUrl;
            const giftName = data.giftName || "Gift";

            const giftValue = data.diamondCount || 0;
            const count = data.repeatCount || 1;

            const totalCoins = giftValue * count;
            if (totalCoins < minBid) return;

            if (!userTotals[user]) userTotals[user] = 0;
            userTotals[user] += totalCoins;

            console.log(
                `🎁 ${user} | ${giftName} × ${count} = ${totalCoins} 💎 | Total: ${userTotals[user]}`
            );

            // 🏆 تحديث المتصدر
            if (!leader || userTotals[user] > leader.coins) {
                leader = {
                    name: user,
                    avatar,
                    coins: userTotals[user]
                };
            }

            // ⏱️ snipe
            timer = Math.min(timer + snipeDelay, 300);

            io.emit("new_bid", {
                name: user,
                avatar,
                gift: giftName,
                diamonds: totalCoins,
                coins: userTotals[user],
                leader
            });
        });
    });

    // ====== تحكم المزاد ======
    socket.on("start_auction", settings => {
        timer = settings.duration || 120;
        snipeDelay = settings.snipe || 20;
        minBid = settings.minBid || 1;

        auctionRunning = true;
        leader = null;
        userTotals = {};

        console.log("🚀 Auction Started");
        io.emit("auction_started", {
            duration: timer,
            snipe: snipeDelay,
            minBid
        });
    });

    socket.on("pause", () => {
        auctionRunning = false;
        io.emit("status", "⏸️ Auction Paused");
    });

    socket.on("resume", () => {
        auctionRunning = true;
        io.emit("status", "▶️ Auction Resumed");
    });

    socket.on("finish", () => {
        auctionRunning = false;
        io.emit("winner", leader);
        console.log("🏆 Winner:", leader);
    });

    socket.on("disconnect", () => {
        console.log("🔴 Client disconnected:", socket.id);
    });
});

// ====== المؤقت ======
setInterval(() => {
    if (!auctionRunning) return;

    timer--;
    io.emit("timer", timer);

    if (timer <= 0) {
        auctionRunning = false;
        io.emit("winner", leader);
        console.log("🏆 Time ended, Winner:", leader);
    }
}, 1000);

// ====== تشغيل السيرفر ======
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running: http://localhost:${PORT}`);
});
