const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const channels = ['avenuegang1', 'avenuemp3', 'vtrende_music'];

async function fetchPosts(channel) {
  const url = `https://t.me/s/${channel}`;
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  const posts = [];

  $('div.tgme_widget_message').each((i, el) => {
    const postEl = $(el);
    const url = postEl.find('a.tgme_widget_message_date').attr('href');
    const timestamp = postEl.find('time').attr('datetime');
    const textEl = postEl.find('div.tgme_widget_message_text');
    const text = textEl.length ? textEl.text() : '';
    const photoEl = postEl.find('a.tgme_widget_message_photo_wrap');
    const videoEl = postEl.find('video source');
    let media = null;
    if (photoEl.length) {
      const style = photoEl.attr('style');
      const match = /url\('([^']+)'\)/.exec(style);
      if (match) {
        media = { type: 'photo', url: match[1] };
      }
    } else if (videoEl.length) {
      media = { type: 'video', url: videoEl.attr('src') };
    }
    posts.push({ url, timestamp, text, media });
  });

  return posts;
}

async function main() {
  let allPosts = [];
  for (const channel of channels) {
    const posts = await fetchPosts(channel);
    allPosts = allPosts.concat(posts);
  }

  // Удаление дубликатов по URL
  const uniquePosts = Array.from(new Set(allPosts.map(p => p.url)))
    .map(url => allPosts.find(p => p.url === url));

  // Фильтрация постов с #реклама или розыгрыш
  const filteredPosts = uniquePosts.filter(p => {
    const lowerText = p.text.toLowerCase();
    return !lowerText.includes('#реклама') && !lowerText.includes('розыгрыш');
  });

  // Сортировка по времени (новые сверху)
  filteredPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Ограничение до 50 постов
  const topPosts = filteredPosts.slice(0, 50);

  // Сохранение в news.json
  fs.writeFileSync('news.json', JSON.stringify(topPosts, null, 2));
}

main().catch(console.error);