import express from 'express';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', async (req, res) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/sidequest',
  });
  try {
    await client.connect();
    const result = await client.query('SELECT NOW()');
    await client.end();
    res.json({ status: 'ok', db_time: result.rows[0].now });
  } catch (error: any) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
