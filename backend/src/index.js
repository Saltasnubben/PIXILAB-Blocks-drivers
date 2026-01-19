import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { crewRouter } from './routes/crew.js';
import { projectsRouter } from './routes/projects.js';
import { bookingsRouter } from './routes/bookings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasApiToken: !!process.env.RENTMAN_API_TOKEN
  });
});

// Routes
app.use('/api/crew', crewRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/bookings', bookingsRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Rentman Booking Visualizer API running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  if (!process.env.RENTMAN_API_TOKEN) {
    console.warn('⚠️  Warning: RENTMAN_API_TOKEN not set in environment');
  }
});
