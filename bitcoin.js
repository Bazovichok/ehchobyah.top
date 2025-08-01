const updateButton = document.getElementById('update-button');
const bitcoinRate = document.getElementById('bitcoin-rate');
const trendArrow = document.getElementById('trend-arrow');

let lastRate = 0;

async function fetchBitcoinRate() {
    try {
        const response = await fetch('https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD');
        const data = await response.json();
        const currentRate = data.USD;
        bitcoinRate.textContent = `$${currentRate.toFixed(2)}`;
        
        
        if (currentRate > lastRate) {
            trendArrow.textContent = '↑';
            trendArrow.style.color = 'green';
        } else if (currentRate < lastRate) {
            trendArrow.textContent = '↓';
            trendArrow.style.color = 'red';
        } else {
            trendArrow.textContent = '→';
            trendArrow.style.color = 'black';
        }
        
        lastRate = currentRate;
    } catch (error) {
        console.error('Ошибка при получении курса:', error);
    }
}

updateButton.addEventListener('click', fetchBitcoinRate);

// Загрузка курса при открытии страницы
fetchBitcoinRate();