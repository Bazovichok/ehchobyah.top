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

      const uniqueMedia = [...new Set(media.map(m => m.url))].map(url => media.find(m => m.url === url));

      if (url && !text.toLowerCase().includes('#реклама') && !text.toLowerCase().includes('розыгрыш')) {
        posts.push({ url, timestamp, text, media: uniqueMedia });
      }
    });

    return posts;
  } catch (error) {
    console.error(`Ошибка при загрузке канала ${channel}:`, error.message);
    return [];
  }
}

async function main() {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - 15); // Полмесяца назад

  const allPostsPromises = channels.map(channel => fetchPosts(channel));
  const allPostsArrays = await Promise.all(allPostsPromises);
  let allPosts = allPostsArrays.flat();

  const uniquePosts = [...new Set(allPosts.map(p => p.url))].map(url => allPosts.find(p => p.url === url));

  uniquePosts.sort((a, b) => {
    const timeA = new Date(a.timestamp);
    timeA.setHours(timeA.getHours() + 3); // Moscow time
    const timeB = new Date(b.timestamp);
    timeB.setHours(timeB.getHours() + 3);
    return timeB - timeA; // Новые сверху
  });

  const topPosts = uniquePosts.filter(p => new Date(p.timestamp) >= minDate).slice(0, 500); // Для полной ленты

  fs.writeFileSync('news.json', JSON.stringify(topPosts, null, 2));
}

main().catch(error => {
  console.error('Ошибка выполнения скрипта:', error);
  process.exit(1);
});