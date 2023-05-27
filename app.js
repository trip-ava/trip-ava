const express = require('express');
const http = require('http');
// const multer = require('multer');
// const path = require('path');
const app = express();
app.use('/', express.static(__dirname));
const server = http.createServer(app);
server.listen(3000, () => console.log('Server started on port localhost:3000'));
