const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const channels = ['avenuegang1', 'avenuemp3', 'vtrende_music'];

async function fetchPosts(channel) {
  try {
    const url = `https://t.me/s/${channel}`;
    const response = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data);
    const posts = [];

    $('div.tgme_widget_message').each((i, el) => {
      const postEl = $(el);
      const url = postEl.find('a.tgme_widget_message_date').attr('href') || '';
      const timestamp = postEl.find('time').attr('datetime') || new Date().toISOString();
      const textEl = postEl.find('div.tgme_widget_message_text');
      let text = textEl.length ? textEl.html() : '';
      
      // Удаляем ссылки, сохраняя остальной текст и HTML (для эмодзи и форматирования)
      if (text) {
        const $text = cheerio.load(text);
        $text('a').replaceWith(''); // Удаляем теги <a>
        text = $text.html().trim();
      } else {
        text = '';
      }

      const photoEl = postEl.find('a.tgme_widget_message_photo_wrap');
      const videoEl = postEl.find('video source, video');
      let media = null;

      if (photoEl.length) {
        const style = photoEl.attr('style') || '';
        const match = /url\('([^']+)'\)/.exec(style);
        if (match) {
          media = { type: 'photo', url: match[1] };
        }
      } else if (videoEl.length) {
        const videoSrc = videoEl.attr('src') || videoEl.find('source').attr('src') || '';
        if (videoSrc) {
          media = { type: 'video', url: videoSrc };
        }
      }

      if (url && !text.toLowerCase().includes('#реклама') && !text.toLowerCase().includes('розыгрыш')) {
        posts.push({ url, timestamp, text, media });
      }
    });

    return posts;
  } catch (error) {
    console.error(`Ошибка при загрузке канала ${channel}:`, error.message);
    return [];
  }
}

async function main() {
  let allPosts = [];
  for (const channel of channels) {
    const posts = await fetchPosts(channel);
    allPosts = allPosts.concat(posts);
  }

  const uniquePosts = Array.from(new Set(allPosts.map(p => p.url)))
    .map(url => allPosts.find(p => p.url === url));

  uniquePosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const topPosts = uniquePosts.slice(0, 50);

  fs.writeFileSync('news.json', JSON.stringify(topPosts, null, 2));
}

main().catch(error => {
  console.error('Ошибка выполнения скрипта:', error);
  process.exit(1);
});