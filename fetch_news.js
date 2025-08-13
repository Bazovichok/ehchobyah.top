const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const channels = ['avenuegang1', 'avenuemp3', 'vtrende_music'];
const maxPages = 10; // Макс страниц на канал
const minDate = new Date('2025-07-13T00:00:00Z'); // Последний месяц

async function fetchPosts(channel, before = null) {
  try {
    let url = `https://t.me/s/${channel}`;
    if (before) url += `?before=${before}`;
    const response = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data);
    const posts = [];
    let oldestId = Infinity;

    $('div.tgme_widget_message').each((i, el) => {
      const postEl = $(el);
      const url = postEl.find('a.tgme_widget_message_date').attr('href') || '';
      const timestamp = postEl.find('time').attr('datetime') || new Date().toISOString();
      const textEl = postEl.find('div.tgme_widget_message_text');
      let text = textEl.length ? textEl.html() : '';
      
      if (text) {
        const $text = cheerio.load(text);
        $text('a').replaceWith('');
        text = $text.html().trim();
      } else {
        text = '';
      }

      const media = [];
      postEl.find('a.tgme_widget_message_photo_wrap').each((j, mediaEl) => {
        const style = $(mediaEl).attr('style') || '';
        const match = /url\('([^']+)'\)/.exec(style);
        if (match) {
          media.push({ type: 'photo', url: match[1] });
        }
      });
      postEl.find('video source, video').each((j, mediaEl) => {
        const videoSrc = $(mediaEl).attr('src') || $(mediaEl).find('source').attr('src') || '';
        if (videoSrc) {
          media.push({ type: 'video', url: videoSrc });
        }
      });

      // Dedup медиа
      const uniqueMedia = [...new Set(media.map(m => m.url))].map(url => media.find(m => m.url === url));

      if (url && !text.toLowerCase().includes('#реклама') && !text.toLowerCase().includes('розыгрыш')) {
        posts.push({ url, timestamp, text, media: uniqueMedia });
        const msgId = parseInt(url.split('/').pop()) || 0;
        if (msgId < oldestId) oldestId = msgId;
      }
    });

    return { posts, nextBefore: oldestId > 0 ? oldestId : null };
  } catch (error) {
    console.error(`Ошибка при загрузке канала ${channel}:`, error.message);
    return { posts: [], nextBefore: null };
  }
}

async function main() {
  let allPosts = [];
  for (const channel of channels) {
    let before = null;
    for (let page = 0; page < maxPages; page++) {
      const { posts, nextBefore } = await fetchPosts(channel, before);
      allPosts = allPosts.concat(posts);
      if (!nextBefore || new Date(posts[posts.length - 1]?.timestamp || 0) < minDate) break;
      before = nextBefore;
    }
  }

  const uniquePosts = [...new Set(allPosts.map(p => p.url))].map(url => allPosts.find(p => p.url === url));

  uniquePosts.sort((a, b) => {
    const timeA = new Date(a.timestamp);
    timeA.setHours(timeA.getHours() + 3);
    const timeB = new Date(b.timestamp);
    timeB.setHours(timeB.getHours() + 3);
    return timeB - timeA;
  });

  const topPosts = uniquePosts.filter(p => new Date(p.timestamp) >= minDate).slice(0, 300);

  fs.writeFileSync('news.json', JSON.stringify(topPosts, null, 2));
}

main().catch(error => {
  console.error('Ошибка выполнения скрипта:', error);
  process.exit(1);
});