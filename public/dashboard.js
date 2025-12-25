const socket = io();

function connect() {
    socket.emit("connect_tiktok",
        document.getElementById("username").value);
}

function start() {
    socket.emit("start_auction", {
        duration: +duration.value,
        snipe: +snipe.value,
        minBid: +minBid.value
    });
}

function pause() { socket.emit("pause"); }
function finish() { socket.emit("finish"); }
