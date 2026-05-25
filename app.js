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

    const { error }=await supabase
        .from("games")
        .insert({
            id:gameCode,
            state:"lobby",
            host_id:playerId
        });

    if(error){
        alert(error.message);
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
        alert(error.message);
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

    const { data:gameData }=await supabase
        .from("games")
        .select("host_id")
        .eq("id",gameCode)
        .single();

    const list=document.getElementById("playerList");

    list.innerHTML="";

    data.forEach(player=>{

        const li=document.createElement("li");

        let text=player.name;

        if(gameData&&player.id===gameData.host_id){
            text+=" 👑";
        }

        if(player.role){
            text+=" - "+player.role;
        }

        li.textContent=text;

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

function shuffle(arr){
    return arr.sort(()=>Math.random()-0.5);
}

async function assignRoles(){

    const { data:players,error }=await supabase
        .from("players")
        .select("*")
        .eq("game_id",currentGame);

    if(error){
        alert(error.message);
        return;
    }

    const total=players.length;

    let impostors=Math.max(
        1,
        Math.min(3,Math.floor((total-1)/3))
    );

    const shuffled=shuffle([...players]);

    const impostorList=shuffled.slice(0,impostors);

    for(let p of players){

        let role="crewmate";

        if(impostorList.find(i=>i.id===p.id)){
            role="impostor";
        }

        const { error:updateError }=await supabase
            .from("players")
            .update({ role })
            .eq("id",p.id);

        if(updateError){
            console.error(updateError);
        }
    }
}

window.startGame=async()=>{

    if(!isHost){
        alert("Only the host can start the game");
        return;
    }

    await assignRoles();

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

    alert("Game started + roles assigned");
};
