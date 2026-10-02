const {pool} = require("../config/db");

class FilmeInfrastructure {
    async cadastrarFilmes(filme) {
        const [resposta] = await pool.query('INSERT INTO filmes (titulo, genero, duracao, classificacao) VALUES (?, ?, ?, ?)', [filme.titulo, filme.genero, filme.duracao, filme.classificacao]);

        return resposta.affectedRows > 0;
    }

    async listarCatalagoFilmes() {
        const [resposta] = await pool.query('SELECT * FROM filmes');
        
        return resposta;
    }
}

async function main() {
    const filme = new FilmeInfrastructure();
    console.log(await filme.listarCatalagoFilmes());
}

main()