import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

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

let cookieString = null;

const headers = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36',
  'accept-language': 'en-US, en',
  referer: 'https://open.kattis.com',
  //cookie: cookieString, // cookieString is null at first..
};

// delay utility function
// used to wait before sending requests since we want to scrape politely :)
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function signIn() {
  const params = new URLSearchParams();
  params.append('user', kattisUsername);
  params.append('password', kattisPassword);
  params.append('submit', 'Submit');
  const response = await fetch('https://open.kattis.com/login/email?', { method: 'POST', body: params });
  if (!response.ok) return Promise.reject(`sign-in response not ok, status ${response.status}`);
  const cookieInfo = response.headers.get('set-cookie');
  const begin = cookieInfo.indexOf('EduSiteCookie');
  const end = cookieInfo.indexOf(';', begin);
  cookieString = cookieInfo.slice(begin, end);
  if (!cookieString) return Promise.reject('unsuccessful sign-in attempt');
  headers.cookie = cookieString;
  console.info('Successfully signed in kattis user');
}

// the main fetch and scrape function, exported for use by other files.
// no try-catch blocks inside this function, must catch errors when calling this function.
export async function fetchAndScrape() {
  console.info('Starting fetch and scrape program');
  if (!cookieString) {
    await signIn();
  }

  // fetch problems page
  const response = await fetch('https://open.kattis.com/problems?show_solved=on&show_tried=off&show_untried=off', {
    headers: headers,
  });
  if (!response.ok) return Promise.reject(`response not ok, status ${response.status}`);

  // prepare scraping
  const data = await response.text();
  const array = [];
  let $ = cheerio.load(data);

  // if cookie somehow didn't work and we need to log in again.
  if ($('nav.user-nav li.user').length === 0) {
    signIn();
    return fetchAndScrape();
  }

  // scrape solved problems and add to array
  $('td.name_column > a').each((_idx, el) =>
    array.push({ name: $(el).text(), href: `https://open.kattis.com${$(el).attr('href')}` }),
  );

  // check if there is a next page of solved problems,
  // if so, go through all pages, scrape and add problems to array
  if ($('#problem_list_next').length > 0) {
    let res, resData;
    do {
      await delay(5000); // wait 5 secs before next request
      // fetch next page
      res = await fetch(`https://open.kattis.com${$('#problem_list_next').attr('href')}`, { headers: headers });
      if (!res.ok) return Promise.reject(`response not ok, status ${res.status}`);
      resData = await res.text();
      // load page with cheerio
      $ = cheerio.load(resData);
      // scrape solved problems and add to array
      $('td.name_column > a').each((_idx, el) =>
        array.push({ name: $(el).text(), href: `https://open.kattis.com${$(el).attr('href')}` }),
      );
    } while ($('#problem_list_next').length > 0 && $('#problem_list_next').attr('href') !== undefined);
  }

  // need to scrape additional information about each and every problem
  let promisesArray = [];
  for (const obj of array) {
    // wait around 8-15 secs before fetching info about next problem
    await delay(Math.floor((Math.random() * 7 + 8) * 1000));
    // fetch and scrape additional info about problem
    promisesArray.push(getAdditionalInformation(obj));
  }
  // wait for the scraping of all problems to finish
  await Promise.all(promisesArray);
  console.info('Successfully finished fetch and scrape program');

  return array;
}

// function for getting additional information about each problem
async function getAdditionalInformation(obj) {
  // fetch statistics page
  let statsHref = `${obj.href}/statistics`;
  let res = await fetch(statsHref, { headers: headers });
  if (!res.ok)
    return Promise.reject(
      `response not ok when fetching additional information, status ${res.status}, problem ${obj.name}`,
    );
  let resData = await res.text();

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
    // wait 4 secs
    delay(4000);

    // fetch user's submission page
    res = await fetch(obj.href.replace('problems', `users/${kattisUsername}/submissions`), { headers: headers });
    if (!res.ok)
      return Promise.reject(
        `response not ok when fetching submission information, status ${res.status}, problem ${obj.name}`,
      );
    resData = await res.text();

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

  return Promise.resolve();
}
