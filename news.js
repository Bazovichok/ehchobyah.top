async function fetchNews() {
    try {
        const channels = [
            'avenuegang1',
            'avenuemp3',
            'vtrende_music'
        ];

        const news = [];

        for (const channel of channels) {
            const response = await fetch(`https://cors-anywhere.herokuapp.com/https://tgstat.ru/api/v1/channels/posts?channel=${channel}&limit=10`);
            const data = await response.json();
            const posts = data.posts.filter(post => !post.text.includes('#реклама'));
            news.push(...posts.map(post => post.text));
        }

        displayNews(news);
    } catch (error) {
        console.error('Ошибка при получении новостей:', error);
    }
}

function displayNews(news) {
    const newsList = document.getElementById('news-list');
    news.forEach(item => {
        const newsItem = document.createElement('div');
        newsItem.classList.add('news-item');
        newsItem.innerHTML = `<p>${item}</p>`;
        newsList.appendChild(newsItem);
    });
}

fetchNews();