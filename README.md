# Scraping server for a Kattis user's solved problems

This project is a NodeJS server that scrapes a user's solved problems on Kattis and stores them in a database.
The server then responds to GET requests to its root address with the scraped data (JSON object holding an array of the user's solved problems).
