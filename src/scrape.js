import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as nodemailer from 'nodemailer';
import * as cheerio from 'cheerio';

dotenv.config();

const {
  KATTIS_USER_COOKIE: cookieString,
  GMAIL_AUTH_USERNAME: gmailUsername,
  GMAIL_AUTH_PASSWORD: gmailPassword,
  GMAIL_OUT_ADDRESS: gmailAddress,
} = process.env;

if (!cookieString || !gmailUsername || !gmailPassword || !gmailAddress) {
  console.error('Missing environment variables necessary for scraper.');
  process.exit(1);
}

const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUsername,
    pass: gmailPassword,
  }
});

export async function fetchAndScrape() {
  const headers = { 'cookie': cookieString };
  const response = await fetch(
    'https://open.kattis.com/problems?show_solved=on&show_tried=off&show_untried=off',
    { headers: headers }
  );
  if (!response.ok) return new Promise.reject(`response not ok, status ${response.status}`);
  if (response.headers.has('set-cookie')) {
    // get new cookie information
    const cookieInfo = response.headers.get('set-cookie');
    const begin = cookieInfo.indexOf('EduSiteCookie');
    const end = cookieInfo.indexOf(';', begin);
    cookieString = cookieInfo.slice(begin, end);
    // send email to developer about cookie change
    emailTransporter.sendMail({
      from: gmailUsername,
      to: gmailAddress,
      subject: 'Message from your Kattis fetch and scrape program',
      text: `Hi there developer. Your little program here. The Kattis user cookie in the environment variables needs to be changed to: ${cookieString}`
    }, (err, info) => {
      if (err) console.error('Error sending email about cookie change:\n', err);
    });
  }
  
  // prepare scraping
  const data = await response.text();
  const array = [];
  let $ = cheerio.load(data);
  // scrape solved problems and add to array
  $('td.name_column > a').each((_idx, el) => array.push({ name: $(el).text(), href: `https://open.kattis.com${$(el).attr('href')}` }));
  // check if there is a next page of solved problems
  if($('#problem_list_next').length > 0) {
    let res, resData;
    do {
      res = await fetch(
        $('#problem_list_next').attr('href'),
        { headers: headers }
      );
      if (!res.ok) return new Promise.reject(`response not ok, status ${res.status}`);
      resData = await res.text();
      $ = cheerio.load(resData);
      // scrape solved problems and add to array
      $('td.name_column > a').each((_idx, el) => array.push({ name: $(el).text(), href: `https://open.kattis.com${$(el).attr('href')}` }));
    } while ($('#problem_list_next').length > 0);
  }
  
  return array;
}
