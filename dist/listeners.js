import handleMessages from "./listeners/messageCreate.js";
import handleGuildMemberAdd from "./listeners/guildMemberAdd.js";
import handleVoiceStateUpdate from "./listeners/voiceStateUpdate.js";
import handleInteractionCreate from "./listeners/interactionCreate.js";
export default function (client) {
    handleMessages(client);
    handleGuildMemberAdd(client);
    handleVoiceStateUpdate(client);
    handleInteractionCreate(client);
}
