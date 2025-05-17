const express = require('express');
const app = express();

app.get('/', (req, res) => {
  console.log('Test server received / request');
  res.send('Test server is working!');
});

app.listen(4000, () => {
  console.log('Test server running on port 4000');
});

