import { readFile } from 'fs/promises';
import { query, upsertSolvedProblems, end } from './db.js';

const schemaFile = './sql/schema.sql';

async function setupDb() {
  const data = await readFile(schemaFile);
  await query(data.toString('utf-8'));
  console.info('Database schema created');
  await end();
}

setupDb().catch((err) => {
  console.error('Error setting up database:\n', err);
});
