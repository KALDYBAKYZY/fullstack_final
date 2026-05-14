require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');

const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const roomRoutes = require('./routes/roomRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const { setupWebSocket } = require('./websocket/webSocket');

const app = express();

/*
========================
MIDDLEWARES
========================
*/

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/*
========================
API ROUTES
========================
*/

app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/uploads', uploadRoutes);

/*
========================
HEALTH CHECK
========================
*/

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'StudyHub API is running',
  });
});

/*
========================
ERROR HANDLER
========================
*/

app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error',
  });
});

/*
========================
CONNECT DATABASE
========================
*/

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');

    /*
    ========================
    CREATE HTTP SERVER
    ========================
    */

    const server = http.createServer(app);

    /*
    ========================
    WEBSOCKET
    ========================
    */

    setupWebSocket(server);

    /*
    ========================
    START SERVER
    ========================
    */

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

