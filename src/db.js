import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { DATABASE_URL: connectionString, NODE_ENV: nodeEnv = 'development' } = process.env;

if (!connectionString) {
  console.error('Missing DATABASE_URL in environment variables.');
  process.exit(1);
}

const ssl = nodeEnv !== 'development' ? { rejectUnauthorized: false } : false;

const pool = new pg.Pool({ connectionString: connectionString, ssl: ssl });

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
    if (!obj.topplace) {
      promisesArray.push(
        query(
          'INSERT INTO solvedproblems (name, href, fastest, mine) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO UPDATE SET href = $2, fastest = $3, mine = $4;',
          [obj.name, obj.href, obj.fastest, obj.mine],
        ),
      );
    } else {
      promisesArray.push(
        query(
          'INSERT INTO solvedproblems (name, href, fastest, mine, topplace, tophref) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (name) DO UPDATE SET href = $2, fastest = $3, mine = $4, topplace = $5, tophref = $6;',
          [obj.name, obj.href, obj.fastest, obj.mine, obj.topplace, obj.tophref],
        ),
      );
    }
  });

  try {
    await Promise.all(promisesArray);
  } catch (err) {
    console.error('Error inserting scraped data into database:\n', err);
    return null;
  }

  let dateNow = new Date();
  dateNow = new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate());

  try {
    await query(
      'INSERT INTO lastfetchdate (id, fetchdate) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET fetchdate = $2;',
      [1, dateNow.toISOString().slice(0, 10)],
    );
  } catch (err) {
    console.error('Error inserting lastFetchDate into database:\n', err);
    return null;
  }

  let data;
  try {
    data = await query('SELECT * FROM solvedproblems ORDER BY name;');
  } catch (err) {
    console.error('Error selecting solved problems from database after insertion:\n', err);
    return null;
  }

  return [data.rows, dateNow];
}
