const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 5000;

//middlewares
app.use(cors());
app.use(express.json());


app.get("/", (req, res) => {
    res.send("Server status: Up");
})

app.listen(port, () => {
    console.log(`Server is running at port: ${port}`);
})