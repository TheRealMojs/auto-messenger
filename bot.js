const fs = require('fs');
const readline = require('readline');
const { Client: SelfClient } = require('discord.js-selfbot-v13');
const { QuickDB } = require('quick.db');

const db = new QuickDB();

let selfbots = [];
if(fs.existsSync('./selfbots.json')){
selfbots = JSON.parse(fs.readFileSync('./selfbots.json'));
}

function saveSelfbots(){
fs.writeFileSync('./selfbots.json', JSON.stringify(selfbots, null, 2));
}

const activeSelfbots = {};
const activeLoops = {};

async function spawnSelfbot(name, token){
if(activeSelfbots[name]) return activeSelfbots[name];
const bot = new SelfClient({ checkUpdate: false });
await bot.login(token).catch(e => console.log(`Failed login for ${name}:`, e.message));
activeSelfbots[name] = bot;
return bot;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(query){ return new Promise(resolve => rl.question(query, resolve)); }

async function sendLoop(msgID){
let data = await db.get(`messages.${msgID}`);
if(!data) return;
const selfbot = await spawnSelfbot(data.accName, data.token);
const guild = selfbot.guilds.cache.get(data.guildID);
if(!guild){ console.log('Guild not found'); return; }
const channel = guild.channels.cache.get(data.channelID);
if(!channel){ console.log('Channel not found'); return; }

data.active = true;
await db.set(`messages.${msgID}`, data);
activeLoops[msgID] = true;

while(activeLoops[msgID]){
await channel.send({ content: data.text, files: data.image ? [data.image] : [] }).catch(e=>console.log(e.message));
await new Promise(r=>setTimeout(r, data.delay));
}
data.active = false;
await db.set(`messages.${msgID}`, data);
}

async function main(){
while(true){
console.log('\n1️⃣ Add Account');
console.log('2️⃣ Show Accounts');
console.log('3️⃣ Edit Account');
console.log('4️⃣ Create Message');
console.log('5️⃣ Active Messages');
console.log('6️⃣ Edit Message');
console.log('7️⃣ Exit');

const choice = await ask('Choose option: ');  

// ========== Accounts ==========
if(choice==='1'){  
  const name = await ask('Account Name: ');  
  const token = await ask('Token: ');  
  const self = new SelfClient({ checkUpdate: false });  
  try{  
    await self.login(token); self.destroy();  
    selfbots.push({ name, token }); saveSelfbots();  
    console.log(`✅ Account ${name} added!`);  
  }catch(e){ console.log(`❌ Token invalid for ${name}`); }  
}  
else if(choice==='2'){  
  selfbots.forEach((a,i)=>console.log(`${i+1}. ${a.name}`));  
}  
else if(choice==='3'){  
  selfbots.forEach((a,i)=>console.log(`${i+1}. ${a.name}`));  
  const idx = parseInt(await ask('Choose account number to edit: ')) -1;  
  const acc = selfbots[idx]; if(!acc) continue;  
  const newName = await ask(`New name (current: ${acc.name}) or Enter to skip: `);  
  const newToken = await ask(`New token (Enter to skip): `);  
  if(newName) acc.name = newName;  
  if(newToken) acc.token = newToken;  
  saveSelfbots(); console.log('✅ Account updated');  
}  

// ========== Messages ==========
else if(choice==='4'){  
  if(selfbots.length===0){ console.log('No accounts'); continue; }  
  selfbots.forEach((a,i)=>console.log(`${i+1}. ${a.name}`));  
  const accIndex = parseInt(await ask('Choose account number: '))-1;  
  const acc = selfbots[accIndex]; if(!acc) continue;  

  const guildID = await ask('Guild ID: ');  
  const channelID = await ask('Channel ID: ');  
  const text = await ask('Message Text: ');  
  const delay = parseInt(await ask('Delay (s): '))*1000;  
  const image = await ask('Image path (Enter to skip): ');  
  const msgID = Date.now().toString();  

  await db.set(`messages.${msgID}`, { accName: acc.name, token: acc.token, guildID, channelID, text, delay, image: image||null, active:false });  
  console.log(`✅ Message saved with ID: ${msgID}`);  
}  

else if(choice==='5'){  
  const msgs = await db.get('messages');  
  if(!msgs) { console.log('No messages'); continue; }  
  for(const [id,data] of Object.entries(msgs)){  
    console.log(`ID:${id} | Account:${data.accName} | Active:${data.active}`);  
  }  
  const action = await ask('Start/Stop/Delete message? (s/stop/d/Enter to skip): ');  
  if(action==='s'){  
    const id = await ask('Message ID to start: '); sendLoop(id);  
  } else if(action==='stop'){  
    const id = await ask('Message ID to stop: '); activeLoops[id]=false;  
  } else if(action==='d'){  
    const id = await ask('Message ID to delete: '); await db.delete(`messages.${id}`);  
  }  
}  

else if(choice==='6'){  
  const msgs = await db.get('messages');  
  if(!msgs){ console.log('No messages'); continue; }  
  for(const [id,data] of Object.entries(msgs)){  
    console.log(`ID:${id} | Account:${data.accName} | Text:${data.text} | Delay:${data.delay/1000}s`);  
  }  
  const id = await ask('Message ID to edit: ');  
  const data = await db.get(`messages.${id}`);  
  if(!data){ console.log('Message not found'); continue; }  
  const newText = await ask(`New text (Enter to skip, current: ${data.text}): `);  
  const newDelay = await ask(`New delay in seconds (Enter to skip, current: ${data.delay/1000}): `);  
  const newImage = await ask(`New image path (Enter to skip, current: ${data.image||'None'}): `);  
  if(newText) data.text=newText;  
  if(newDelay) data.delay=parseInt(newDelay)*1000;  
  if(newImage) data.image=newImage;  
  await db.set(`messages.${id}`, data);  
  console.log('✅ Message updated');  
}  

else if(choice==='7'){ rl.close(); process.exit(); }  
else console.log('Invalid choice');  

}
}

main();
