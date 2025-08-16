// Инициализация Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBWTq4kFtsD0dFUc5ZlrCAcXUmi9p-JiTE",
  authDomain: "ehchobyahzavoz.firebaseapp.com",
  projectId: "ehchobyahzavoz",
  // ...
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Загрузка комментариев с Firestore с пагинацией
let comments = [];
let currentPage = 1;
const COMMENTS_PER_PAGE = 40;

// Функция загрузки всех комментариев
async function loadComments() {
  const snapshot = await db.collection("reviews")
                           .orderBy("timestamp")
                           .get();
  comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderPage(currentPage);
}

// Рендер подстраницы
function renderPage(page) {
  const start = (page - 1) * COMMENTS_PER_PAGE;
  const end = start + COMMENTS_PER_PAGE;
  const pageComments = comments.slice(start, end);

  const container = document.getElementById("comments-container");
  container.innerHTML = "";
  pageComments.forEach(comment => {
    const div = document.createElement("div");
    div.className = "comment";
    div.setAttribute("data-timestamp", comment.timestamp);
    // Ник и время
    div.innerHTML = `
      <span class="username">${comment.nickname}</span>
      <span class="timestamp">${comment.timestamp}</span>
      <div class="text">${parseTags(comment.text)}</div>
    `;
    // Медиафайлы
    if (comment.images && comment.images.length > 0) {
      comment.images.forEach((imgUrl, idx) => {
        const img = document.createElement("img");
        img.src = imgUrl;
        img.dataset.index = idx;
        img.dataset.current = 0;
        img.addEventListener("click", onImageClick);
        div.appendChild(img);
      });
      if (comment.audio) {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.src = comment.audio;
        div.appendChild(audio);
      }
    } else if (comment.audio) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = comment.audio;
      div.appendChild(audio);
    }
    container.appendChild(div);
  });
  document.getElementById("page-number").textContent = page;
  document.getElementById("prev-btn").disabled = (page === 1);
  document.getElementById("next-btn").disabled = (end >= comments.length);
}

// Обработка клика по изображению: убираем/добавляем размытие или переключаем картинку
function onImageClick(event) {
  const img = event.currentTarget;
  const parent = img.parentElement;
  const imgs = parent.querySelectorAll("img");
  if (imgs.length === 1) {
    // Одинокое изображение: просто toggle blur
    img.classList.toggle("unblur");
  } else {
    // Два изображения: переключаемся между ними
    let currentIdx = Number(img.dataset.current);
    if (!img.classList.contains("unblur")) {
      // Если размытие включено, убираем размытие текущей
      img.classList.add("unblur");
    } else {
      // Если текущая уже без размытия, показываем следующую картинку
      img.classList.remove("unblur");
      imgs.forEach((el, idx) => {
        if (idx !== currentIdx) {
          el.style.display = "none";
          el.classList.remove("unblur");
        } else {
          el.style.display = "";
        }
      });
      const nextIdx = (currentIdx + 1) % imgs.length;
      const nextImg = imgs[nextIdx];
      nextImg.style.display = "";
      nextImg.dataset.current = nextIdx;
      nextImg.classList.add("unblur");
    }
  }
}

// Разбор текста комментария на теги вида @dd.MM.yyyy, hh:mm:ss
function parseTags(text) {
  // Регулярное выражение даты-времени
  const regex = /@(\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2})/g;
  return text.replace(regex, (_, ts) => {
    // Создаем span-метку с обработчиком
    return `<span class="tag" data-target="${ts}">@${ts}</span>`;
  });
}

// Обработчик клика по метке @дата (делегируется документу)
document.addEventListener("click", function(event) {
  if (event.target.classList.contains("tag")) {
    const targetTs = event.target.dataset.target;
    // Найдем индекс комментария с нужным timestamp
    const idx = comments.findIndex(c => c.timestamp === targetTs);
    if (idx !== -1) {
      const page = Math.floor(idx / COMMENTS_PER_PAGE) + 1;
      if (page !== currentPage) {
        currentPage = page;
        renderPage(page);
      }
      // Прокрутка и подсветка
      const el = document.querySelector(`.comment[data-timestamp="${targetTs}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" }); 
        el.classList.add("highlighted");
        setTimeout(() => el.classList.remove("highlighted"), 3000);
      }
    }
  }
});

// Навигация между страницами
document.getElementById("prev-btn").addEventListener("click", () => {
  if (currentPage > 1) {
    renderPage(--currentPage);
  }
});
document.getElementById("next-btn").addEventListener("click", () => {
  if ((currentPage * COMMENTS_PER_PAGE) < comments.length) {
    renderPage(++currentPage);
  }
});

// Отправка нового комментария
document.getElementById("review-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nickname = document.getElementById("nickname").value.trim();
  const text = document.getElementById("comment").value.trim();
  const mediaInput = document.getElementById("media-input");
  const files = Array.from(mediaInput.files).slice(0, 2); // максимум 2 файла

  const newComment = { nickname, text, timestamp: getCurrentTs(), images: [], audio: null };
  // Загрузка файлов в Cloudinary
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "reviews_unsigned");
    const res = await fetch("https://api.cloudinary.com/v1_1/dp0smiea6/upload", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (file.type.startsWith("image/")) newComment.images.push(data.secure_url);
    if (file.type.startsWith("audio/")) newComment.audio = data.secure_url;
  }

  // Добавление в Firestore
  await db.collection("reviews").add(newComment);
  // Перезагрузка комментариев
  await loadComments();
  document.getElementById("review-form").reset();
});

// Получение текущей даты-времени в формате dd.MM.yyyy, HH:mm:ss
function getCurrentTs() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(now.getDate())}.${pad(now.getMonth()+1)}.${now.getFullYear()}, ` +
         `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// Инициализация
loadComments();
