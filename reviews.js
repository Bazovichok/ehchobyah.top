document.getElementById('toggle_music').addEventListener('click', function() {
    var music = document.getElementById('background_music');
    if (music.paused) {
        music.play();
        this.textContent = '♫'; // Иконка включенной музыки
    } else {
        music.pause();
        this.textContent = '🔇'; // Иконка выключенной музыки
    }
});





document.getElementById('review-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value;
    const reviewText = document.getElementById('review-text').value;
    const date = new Date().toLocaleString();
    
    const reviewItem = document.createElement('div');
    reviewItem.classList.add('review-item');
    reviewItem.innerHTML = `
        <p><strong>${nickname}</strong> - ${date}</p>
        <p>${reviewText}</p>
    `;
    
    document.getElementById('reviews-list').appendChild(reviewItem);
    
    document.getElementById('send_sound').play();
    document.getElementById('review-form').reset();

});