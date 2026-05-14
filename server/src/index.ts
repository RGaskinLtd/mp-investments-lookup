import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { partiesRouter } from './routes/parties';
import { mpsRouter } from './routes/mps';
import { dashboardRouter } from './routes/dashboard';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/parties', partiesRouter);
app.use('/api/mps', mpsRouter);
app.use('/api/dashboard', dashboardRouter);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
