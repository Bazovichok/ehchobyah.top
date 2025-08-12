const channels = ["avenuegang1", "avenuemp3", "vtrende_music"];

async function fetchPosts(channel) {
  try {
    const url = `https://t.me/s/${channel}`;
    const response = await axios.get(url, { timeout: 10000 });
    const parser = new DOMParser();
    const doc = parser.parseFromString(response.data, "text/html");
    const posts = [];

    const messageElements = doc.querySelectorAll("div.tgme_widget_message");
    messageElements.forEach((postEl) => {
      const urlElement = postEl.querySelector("a.tgme_widget_message_date");
      const url = urlElement ? urlElement.getAttribute("href") : "";

      const timeElement = postEl.querySelector("time");
      const timestamp = timeElement
        ? timeElement.getAttribute("datetime")
        : new Date().toISOString();

      const textEl = postEl.querySelector("div.tgme_widget_message_text");
      const text = textEl ? textEl.textContent.trim() : "";

      const photoEl = postEl.querySelector("a.tgme_widget_message_photo_wrap");
      const videoEl = postEl.querySelector("video source, video");
      let media = null;

      if (photoEl) {
        const style = photoEl.getAttribute("style") || "";
        const match = /url\('([^']+)'\)/.exec(style);
        if (match) {
          media = { type: "photo", url: match[1] };
        }
      } else if (videoEl) {
        const videoSrc =
          videoEl.getAttribute("src") ||
          videoEl.querySelector("source")?.getAttribute("src") ||
          "";
        if (videoSrc) {
          media = { type: "video", url: videoSrc };
        }
      }

      if (
        url &&
        !text.toLowerCase().includes("#реклама") &&
        !text.toLowerCase().includes("розыгрыш")
      ) {
        posts.push({ url, timestamp, text, media });
      }
    });

    return posts;
  } catch (error) {
    console.error(`Ошибка при загрузке канала ${channel}:`, error.message);
    return [];
  }
}

function renderPosts(posts) {
  const container = document.getElementById("posts-container");
  const loading = document.getElementById("loading");

  loading.style.display = "none";
  container.innerHTML = "";

  if (posts.length === 0) {
    container.innerHTML = "<p>Не удалось загрузить посты</p>";
    return;
  }

  posts.forEach((post) => {
    const postElement = document.createElement("div");
    postElement.className = "post";

    const date = new Date(post.timestamp).toLocaleString();

    let mediaHTML = "";
    if (post.media) {
      if (post.media.type === "photo") {
        mediaHTML = `<div class="post-media"><img src="${post.media.url}" alt="Изображение поста"></div>`;
      } else if (post.media.type === "video") {
        mediaHTML = `<div class="post-media"><video controls><source src="${post.media.url}" type="video/mp4"></video></div>`;
      }
    }

    postElement.innerHTML = `
      <div class="post-date">
        <a href="${post.url}" target="_blank">${date}</a>
      </div>
      <div class="post-text">${post.text}</div>
      ${mediaHTML}
    `;

    container.appendChild(postElement);
  });
}

async function main() {
  let allPosts = [];
  for (const channel of channels) {
    const posts = await fetchPosts(channel);
    allPosts = allPosts.concat(posts);
  }

  const uniquePosts = Array.from(new Set(allPosts.map((p) => p.url))).map(
    (url) => allPosts.find((p) => p.url === url)
  );

  uniquePosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const topPosts = uniquePosts.slice(0, 50);

  renderPosts(topPosts);
}

// Запускаем при загрузке страницы
document.addEventListener("DOMContentLoaded", main);
