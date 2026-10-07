const express = require("express");

const app = express();

app.use(express.json());

const filmesRoutes = require("./routes/filmesRoutes");

app.use("/filmes", filmesRoutes);

app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000");
});