class Filme {
    constructor({ id, titulo, genero, duracao, classificacao }) {
      this.id = id;
      this.titulo = titulo;
      this.genero = genero;
      this.duracao = duracao;
      this.classificacao = classificacao;
    }
  }
  
  module.exports = Filme;