import { supabase } from "./supabase.js";

let currentGame=null;

let playerId=localStorage.getItem("playerId");

if(!playerId){
    playerId=crypto.randomUUID();
    localStorage.setItem("playerId",playerId);
}

let playerName="";

window.createGame=async()=>{
    playerName=document.getElementById("nameInput").value.trim();

    if(!playerName){
        alert("Enter a name");
        return;
    }

    const gameCode=Math.random().toString(36).substring(2,7).toUpperCase();

    await supabase
        .from("games")
        .insert({
            id:gameCode,
            state:"lobby"
        });

    await joinToGame(gameCode);
};

window.joinGame=async()=>{
    playerName=document.getElementById("nameInput").value.trim();

    const gameCode=document.getElementById("gameInput").value.trim().toUpperCase();

    if(!playerName){
        alert("Enter a name");
        return;
    }

    if(!gameCode){
        alert("Enter a game code");
        return;
    }

    await joinToGame(gameCode);
};

async function joinToGame(gameCode){
    currentGame=gameCode;

    await supabase
        .from("players")
        .upsert({
            id:playerId,
            game_id:gameCode,
            name:playerName,
            alive:true
        });

    document.getElementById("joinScreen").style.display="none";
    document.getElementById("lobbyScreen").style.display="block";
    document.getElementById("gameCode").textContent=gameCode;

    subscribeToPlayers(gameCode);

    await loadPlayers(gameCode);
}

async function loadPlayers(gameCode){
    const { data }=await supabase
        .from("players")
        .select("*")
        .eq("game_id",gameCode);

    const list=document.getElementById("playerList");

    list.innerHTML="";

    data.forEach(player=>{
        const li=document.createElement("li");

        li.textContent=player.name;

        list.appendChild(li);
    });
}

function subscribeToPlayers(gameCode){
    supabase
        .channel("players-"+gameCode)
        .on(
            "postgres_changes",
            {
                event:"*",
                schema:"public",
                table:"players"
            },
            ()=>{
                loadPlayers(gameCode);
            }
        )
        .subscribe();
}

window.startGame=async()=>{
    if(!currentGame){
        return;
    }

    await supabase
        .from("games")
        .update({
            state:"started"
        })
        .eq("id",currentGame);

    alert("Game state set to started");
};
