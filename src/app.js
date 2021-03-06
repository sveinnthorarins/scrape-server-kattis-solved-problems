import express from 'express';
import dotenv from 'dotenv';
import { query, upsertSolvedProblems } from './db.js';
import { fetchAndScrape } from './scrape.js';

dotenv.config();

const { PORT: port = 3000 } = process.env;

const app = express();
let lastFetchDate;
let solvedProblems;
let currentlyScraping = false;

app.use((req, res, next) => {
  res.append('Access-Control-Allow-Origin', ['*']);
  res.append('Access-Control-Allow-Methods', 'GET');
  next();
});

async function updateScrapedInfo() {
  let problemsArray;
  try {
    problemsArray = await fetchAndScrape();
  } catch (err) {
    console.error('Error fetching and scraping:\n' + err);
    return;
  }
  const data = await upsertSolvedProblems(problemsArray);
  if (data !== null) [solvedProblems, lastFetchDate] = data;
  if (currentlyScraping) currentlyScraping = false;
}

app.get('/', async (req, res, next) => {
  try {
    let old = false;
    let dateNow = new Date();
    dateNow = new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate());
    if (lastFetchDate === undefined) {
      let queryResult = await query('SELECT fetchdate FROM lastfetchdate WHERE id = 1;');
      lastFetchDate = new Date(queryResult.rows[0].fetchdate);
    }
    if (solvedProblems === undefined) {
      let data = await query('SELECT * FROM solvedproblems ORDER BY name;');
      solvedProblems = data.rows;
    }
    if (lastFetchDate < dateNow) {
      if (!currentlyScraping) {
        currentlyScraping = true;
        updateScrapedInfo(); // update but do not await return
      }
      // set old to true, this will indicate in our response that the list is old,
      // server is currently refreshing list and client should query again in a bit
      old = true;
    }
    // return whether list is old and the list of problems
    return res.json({ old, solvedProblems });
  } catch (err) {
    console.error("Error in GET '/' function (error selecting from database):\n", err);
    next(err);
  }
});

function notFoundHandler(req, res, next) {
  res.status(404).send('404 Not Found');
}

function errorHandler(err, req, res, next) {
  res.status(500).send('500 Internal Server Error');
}

app.use(notFoundHandler);
app.use(errorHandler);

// Use port variable from .env (for app to work on heroku)
app.listen(port, () => {
  console.info(`Server running at http://localhost:${port}/`);
  currentlyScraping = true;
  updateScrapedInfo();
});
