const socket = io();

socket.on("timer", t => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    document.getElementById("timer").innerText =
        `${m}:${s.toString().padStart(2, "0")}`;
});

socket.on("new_bid", user => {
    document.getElementById("avatar").src = user.avatar;
    document.getElementById("name").innerText = user.name;
    document.getElementById("coins").innerText = user.coins;

    document.getElementById("leader").classList.add("flash");
    setTimeout(() =>
        document.getElementById("leader").classList.remove("flash"), 500);
});

socket.on("winner", user => {
    alert("🏆 Winner: " + user.name);
});
