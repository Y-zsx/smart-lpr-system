import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req: Request, res: Response) => {
  res.send('Smart LPR System Backend is running');
});

// API Routes
app.use('/api', apiRoutes);

// Mock user info endpoint for frontend compatibility
app.get('/__user_info__', (req: Request, res: Response) => {
  res.json({
    id: 'mock-user-id',
    name: 'Admin User',
    role: 'admin'
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
