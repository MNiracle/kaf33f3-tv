// Simple frontend for Kaf33f3 TV — works with the provided backend
const API_BASE = "http://localhost:3000";
const TMDB_IMG = (p, size='w500') => p ? `https://image.tmdb.org/t/p/${size}${p}` : '/placeholder_poster.png';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let state = { token: localStorage.getItem('kaf_token') || null, user: null, combined: [] };

// API helper
async function api(path, opts={}) {
  const headers = opts.headers || {};
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  return res.json();
}

// AUTH UI
function renderAuthUI(){
  const sec = $('#authArea');
  sec.innerHTML = '';
  if (!state.token) {
    sec.innerHTML = `<button id="loginBtn">Login</button><button id="registerBtn">Register</button>`;
    $('#loginBtn').addEventListener('click', showLoginModal);
    $('#registerBtn').addEventListener('click', showRegisterModal);
  } else {
    sec.innerHTML = `<span>${state.user?.name||state.user?.email}</span><button id="logoutBtn">Logout</button>`;
    $('#logoutBtn').addEventListener('click', () => { state.token=null; state.user=null; localStorage.removeItem('kaf_token'); renderAuthUI(); });
  }
}

// LOGIN / REGISTER modals
function showLoginModal(){
  const html = `<div class="modal simple" id="authModal"><div class="modal-box">
  <h3>Login</h3><input id="li_email" placeholder="email"/><input id="li_pass" placeholder="password" type="password"/>
  <button id="li_submit">Login</button><button id="li_close">Close</button></div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  $('#li_close').addEventListener('click', ()=>$('#authModal').remove());
  $('#li_submit').addEventListener('click', async ()=>{
    const email = $('#li_email').value, password = $('#li_pass').value;
    const r = await fetch(API_BASE + '/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
    const j = await r.json();
    if (j.token){ state.token=j.token; state.user=j.user; localStorage.setItem('kaf_token', j.token); renderAuthUI(); $('#authModal').remove(); } else alert(j.error||'login failed');
  });
}
function showRegisterModal(){
  const html = `<div class="modal simple" id="authModal"><div class="modal-box">
  <h3>Register</h3><input id="rg_name" placeholder="Full name"/><input id="rg_email" placeholder="email"/><input id="rg_pass" placeholder="password" type="password"/>
  <button id="rg_submit">Register</button><button id="rg_close">Close</button></div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  $('#rg_close').addEventListener('click', ()=>$('#authModal').remove());
  $('#rg_submit').addEventListener('click', async ()=>{
    const name = $('#rg_name').value, email = $('#rg_email').value, password = $('#rg_pass').value;
    const r = await fetch(API_BASE + '/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});
    const j = await r.json();
    if (j.token){ state.token=j.token; state.user=j.user; localStorage.setItem('kaf_token', j.token); renderAuthUI(); $('#authModal').remove(); } else alert(j.error||'register failed');
  });
}

// LOAD & RENDER
async function loadCombined(){
  try{
    const res = await api('/api/movies/combined');
    state.combined = [...(res.local||[]), ...(res.tmdb||[])];
    renderTrending(); renderGrid();
  }catch(e){ console.error('load error',e) }
}

function createCard(item){
  const div = document.createElement('div'); div.className='movie-card';
  const poster = item.provider==='local' ? item.poster : (item.poster_path ? TMDB_IMG(item.poster_path) : '/placeholder_poster.png');
  div.innerHTML = `<img src="${poster}"><div class="movie-title">${item.title}</div>`;
  div.addEventListener('click', ()=> openModal(item));
  return div;
}
function renderGrid(list = state.combined){
  const grid = $('#movieGrid'); grid.innerHTML='';
  list.forEach(i=> grid.appendChild(createCard(i)));
}
function renderTrending(){
  const wrap = $('#trendingSlider'); wrap.innerHTML='';
  state.combined.slice(0,6).forEach(i=>{
    const d = document.createElement('div'); d.className='tr-card';
    const poster = i.provider==='local' ? i.poster : (i.poster_path? TMDB_IMG(i.poster_path,'w300') : '/placeholder_poster.png');
    d.innerHTML = `<img src="${poster}">`; d.addEventListener('click', ()=> openModal(i)); wrap.appendChild(d);
  });
}

// MODAL
async function openModal(item){
  $('#movieModal').style.display='flex';
  let details = item;
  if (item.provider === 'tmdb') {
    const d = await api('/api/movie/' + item.id);
    details = {...item, ...d};
  }
  $('#modalPoster').style.backgroundImage = item.provider==='local' ? `url(${details.poster})` : (details.poster_path ? `url(${TMDB_IMG(details.poster_path)})` : '');
  $('#modalTitle').textContent = details.title || details.name;
  $('#modalOverview').textContent = details.overview || '';
  $('#modalRating').textContent = details.vote_average || details.rating || '—';
  document.body.style.overflow='hidden';
}
function closeModal(){ $('#movieModal').style.display='none'; document.body.style.overflow=''; }
$('#modalClose')?.addEventListener('click', closeModal);
$('#modalCloseBtn')?.addEventListener('click', closeModal);

// SEARCH
$('#searchInput').addEventListener('input', async (e)=>{
  const q = e.target.value.trim();
  if (!q) return renderGrid();
  const res = await api('/api/search?q=' + encodeURIComponent(q));
  const list = (res.results || []).map(r => ({ provider:'tmdb', id:r.id, title:r.title, poster_path:r.poster_path, overview:r.overview }));
  renderGrid(list);
});

// CATEGORY BUTTONS
$$('.cat').forEach(btn => btn.addEventListener('click', ()=>{
  const cat = btn.textContent.trim();
  const filtered = state.combined.filter(i => (i.genres || []).map(g => (typeof g === 'string'? g : g.name)).includes(cat));
  renderGrid(filtered);
}));

// ADMIN button
$('#adminBtn').addEventListener('click', async ()=>{
  if (!state.token) return alert('login as admin');
  // show admin upload dialog (simple)
  const html = `<div class="modal simple" id="adminModal"><div class="modal-box"><h3>Upload Movie</h3>
  <input id="au_title" placeholder="Title"/><input id="au_year" placeholder="Year"/><input id="au_genres" placeholder="genres comma"/><textarea id="au_overview" placeholder="overview"></textarea>
  <input id="au_poster" type="file"/><button id="au_submit">Upload</button><button id="au_close">Close</button></div></div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  $('#au_close').addEventListener('click', ()=>$('#adminModal').remove());
  $('#au_submit').addEventListener('click', async ()=>{
    const fd = new FormData();
    fd.append('title',$('#au_title').value); fd.append('year',$('#au_year').value);
    fd.append('genres',$('#au_genres').value); fd.append('overview',$('#au_overview').value);
    if ($('#au_poster').files[0]) fd.append('poster',$('#au_poster').files[0]);
    const r = await fetch(API_BASE + '/api/admin/upload',{method:'POST', body: fd, headers: { 'Authorization': 'Bearer ' + state.token }});
    const j = await r.json();
    if (j.ok){ alert('uploaded'); $('#adminModal').remove(); loadCombined(); } else alert(j.error||'upload failed');
  });
});

// INIT
document.addEventListener('DOMContentLoaded', async ()=>{
  renderAuthUI();
  await loadCombined();
  setInterval(()=> {
    const btn = $('#adminBtn');
    if (!btn) return;
    btn.style.display = (state.user && state.user.role === 'admin') ? 'block' : 'none';
  }, 600);
});
// server/server.js
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // npm i node-fetch@2
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const TMDB_KEY = process.env.TMDB_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'defaultsecret';
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MOVIES_FILE = path.join(DATA_DIR, 'movies.json');
const WATCH_FILE  = path.join(DATA_DIR, 'watchlists.json');

function readJSON(file){ try { return JSON.parse(fs.readFileSync(file,'utf8') || '[]'); } catch(e) { return []; } }
function writeJSON(file,data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }

if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, []);
if (!fs.existsSync(MOVIES_FILE)) writeJSON(MOVIES_FILE, []);
if (!fs.existsSync(WATCH_FILE)) writeJSON(WATCH_FILE, []);

// create default admin if no users
(function ensureAdmin(){
  const users = readJSON(USERS_FILE);
  if (users.length === 0){
    (async ()=>{
      const hash = await bcrypt.hash('admin123',10);
      const admin = { id: 'admin-1', email:'admin@kaf33f3.local', name:'Admin', password: hash, role:'admin' };
      users.push(admin);
      writeJSON(USERS_FILE, users);
      console.log('Created default admin -> admin@kaf33f3.local / admin123');
    })();
  }
})();

const TMDB_BASE = 'https://api.themoviedb.org/3';

// TMDb proxy endpoints
app.get('/api/movies/popular', async (req,res) => {
  const page = req.query.page || 1;
  const r = await fetch(`${TMDB_BASE}/movie/popular?api_key=${TMDB_KEY}&language=en-US&page=${page}`);
  const j = await r.json();
  res.json(j);
});

app.get('/api/movie/:id', async (req,res) => {
  const id = req.params.id;
  const r = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${TMDB_KEY}&language=en-US`);
  const j = await r.json();
  res.json(j);
});

app.get('/api/search', async (req,res) => {
  const q = req.query.q || '';
  const r = await fetch(`${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&language=en-US&query=${encodeURIComponent(q)}`);
  const j = await r.json();
  res.json(j);
});

// combined endpoint: local + tmdb popular
app.get('/api/movies/combined', async (req,res) => {
  const page = req.query.page || 1;
  const r = await fetch(`${TMDB_BASE}/movie/popular?api_key=${TMDB_KEY}&language=en-US&page=${page}`);
  const j = await r.json();
  const local = readJSON(MOVIES_FILE);
  const tmdbMapped = (j.results || []).map(m => ({ provider:'tmdb', id: m.id, title: m.title, poster_path: m.poster_path, overview: m.overview, raw: m }));
  const localMapped = local.map(m => ({ provider:'local', id: m.id, title: m.title, poster: (m.poster ? (`/uploads/${m.poster}`) : null), overview: m.overview, raw: m }));
  res.json({ tmdb: tmdbMapped, local: localMapped });
});

// auth routes
app.post('/api/auth/register', async (req,res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email+password required' });
  const users = readJSON(USERS_FILE);
  if (users.find(u=>u.email === email)) return res.status(400).json({ error: 'email exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: Date.now().toString(), email, name: name||'', password: hash, role: 'user' };
  users.push(user); writeJSON(USERS_FILE, users);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role }});
});

app.post('/api/auth/login', async (req,res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u=>u.email === email);
  if (!user) return res.status(400).json({ error: 'invalid' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: 'invalid' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role }});
});

// watchlist (simple JSON store)
function authMiddleware(req,res,next){
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'no token' });
  const token = h.split(' ')[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data; next();
  } catch(e){ return res.status(401).json({ error: 'invalid token' }); }
}

app.get('/api/watchlist', authMiddleware, (req,res) => {
  const all = readJSON(WATCH_FILE);
  const entry = all.find(x => x.userId === req.user.id);
  res.json(entry ? entry.items : []);
});
app.post('/api/watchlist', authMiddleware, (req,res) => {
  const { item } = req.body;
  if (!item) return res.status(400).json({ error: 'item required' });
  const all = readJSON(WATCH_FILE);
  let entry = all.find(x => x.userId === req.user.id);
  if (!entry){ entry = { userId: req.user.id, items: [] }; all.push(entry); }
  if (!entry.items.find(i => i.provider===item.provider && String(i.id) === String(item.id))) entry.items.push(item);
  writeJSON(WATCH_FILE, all);
  res.json(entry.items);
});
app.delete('/api/watchlist/:provider/:id', authMiddleware, (req,res) => {
  const provider = req.params.provider, id = req.params.id;
  const all = readJSON(WATCH_FILE);
  let entry = all.find(x => x.userId === req.user.id);
  if (!entry) return res.json([]);
  entry.items = entry.items.filter(i => !(i.provider===provider && String(i.id) === String(id)));
  writeJSON(WATCH_FILE, all);
  res.json(entry.items);
});

// admin upload
const upload = multer({ dest: UPLOADS });
function adminOnly(req,res,next){
  if (!req.user) return res.status(401).json({ error: 'no user' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  next();
}
app.post('/api/admin/upload', authMiddleware, adminOnly, upload.single('poster'), (req,res) => {
  const { title, year, genres, overview } = req.body;
  const file = req.file;
  const movies = readJSON(MOVIES_FILE);
  const id = 'local_' + Date.now();
  const posterFilename = file ? file.filename : null;
  const movie = { id, title, year: Number(year||0), genres: (genres||'').split(',').map(s=>s.trim()).filter(Boolean), overview, poster: posterFilename };
  movies.push(movie); writeJSON(MOVIES_FILE, movies);
  res.json({ ok:true, movie });
});

app.use('/uploads', express.static(UPLOADS));

app.listen(PORT, () => console.log(`Server started http://localhost:${PORT}`));
