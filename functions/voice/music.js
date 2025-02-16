const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const auth = require('../authorization');
const { EmbedBuilder } = require('discord.js');
const { sleep } = require('../../functions/helpers');
const { buildText } = require('../../functions/language');
const { createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
    play: async function(message, song) {
        const queue = message.client.queue;
        const serverQueue = queue.get(message.guild.id);
    
        if (!song) {
            queue.delete(message.guild.id);
            return;
        }

        serverQueue.player.play(await module.exports.getSong(message, song, true));
        serverQueue.player.on(AudioPlayerStatus.Idle, async () => {
            serverQueue.player.play(await module.exports.getSong(message, serverQueue.songs[0]));
        });

        serverQueue.player.on('error', async error => {
            message.client.log.sendError(message.client, error, message);
            serverQueue.player.play(await module.exports.getSong(message, serverQueue.songs[0]));
        });
    },
    
    getSong: async function(message, song, firstPlay = false) {
        const queue = message.client.queue;
        const serverQueue = queue.get(message.guild.id);

        if (!firstPlay) if (serverQueue.songs.length > 0) if (!serverQueue.songs[0].loop) {
            serverQueue.songs.shift();
            song = serverQueue.songs[0];
        }
        
        if (song.spotifyURL && !song.url.includes("youtube")) {
            let vr = await ytSearch(song.title);
            song.url = (vr.videos.length > 1) ? vr.videos[0].url : null;
            if (song.url === null) return infoMsg(message, 'AA5320', await buildText("music_cannot_played", client, { guild: message.guild.id }));
            song.timestamp = [vr.videos[0].duration.timestamp, (vr.videos[0].duration.seconds * 1000)];
        }

        return new Promise(async (resolve, reject) => {
            const resource = await createAudioResource(
                ytdl(song.url, {
                    filter: "audioonly",
                    fmt: "mp3",
                    highWaterMark: 1 << 25,
                    liveBuffer: 1 << 25,
                    dlChunkSize: 0,
                    bitrate: 128,
                    quality: "highestaudio"
                }), {
                metadata: {
                    title: song.title,
                }
            });

            const videoEmbed = new EmbedBuilder()
                .setColor('Random')
                .setDescription(`[${song.title}](${(song.spotifyURL) ? song.spotifyURL : song.url})`)
                .setAuthor({ name: await buildText("music_playing", message.client, { guild: message.guild.id, variables: [song.timestamp[0]] }), iconURL: 'https://i.imgur.com/5ZbX7RV.png' })
                .setTimestamp()
                .setFooter({ text: message.author.username + '#' + message.author.discriminator });
        
            if (serverQueue.songs.length > 0) if (!serverQueue.songs[0].loop) serverQueue.textChannel.send({ embeds: [videoEmbed] });

            resolve(resource);
        });
    },

    getSpotifyTrack: async function(url) {
        var regex = /https:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]{15,})/;
        var match = url.match(regex);
        var category = match[1];
        var id = match[2];

        if (category === "track") {
            const data = await auth.spotify(`https://api.spotify.com/v1/tracks/${id}`);
            const track = {
                title: `${data.artists[0].name} - ${data.name}`,
                url: data.external_urls.spotify,
            }
            return track;
        } else if (category === "album") {
            const data = await auth.spotify(`https://api.spotify.com/v1/albums/${id}`);
            const tracks = [];
            data.tracks.items.forEach(item => {
                tracks.push({
                    title: `${item.artists[0].name} - ${item.name}`,
                    url: item.external_urls.spotify,
                });
            });
            return tracks;
        } else if (category === "playlist") {
            const data = await auth.spotify(`https://api.spotify.com/v1/playlists/${id}`);
            const tracks = [];
            data.tracks.items.forEach(item => {
                if (item.track) {
                    tracks.push({
                        title: `${item.track.artists[0].name} - ${item.track.name}`,
                        url: item.track.external_urls.spotify,
                    });
                }
            });
            return tracks;
        } else {
            return false;
        }
    },
}