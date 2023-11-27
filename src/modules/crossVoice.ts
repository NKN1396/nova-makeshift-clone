import CONFIG from "../resources/configuration.js"
const { GUILD_ID, TEXT_CHANNELS, WEBHOOKS } = CONFIG;
const { LEGACY_VOICE_CHANNEL_ID: ARCHIVE_CHANNEL_ID } = TEXT_CHANNELS;
const { LEGACY_VOICE_WEBHOOK_ID } = WEBHOOKS;

import { Message, ChannelType, ThreadChannel, ThreadAutoArchiveDuration, VoiceChannel, GuildMember, Guild, TextChannel, } from "discord.js";

const threadsByChannelId = new Map<string, ThreadChannel>();
const channelsByThreadId = new Map<string, VoiceChannel>();

export default function (message: Message) {
  // Check if message was sent in Makeshift guild
  const guild = message.guild;
  if (guild?.id !== GUILD_ID) {
    // Message was sent in a different guild
    return;
  }

  // Check if message was sent by a user
  if(message.webhookId) {
    // Message was sent by a webhook
    // This is probably a relayed message
    return;
  }
  if(message.author.bot) {
    // Message was sent by a bot
    // This happens when a bot creates a thread
    return;
  }

  // Check if message was sent in a voice channel
  const channel = message.channel;
  if(channel.type === ChannelType.GuildVoice) {
    // Message was sent in a voice channel
    // Relay it to the corresponding archive channel thread
    relayMessageFromVoiceChannelToArchiveThread(message)
      .catch(console.error);
  }

  // Check if message was sent somewhere in the archive channel
  let channelId;
  if(channel.type === ChannelType.PublicThread) {
    // Message was sent in a thread
    channelId = channel.parent?.id;
  } else {
    // Message was sent in the root channel
    channelId = channel.id;
  }
  if(channelId === ARCHIVE_CHANNEL_ID) {
    console.log("threadToVoice")
    // Message was sent somewhere in the archive channel
    // Relay it to the corresponding voice channel
    relayMessageFromArchiveToVoiceChannel(message)
      .catch(console.error);
  }
}

async function relayMessageFromArchiveToVoiceChannel(message : Message) {
  // Step 1: Get the thread
  const thread = message.thread;
  let voiceChannel;
  if(thread === null) {
    // Message was sent in root channel
    const member = message.member as GuildMember;
    voiceChannel = member.voice.channel as VoiceChannel;
  }
  else {
    // Message was sent in a thread
    voiceChannel = channelsByThreadId.get(thread.id);
  }
  if(!voiceChannel) {
    // Member is not in a voice channel
    // Nothing to relay
    return;
  }

  // Step 2: Get the webhook
  const webhook = await getWebhook(voiceChannel);
  const member = message.member as GuildMember;
  await webhook.send({
    content: message.content,
    username: member.displayName,
    avatarURL: member.user.avatarURL() ?? undefined,
  });
}

async function relayMessageFromVoiceChannelToArchiveThread(message : Message) {
  // Step 1: Get the archive channel
  const channel = message.channel as VoiceChannel;
  const guild = channel.guild;
  const archiveChannel = await getArchiveChannel(guild);

  // Step 2: Get the thread
  let thread = threadsByChannelId.get(channel.id);
  const channelId = channel.id;
  const date = new Date().toISOString();
  if(!thread) {
    // Create the thread
    thread = await archiveChannel.threads.create({
      name: `Archive of ${channelId} @${date}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });
    threadsByChannelId.set(channel.id, thread);
    channelsByThreadId.set(thread.id, channel);
  }

  // Step 3: Get the webhook
  const webhook = await getWebhook(archiveChannel);

  // Step 4: Relay the message
  const member = message.member as GuildMember;
  await webhook.send({
    content: message.content,
    username: member.displayName,
    avatarURL: member.user.avatarURL() ?? undefined,
    threadId: thread.id,
  });
}

async function getArchiveChannel(guild: Guild) {
  const channels = guild.channels;
  const archiveChannel = await channels.fetch(ARCHIVE_CHANNEL_ID);
  if (!archiveChannel) {
    // Probably failed to fetch the channel
    throw new Error("Archive channel not found");
  }
  if (archiveChannel.type !== ChannelType.GuildText) {
    // If this ever happens, ARCHIVE_CHANNEL_ID was misconfigured or Discord now allows text channels to be converted to voice channels
    throw new Error("Archive channel is not a text channel");
  }
  return archiveChannel;
}

async function getWebhook(channel: VoiceChannel | TextChannel) {
  const guild = channel.guild;
  const webhooks = await guild.fetchWebhooks();
  const webhook = webhooks.get(LEGACY_VOICE_WEBHOOK_ID);
  if (!webhook) {
    // Probably failed to fetch the webhook
    throw new Error("Archive webhook not found");
  }
  if (webhook.channelId !== channel.id) {
    await webhook.edit({ channel });
  }
  return webhook;
}
