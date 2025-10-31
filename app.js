// ==========================================================
// KAF33F3 TV – FINAL APP.JS
// Frontend logic for TMDb movies, login, watchlist, admin upload
// ==========================================================

const API_BASE = "http://localhost:3000";  // change if backend is on a server

// TMDb poster URL helper
const TMDB_IMG = (p, size = "w500") =>
  p ? `https://image.tmdb.org/t/p/${size}${p}` : "/placeholder_poster.png";

// DOM helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// GLOBAL STATE
const state = {
  token: localStorage.getItem("kaf_token") || null,
  user: null,
  combined: [],
};

// ==========================================================
// AUTH HANDLING
// ==========================================================

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  return res.json();
}

function saveAuth(data) {
  if (data.token) {
    state.token = data.token;
    localStorage.setItem("kaf_token", data.token);
  }
  state.user = data.user;
  renderAuthUI();
}

function logout() {
  state.user = null;
  state.token = null;
  localStorage.removeItem("kaf_token");
  renderAuthUI();
}

// Render Login/Register or User info
function renderAuthUI() {
  const sec = $("#authArea");
  if (!sec) return;

  sec.innerHTML = "";

  if (!state.token) {
    sec.innerHTML = `
      <button id="loginBtn">Login</button>
      <button id="registerBtn">Register</button>
    `;
  } else {
    sec.innerHTML = `
      <span>${state.user?.name || state.user?.email}</span>
      <button id="logoutBtn">Logout</button>
    `;
  }

  // Events
  $("#loginBtn")?.addEventListener("click", showLoginModal);
  $("#registerBtn")?.addEventListener("click", showRegisterModal);
  $("#logoutBtn")?.addEventListener("click", logout);
}

// LOGIN MODAL
function showLoginModal() {
  const html = `
    <div class="modal simple" id="authModal">
      <div class="modal-box">
        <h3>Login</h3>
        <input id="li_email" placeholder="Email">
        <input id="li_pass" placeholder="Password" type="password">
        <button id="li_submit">Login</button>
        <button id="li_close">Close</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);

  $("#li_close").addEventListener("click", () => $("#authModal").remove());
  $("#li_submit").addEventListener("click", async () => {
    const email = $("#li_email").value;
    const password = $("#li_pass").value;

    const r = await fetch(API_BASE + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await r.json();
    if (json.token) {
      saveAuth(json);
      $("#authModal").remove();
    } else alert(json.error || "Login failed");
  });
}

// REGISTER MODAL
function showRegisterModal() {
  const html = `
    <div class="modal simple" id="authModal">
      <div class="modal-box">
        <h3>Register</h3>
        <input id="rg_name" placeholder="Full Name">
        <input id="rg_email" placeholder="Email">
        <input id="rg_password" type="password" placeholder="Password">
        <button id="rg_submit">Register</button>
        <button id="rg_close">Close</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);

  $("#rg_close").addEventListener("click", () => $("#authModal").remove());
  $("#rg_submit").addEventListener("click", async () => {
    const name = $("#rg_name").value;
    const email = $("#rg_email").value;
    const password = $("#rg_password").value;

    const r = await fetch(API_BASE + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const json = await r.json();
    if (json.token) {
      saveAuth(json);
      $("#authModal").remove();
    } else alert(json.error || "Registration failed");
  });
}

// ==========================================================
// LOAD MOVIES
// ==========================================================

async function loadMovies() {
  const res = await api("/api/movies/combined");

  // combine TMDb + local uploaded movies
  state.combined = [
    ...(res.local || []),
    ...(res.tmdb || []),
  ];

  renderTrending();
  renderGrid();
}

// ==========================================================
// RENDER UI
// ==========================================================

// Movie Cards
function createCard(item) {
  const div = document.createElement("div");
  div.className = "movie-card";

  const poster =
    item.provider === "local"
      ? item.poster
      : TMDB_IMG(item.poster_path);

  div.innerHTML = `
    <img src="${poster}">
    <div class="movie-title">${item.title}</div>
  `;

  div.addEventListener("click", () => openModal(item));

  return div;
}

function renderGrid(list = state.combined) {
  const grid = $("#movieGrid");
  grid.innerHTML = "";
  list.forEach((item) => grid.appendChild(createCard(item)));
}

function renderTrending() {
  const wrap = $("#trendingSlider");
  wrap.innerHTML = "";

  state.combined.slice(0, 6).forEach((item) => {
    const div = document.createElement("div");
    div.className = "tr-card";

    const poster =
      item.provider === "local"
        ? item.poster
        : TMDB_IMG(item.poster_path, "w300");

    div.innerHTML = `<img src="${poster}">`;
    div.addEventListener("click", () => openModal(item));

    wrap.appendChild(div);
  });
}

// ==========================================================
// MODAL VIEW
// ==========================================================

async function openModal(item) {
  $("#movieModal").style.display = "flex";

  const details =
    item.provider === "local"
      ? item
      : await api("/api/movie/" + item.id);

  // Fill modal
  $("#modalPoster").style.backgroundImage =
    item.provider === "local"
      ? `url(${item.poster})`
      : `url(${TMDB_IMG(details.poster_path)})`;

  $("#modalTitle").textContent = details.title;
  $("#modalOverview").textContent = details.overview;
  $("#modalRating").textContent = details.vote_average || "—";

  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("#movieModal").style.display = "none";
  document.body.style.overflow = "";
}

$("#modalClose")?.addEventListener("click", closeModal);
$("#modalCloseBtn")?.addEventListener("click", closeModal);

// ==========================================================
// SEARCH
// ==========================================================

$("#searchInput").addEventListener("input", async (e) => {
  const q = e.target.value.trim();

  if (!q) return renderGrid();

  const res = await api("/api/search?q=" + encodeURIComponent(q));

  const list = (res.results || []).map((m) => ({
    provider: "tmdb",
    id: m.id,
    title: m.title,
    poster_path: m.poster_path,
    overview: m.overview,
  }));

  renderGrid(list);
});

// ==========================================================
// CATEGORY FILTERS
// ==========================================================

const CATEGORY_GENRES = {
  Anime: ["Animation", "Anime"],
  "K-Drama": ["Drama", "Romance", "TV"],
  Nollywood: ["Nollywood", "Drama"],
};

$$(".cat").forEach((btn) =>
  btn.addEventListener("click", () => {
    const cat = btn.textContent.trim();
    const genres = CATEGORY_GENRES[cat] || [];

    const filtered = state.combined.filter((i) => {
      const g = (i.genres || []).map((x) => x.name || x);
      return g.some((v) => genres.includes(v));
    });

    renderGrid(filtered);
  })
);

// ==========================================================
// ADMIN UPLOAD (SIMPLE)
// ==========================================================

function showAdminUpload() {
  if (!state.user || state.user.role !== "admin") {
    return alert("Admin only");
  }

  const html = `
    <div class="modal simple" id="adminModal">
      <div class="modal-box">
        <h3>Upload Movie</h3>
        <input id="au_title" placeholder="Title">
        <input id="au_year" placeholder="Year">
        <input id="au_genres" placeholder="Genres (comma)">
        <textarea id="au_overview" placeholder="Overview"></textarea>
        <input id="au_poster" type="file">
        <button id="au_submit">Upload</button>
        <button id="au_close">Close</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", html);

  $("#au_close").addEventListener("click", () => $("#adminModal").remove());

  $("#au_submit").addEventListener("click", async () => {
    const fd = new FormData();
    fd.append("title", $("#au_title").value);
    fd.append("year", $("#au_year").value);
    fd.append("genres", $("#au_genres").value);
    fd.append("overview", $("#au_overview").value);
    if ($("#au_poster").files[0]) fd.append("poster", $("#au_poster").files[0]);

    const r = await fetch(API_BASE + "/api/admin/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + state.token },
      body: fd,
    });

    const json = await r.json();
    if (json.ok) {
      alert("Uploaded");
      $("#adminModal").remove();
      loadMovies();
    } else {
      alert(json.error || "Upload failed");
    }
  });
}

// ==========================================================
// INIT APP
// ==========================================================

document.addEventListener("DOMContentLoaded", async () => {
  renderAuthUI();
  await loadMovies();

  // SHOW ADMIN BUTTON
  setInterval(() => {
    const btn = $("#adminBtn");
    if (!btn) return;
    btn.style.display =
      state.user && state.user.role === "admin" ? "block" : "none";
  }, 600);
});
