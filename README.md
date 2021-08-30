# Scraping server for a Kattis user's solved problems

This project is a NodeJS server that scrapes daily a pre-defined user's solved problems on Kattis and stores them in a database.

The server then responds with the scraped data to GET requests to its root address (the response is a JSON object holding an array of the user's solved problems).

The scraping is performed by making a request to Kattis's solved problems page with a user cookie set (like the user is logged in) and then scraping the response for all the solved problems entries.

If the response from Kattis includes a set-cookie header indicating the cookie should be renewed the server will log into a Gmail account and send an email to the developer from that Gmail account indicating this.

## Using and applying this project

I used [Heroku](https://heroku.com) to host my server and I recommend using a similar service.

Start by uploading this repo to the host. If you are using a service like Heroku you can connect it to this GitHub repository or your own fork of this repo and have it automatically deploy.

The host will need to have a PostgreSQL server set up. If you are using Heroku you can add a Heroku Postgres instace to your app.

Several environment variables need to be set for this project to work. Take a look at the `.env.example` for an example. If you are using a service like Heroku the last three variables will be set automatically (DATABASE_URL, NODE_ENV, PORT). The first four need to be set manually (KATTIS_USER_COOKIE, GMAIL_AUTH_USERNAME, GMAIL_AUTH_PASSWORD, GMAIL_OUT_ADDRESS). The GMAIL_AUTH_ variables are used for logging into a Gmail account and the GMAIL_OUT_ADDRESS is the email address (doesn't have to be Gmail) that the email notification will be sent to.

The setup/build script (in `package.json`) needs to be run for initial setup of the PostgreSQL database. If you are using a service like Heroku they will likely run the build script automatically.

Then to start the server the start script (in `package.json`) must be run. Services like Heroku will do this automatically.
