require("dotenv").config();
const express = require("express");
const app=express();

app.use(express.json());

const PORT=Number(process.env.PORT) || 3000;

app.get("/", (req, res) => {

});