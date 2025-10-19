// Load environment variables
import 'dotenv/config';

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

import authMiddleware from './authMiddleware.js';
import visitorRoutes from './routes/visitors.js';
import chatRoutes from './routes/chat.js';
import eventsRoutes from './routes/events.js';
import tokensRoutes from './routes/tokens.js';
import broadcastRoutes from './routes/broadcasts.js';
import usersRoutes from './routes/users.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Health check route
app.get('/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Protected routes
app.use('/api', authMiddleware); // all /api/* require a supabase access token
app.use('/api/visitors', visitorRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/tokens', tokensRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/users', usersRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
console.log('[backend] API server started');
