<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CineVibe | Catálogo de Filmes</title>
   
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,600;14..32,700&display=swap%22 rel="stylesheet">
    <link rel="stylesheet" href="index.css">
 
</head>
<body>
    <header>
        <div class="container header-content">
            <div class="logo">
                <i class="fas fa-film"></i> Cinema
            </div>
            <div class="search-bar">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="Buscar filmes, séries, gêneros...">
                <button>Buscar</button>
            </div>
            <div class="nav-icons">
                <i class="far fa-heart"></i>
                <i class="far fa-user-circle"></i>
                <i class="fas fa-bars"></i>
            </div>
        </div>
    </header>
 
    <main class="container">
 
        <section class="hero">
            <div>
                <h1>Catálogo de Filmes</h1>
                <p>Descubra, assista e colecione seus favoritos.</p>
            </div>
            <div class="filter-chips">
                <span class="chip active">Todos</span>
                <span class="chip">Ação</span>
                <span class="chip">Comédia</span>
                <span class="chip">Drama</span>
                <span class="chip">Ficção</span>
                <span class="chip">Terror</span>
            </div>
        </section>
 
        <section class="catalog">
            <div class="section-title">
                <h2><i class="fas fa-fire" style="color: #f5b042; margin-right: 10px;"></i>Em destaque</h2>
                <a href="#">Ver todos <i class="fas fa-arrow-right"></i></a>
            </div>
 
            <div class="movie-grid" id="movieGrid">
 
            </div>
        </section>
    </main>
 
    <footer>
        <div class="container">
            <p><i class="fas fa-film"></i> CineVibe — Seu catálogo de filmes completo. Dados fictícios para demonstração.</p>
            <p style="margin-top: 8px; font-size: 12px;">&copy; 2025 CineVibe. Todos os direitos reservados.</p>
        </div>
    </footer>
 
    <script>
 
        const movies = [
            {
                title: "Oppenheimer",
                year: 2023,
                rating: 8.9,
                genre: "Drama",
                poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg"
            },
            {
                title: "Duna: Parte 2",
                year: 2024,
                rating: 8.7,
                genre: "Ficção",
                poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg"
            },
            {
                title: "Godzilla: Minus One",
                year: 2023,
                rating: 8.3,
                genre: "Ação",
                poster: "https://image.tmdb.org/t/p/w500/hkxxMIGaiCTmrEArK7J56JTKUlB.jpg"
            },
            {
                title: "Barbie",
                year: 2023,
                rating: 7.2,
                genre: "Comédia",
                poster: "https://image.tmdb.org/t/p/w500/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg"
            },
            {
                title: "Deadpool & Wolverine",
                year: 2024,
                rating: 8.0,
                genre: "Ação",
                poster: "https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg"
            }
        ];
 
        function renderMovies() {
            const grid = document.getElementById('movieGrid');
            if (!grid) return;
 
            let html = '';
            movies.forEach(movie => {
 
                const safePoster = movie.poster && movie.poster.startsWith('http')
                    ? movie.poster
                    : 'https://via.placeholder.com/500x750/1e2638/ffffff?text=🎬+Sem+Capa';
 
                html += `
                    <div class="movie-card">
                        <div class="poster-wrapper">
                            <img
                                src="${safePoster}"
                                alt="Pôster de ${movie.title}"
                                loading="lazy"
                                onerror="this.onerror=null; this.src='https://via.placeholder.com/500x750/1e2638/a0aec0?text=🎬+${encodeURIComponent(movie.title.substring(0, 12))}';"
                            >
                            <div class="rating-badge">
                                <i class="fas fa-star"></i> ${movie.rating.toFixed(1)}
                            </div>
                            <div class="genre-tag">${movie.genre}</div>
                        </div>
                        <div class="movie-info">
                            <h3 title="${movie.title}">${movie.title}</h3>
                            <div class="movie-meta">
                                <span><i class="far fa-calendar-alt"></i> ${movie.year}</span>
                                <span><i class="fas fa-clock"></i> 2h</span>
                            </div>
                        </div>
                    </div>
                `;
            });
 
            grid.innerHTML = html;
        }
 
        document.addEventListener('DOMContentLoaded', () => {
            renderMovies();
 
            const chips = document.querySelectorAll('.chip');
            chips.forEach(chip => {
                chip.addEventListener('click', () => {
                    chips.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
 
                });
            });
 
            const searchBtn = document.querySelector('.search-bar button');
            const searchInput = document.querySelector('.search-bar input');
            if (searchBtn) {
                searchBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (searchInput.value.trim()) {
                        alert(`Busca demonstrativa por: "${searchInput.value.trim()}"`);
                    } else {
                        alert('Digite algo para buscar.');
                    }
                });
            }
        });
    </script>
</body>
</html>