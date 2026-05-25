import { supabase } from "./supabase.js";

let currentGame=null;
let isHost=false;

let playerId=localStorage.getItem("playerId");

if(!playerId||playerId==="null"||playerId==="undefined"){
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

    playerId=localStorage.getItem("playerId");

    if(!playerId){
        playerId=crypto.randomUUID();
        localStorage.setItem("playerId",playerId);
    }

    const gameCode=Math.random().toString(36).substring(2,7).toUpperCase();

    const { data,error }=await supabase
        .from("games")
        .insert({
            id:gameCode,
            state:"lobby",
            host_id:playerId
        })
        .select()
        .single();

    if(error){
        alert("Game creation failed: "+error.message);
        return;
    }

    if(!data){
        alert("Game not created properly");
        return;
    }

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

    const { error }=await supabase
        .from("players")
        .upsert({
            id:playerId,
            game_id:gameCode,
            name:playerName,
            alive:true
        });

    if(error){
        alert(error.message);
        return;
    }

    document.getElementById("joinScreen").style.display="none";
    document.getElementById("lobbyScreen").style.display="block";
    document.getElementById("gameCode").textContent=gameCode;

    await checkHost(gameCode);
    subscribeToPlayers(gameCode);
    await loadPlayers(gameCode);
}

async function checkHost(gameCode){

    const { data,error }=await supabase
        .from("games")
        .select("host_id")
        .eq("id",gameCode)
        .single();

    if(error){
        alert("Host check failed");
        return;
    }

    isHost=(data.host_id===playerId);

    const btn=document.querySelector("#lobbyScreen button");

    if(btn){
        btn.style.display=isHost?"inline-block":"none";
    }
}

async function loadPlayers(gameCode){

    const { data,error }=await supabase
        .from("players")
        .select("*")
        .eq("game_id",gameCode);

    if(error){
        console.error(error);
        return;
    }

    const list=document.getElementById("playerList");

    list.innerHTML="";

    const { data:gameData }=await supabase
        .from("games")
        .select("host_id")
        .eq("id",gameCode)
        .single();

    data.forEach(player=>{

        const li=document.createElement("li");

        if(gameData&&player.id===gameData.host_id){
            li.textContent=player.name+" 👑";
        }else{
            li.textContent=player.name;
        }

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

    if(!isHost){
        alert("Only the host can start the game");
        return;
    }

    const { error }=await supabase
        .from("games")
        .update({
            state:"started"
        })
        .eq("id",currentGame);

    if(error){
        alert(error.message);
        return;
    }

    alert("Game started");
};
