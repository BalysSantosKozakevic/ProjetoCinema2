const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        mensagem: "Lista de filmes"
    });
});

router.get("/:id", (req, res) => {
    const { id } = req.params;

    res.json({
        mensagem: `Buscando filme ${id}`
    });
});

router.post("/", (req, res) => {
    const filme = req.body;

    res.json({
        mensagem: "Filme cadastrado",
        filme: filme
    });
});

router.put("/:id", (req, res) => {
    const { id } = req.params;

    res.json({
        mensagem: `Filme ${id} atualizado`
    });
});

router.delete("/:id", (req, res) => {
    const { id } = req.params;

    res.json({
        mensagem: `Filme ${id} excluído`
    });
});

module.exports = router;