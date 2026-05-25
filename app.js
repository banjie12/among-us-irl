import { supabase } from "./supabase.js";

let currentGame=null;
let isHost=false;

let playerId=localStorage.getItem("playerId");

if(!playerId||playerId==="null"||playerId==="undefined"){
    playerId=crypto.randomUUID();
    localStorage.setItem("playerId",playerId);
}

let playerName="";

/* ================= CREATE GAME ================= */

window.createGame=async()=>{

    playerName=document.getElementById("nameInput").value.trim();
    if(!playerName){
        alert("Enter a name");
        return;
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

/* ================= JOIN GAME ================= */

window.joinGame=async()=>{

    playerName=document.getElementById("nameInput").value.trim();
    const gameCode=document.getElementById("gameInput").value.trim().toUpperCase();

    if(!playerName){
        alert("Enter name");
        return;
    }

    if(!gameCode){
        alert("Enter code");
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
    subscribeToGame(gameCode);
    await loadPlayers(gameCode);
}

/* ================= HOST CHECK ================= */

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

/* ================= LOAD PLAYERS (NO ROLE LEAKS) ================= */

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

        // 🚨 IMPORTANT: NO ROLE DISPLAY HERE
        li.textContent=text;

        list.appendChild(li);
    });
}

/* ================= REALTIME PLAYERS ================= */

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

/* ================= GAME STATE WATCH ================= */

function subscribeToGame(gameCode){

    supabase
        .channel("game-"+gameCode)
        .on(
            "postgres_changes",
            {
                event:"UPDATE",
                schema:"public",
                table:"games",
                filter:`id=eq.${gameCode}`
            },
            (payload)=>{

                if(payload.new.state==="started"){
                    showRoleScreen();
                }
            }
        )
        .subscribe();
}

/* ================= ROLE LOGIC ================= */

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

    const shuffled=[...players].sort(()=>Math.random()-0.5);

    const impostorSet=new Set(
        shuffled.slice(0,impostors).map(p=>p.id)
    );

    for(let p of players){

        const role=impostorSet.has(p.id)?"impostor":"crewmate";

        const { error:updateError }=await supabase
            .from("players")
            .update({ role })
            .match({
                id:p.id,
                game_id:currentGame
            });

        if(updateError){
            console.error(updateError);
        }
    }
}

/* ================= START GAME ================= */

window.startGame=async()=>{

    if(!isHost){
        alert("Only host can start");
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

    alert("Game started");
};

/* ================= ROLE SCREEN ================= */

async function showRoleScreen(){

    document.getElementById("joinScreen").style.display="none";
    document.getElementById("lobbyScreen").style.display="none";
    document.getElementById("roleScreen").style.display="block";

    const { data,error }=await supabase
        .from("players")
        .select("role")
        .eq("id",playerId)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    const roleText=document.getElementById("roleText");
    const sub=document.getElementById("roleSubText");

    if(data.role==="impostor"){
        roleText.textContent="IMPOSTOR";
        sub.textContent="Eliminate crewmates.";
    }else{
        roleText.textContent="CREWMATE";
        sub.textContent="Complete tasks and find impostors.";
    }
}
