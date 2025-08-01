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
    
    document.getElementById('review-form').reset();
});