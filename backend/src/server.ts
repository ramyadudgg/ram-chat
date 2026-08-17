import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const port = Number(process.env.PORT || 10000);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ram-chat-api' });
});

app.get('/', (_req, res) => {
  res.json({ name: 'Ram Chat API', status: 'running' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Ram Chat API listening on ${port}`);
});
