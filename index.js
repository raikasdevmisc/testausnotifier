const Discord = require('discord.js')
const yt = require('yt-channel-info');
const fs = require('fs');
const {
  NodeHtmlMarkdown
} = require('node-html-markdown');
const Parser = require('rss-parser');
const rssParser = new Parser();
const webhook = new Discord.WebhookClient(process.env.WEBHOOK_ID, process.env.WEBHOOK_SECRET);

const config = require('./config.json');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

const save = (dataToSave) => {
  fs.writeFile('data.json', dataToSave, function(err) {
    if (err) return console.log(err);
    console.log('Saved');
  });
};

const getNewVideos = async () => {
  return (await Promise.all(config.youtube.map((channel) => new Promise(async (resolve, reject) => {
    try {
      const videos = (await yt.getChannelVideos(channel)).items;
      const oldVideo = data.youtube[channel] || {
        videoId: ''
      };
      console.log(JSON.stringify(videos))
      if (oldVideo.videoId !== videos[0].videoId) {
        data.youtube[channel] = videos[0];
        resolve(videos[0]);
      }
      resolve(null);
    } catch (e) {
      reject(e);
    }
  })))).filter(i => i !== null);
};

const getNewPodcastEpisodes = async () => {
  return (await Promise.all(config.podcast.map((channel) => new Promise(async (resolve, reject) => {
    try {
      const feed = await rssParser.parseURL(channel);
      const oldEpisode = data.podcast[channel] || {};
      if (oldEpisode.title !== feed.items[0].title) {
        data.podcast[channel] = feed.items[0];
        resolve({
          title: feed.title,
          image: feed.image.url,
          episode: feed.items[0]
        });
      }
      resolve(null);
    } catch (e) {
      reject(e);
    }
  })))).filter(i => i !== null);
};

const run = async () => {
  const newVideos = await getNewVideos();
  const newPodcastEpisodes = await getNewPodcastEpisodes();
  save(JSON.stringify(data, null, 2));
  await Promise.all(newPodcastEpisodes.map(async (podcast) => {
    const embed = new Discord.MessageEmbed()
      .setTitle(`${podcast.title}: ${podcast.episode.title}`)
      .setURL(podcast.episode.link)
      .setThumbnail(podcast.image)
      .setDescription(`${NodeHtmlMarkdown.translate(podcast.episode.content)}`)
      .setColor(0xff00ff)
    await webhook.send(config.ping.join(" "), {
      username: 'TestausNotifier',
      avatarURL: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/160/twitter/53/bell_1f514.png',
      embeds: [embed],
    });
    return
  }))
  await Promise.all(newVideos.map(async (video) => {
    const embed = new Discord.MessageEmbed()
      .setTitle(`${video.author}: ${video.title}`)
      .setURL(`https://youtube.com/watch?v=${video.videoId}`)
      .setImage(video.videoThumbnails[video.videoThumbnails.length - 1].url)
      .setColor(0xff0000)
      .setFooter(`Julkaistu ${video.publishedText}`);
    await webhook.send(config.ping.join(" "), {
      username: 'TestausNotifier',
      avatarURL: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/160/twitter/53/bell_1f514.png',
      embeds: [embed],
    });
    return
  }));
  webhook.destroy();
}

run();
