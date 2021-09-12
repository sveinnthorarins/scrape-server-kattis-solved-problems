# Scraping server for a Kattis user's solved problems

This project is a NodeJS server that scrapes information daily about a pre-defined user's solved problems on Kattis and stores it in a database.

The server then responds with the scraped data to GET requests to its root address. The response is a JSON object of the following type:

```typescript
type Response = {
  // whether the list in the response is old or not
  old: boolean;
  // list (array) of all of user's solved problems
  solvedProblems: SolvedProblem[];
}
```

Each solved problem is then a JSON object of the following type:

```typescript
type SolvedProblem = {
  // id of problem in database
  id: number;
  // name of problem
  name: string;
  // url to problem description page on Kattis
  href: string;
  // cpu time of fastest solution (in the form '#.## s')
  fastest: string;
  // cpu time of user's solution (in the form '#.## s')
  mine: string;
  // if user's solution is in top 10 fastest, the exact place (e.g. if 5th fastest this would be '5')
  topplace: string | null;
  // if user's solution is in top 10 fastest, url to problem statistics page on Kattis
  tophref: string | null;
};
```

If the list of problems on the server is old the server will respond with that old list and with the `old` property set to `true`. The server will then update the list (in the background) and the client should query again in a few minutes (scraping takes about 12 secs per solved problem).

The scraping is performed by making a request to Kattis's solved problems page with a user cookie set (like the user is logged in) and then scraping the response for all the solved problems entries.

Additional information about each problem is then fetched and scraped. The fetching is performed very politely, waiting 4-12 seconds between requests.

If the response from Kattis includes a set-cookie header indicating the cookie should be renewed the server will log into a Gmail account and send an email to the developer from that Gmail account indicating this. However, I'm not entirely sure this is what Kattis does. As a precaution the scraping script also makes sure the user is logged in (by scraping for the user menu and making sure it is present 😛).

## Using and applying this project

I used [Heroku](https://heroku.com) to host my server and I recommend using a similar service.

1. Start by uploading this repo to the host. If you are using a service like Heroku you can connect it to this GitHub repository or your own fork of this repo and have it automatically deploy.

2. The host will need to have a PostgreSQL server set up. If you are using Heroku you can add a Heroku Postgres instance to your app.

3. Several environment variables need to be set for this project to work. Take a look at the [`.env.example`](https://github.com/sveinnthorarins/scrape-server-kattis-solved-problems/blob/main/.env.example) for an example.<br><br>If you are using a service like Heroku the last three variables will be set automatically (`DATABASE_URL`, `NODE_ENV`, `PORT`).<br><br>The first six need to be set manually (`KATTIS_USER_COOKIE`, `GMAIL_AUTH_USERNAME`, `GMAIL_AUTH_PASSWORD`, `GMAIL_OUT_ADDRESS`, `MY_KATTIS_FULL_NAME`, `MY_KATTIS_USERNAME`).<br><br>The `GMAIL_AUTH_` variables are used for logging into a Gmail account and the `GMAIL_OUT_ADDRESS` is the email address (doesn't have to be Gmail) that the email notification will be sent to.

4. The setup/build script (in `package.json`) needs to be run for initial setup of the PostgreSQL database. If you are using a service like Heroku they will likely run the build script automatically.

5. Then to start the server the start script (in `package.json`) must be run. Services like Heroku will do this automatically.
