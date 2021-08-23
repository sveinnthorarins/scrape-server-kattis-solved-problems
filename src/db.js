import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const {
  DATABASE_URL: connectionString,
  NODE_ENV: nodeEnv = 'development',
} = process.env;

if (!connectionString) {
  console.error('Missing DATABASE_URL in environment variables.');
  process.exit(1);
}

const ssl = nodeEnv !== 'development' ? { rejectUnauthorized: false } : false;

const pool = new pg.Pool({ connectionString, ssl });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function query(queryString, values = []) {
  const client = await pool.connect();

  try {
    const result = await client.query(queryString, values);
    return result;
  } finally {
    client.release();
  }
}

export async function end() {
  await pool.end();
}

export async function upsertSolvedProblems(problemsArray) {
  const promisesArray = [];
  problemsArray.forEach((obj) => {
    promisesArray.push(
      query('INSERT INTO solvedproblems (name, href) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET href = $2;', [obj.name, obj.href])
    );
  });
  
  try {
    await Promise.all(promisesArray);
  } catch(err) {
    console.error('Error inserting scraped data into database:\n', err);
    return null;
  }
  
  let dateNow = new Date();
  dateNow = new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate());
  
  try {
    await query('INSERT INTO lastfetchdata (id, fetchDate) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET fetchDate = $2;', [1, dateNow.toISOString().slice(0,10)]);
  } catch(err) {
    console.error('Error inserting lastFetchDate into database:\n', err);
    return null;
  }
  
  return [problemsArray, dateNow];
}
