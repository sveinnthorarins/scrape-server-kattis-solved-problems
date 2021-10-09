import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// configure environment variables

dotenv.config();

const {
  KATTIS_USERNAME: kattisUsername,
  KATTIS_PASSWORD: kattisPassword,
  KATTIS_FULL_NAME: kattisFullName,
} = process.env;

if (!kattisUsername || !kattisPassword || !kattisFullName) {
  console.error('Environment variables necessary for scraper are missing.');
  process.exit(1);
}

// variables

const headers = {
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36',
  'Accept-Language': 'en-US, en',
  Cookie: '', // empty at first..
};

let justSignedIn = false;

// delay utility function
// used to wait before sending requests since we want to scrape politely :)
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function helperFetch(url, errorMessage = 'response not ok', options = {}) {
  options.headers = headers;
  const response = await fetch(url, options);
  if (!response.ok && !options.redirect) return Promise.reject(`${errorMessage}, status ${response.status}`);
  if (response.headers.has('Set-Cookie')) {
    const cookieInfo = response.headers.get('Set-Cookie');
    const begin = cookieInfo.indexOf('EduSiteCookie');
    const end = cookieInfo.indexOf(';', begin);
    headers.Cookie = cookieInfo.slice(begin, end);
  }
  const data = await response.text();
  // simple way to add delay in between requests
  // by adding it to our helper fetch function
  await delay(5000);
  return data;
}

async function signIn() {
  try {
    // Perform GET to scrape csrf token and set initial cookie
    const data = await helperFetch('https://open.kattis.com/login/email?', 'sign-in GET response not ok');
    const $ = cheerio.load(data);
    const csrf = $('input[name=csrf_token]').attr('value');
    // Perform POST to sign in user
    const params = new URLSearchParams();
    params.append('csrf_token', csrf);
    params.append('user', kattisUsername);
    params.append('password', kattisPassword);
    params.append('submit', 'Submit');
    await helperFetch('https://open.kattis.com/login/email?', 'sign-in POST response not ok', {
      method: 'POST',
      body: params,
      redirect: 'manual',
    });
  } catch (e) {
    return Promise.reject(e);
  }
  console.info('Successfully signed in kattis user');
  justSignedIn = true;
  setTimeout(() => {
    justSignedIn = false;
  }, 600000);
}

// the main fetch and scrape function, exported for use by other files.
export async function fetchAndScrape() {
  console.info('Starting fetch and scrape program');
  if (!headers.Cookie) {
    try {
      await signIn();
    } catch (e) {
      return Promise.reject('Error signing in kattis user:\n' + e);
    }
  }

  // fetch problems page
  let data;
  try {
    data = await helperFetch('https://open.kattis.com/problems?show_solved=on&show_tried=off&show_untried=off');
  } catch (e) {
    return Promise.reject('Error fetching problems:\n' + e);
  }

  // prepare scraping
  const array = [];
  let $ = cheerio.load(data);

  // if cookie somehow didn't work and we need to log in again.
  if ($('nav.user-nav li.user').length === 0) {
    if (!justSignedIn) {
      headers.Cookie = '';
      return fetchAndScrape();
    } else return Promise.reject('several unsuccessful sign-in attempts, stopping scraping program...');
  }

  // scrape solved problems and add to array
  $('td.name_column > a').each((_idx, el) =>
    array.push({ name: $(el).text(), href: `https://open.kattis.com${$(el).attr('href')}` }),
  );

  // check if there is a next page of solved problems,
  // if so, go through all pages, scrape and add problems to array
  if ($('#problem_list_next').length > 0) {
    let resData;
    do {
      // fetch next page
      try {
        resData = await helperFetch(`https://open.kattis.com${$('#problem_list_next').attr('href')}`);
      } catch (e) {
        return Promise.reject('Error fetching problems:\n' + e);
      }
      // load page with cheerio
      $ = cheerio.load(resData);
      // scrape solved problems and add to array
      $('td.name_column > a').each((_idx, el) =>
        array.push({ name: $(el).text(), href: `https://open.kattis.com${$(el).attr('href')}` }),
      );
    } while ($('#problem_list_next').length > 0 && $('#problem_list_next').attr('href') !== undefined);
  }

  try {
    // need to scrape additional information about each and every problem
    for (const obj of array) {
      await getAdditionalInformation(obj);
    }
  } catch (e) {
    return Promise.reject('Error scraping additional information:\n' + e);
  }

  console.info('Successfully finished fetch and scrape program');

  return array;
}

// function for getting additional information about each problem
async function getAdditionalInformation(obj) {
  try {
    // fetch statistics page
    let statsHref = `${obj.href}/statistics`;
    let resData = await helperFetch(
      statsHref,
      `response not ok when fetching additional information about problem ${obj.name}`,
    );

    // scrape for fastest solution
    let $ = cheerio.load(resData);
    let tablebody = $('#toplist0 tbody');
    if (tablebody.length > 1) tablebody = tablebody.first();
    obj.fastest = tablebody.find('tr').first().find('td.runtime').text();

    // check if user is in that top 10 list
    let me = tablebody.find('tr').filter((_idx, el) => {
      return $(el).find('td').first().next().text() === kattisFullName;
    });
    // if so, use that to add necessary properties
    if (me.length > 0) {
      obj.topplace = me.find('td').first().text();
      obj.tophref = statsHref;
      obj.mine = me.find('td.runtime').text();
    } else {
      // else we need to perform a separate fetch for user's solution time

      // fetch user's submission page
      const url = obj.href.replace('problems', `users/${kattisUsername}/submissions`);
      resData = await helperFetch(
        url,
        `response not ok when fetching submission information about problem ${obj.name}`,
      );

      // scrape user's accepted submissions
      $ = cheerio.load(resData);
      let tablerows = $('table > tbody > tr').filter((_idx, el) => {
        return $(el).find('td[data-type=status] > span').hasClass('accepted');
      });

      let min = {
        text: '',
        speed: 10000.0,
      };

      // go through all accepted submission and find the one with lowest cpu time
      tablerows.each((_idx, el) => {
        const speedText = $(el).find('td[data-type=cpu]').text();
        const speed = Number.parseFloat(speedText.replace('&nbsp;s', ''));
        if (speed < min.speed) {
          min.speed = speed;
          min.text = speedText;
        }
      });

      obj.mine = min.text;
    }
  } catch (e) {
    return Promise.reject(e);
  }
  return Promise.resolve();
}
