# Scraping server for a Kattis user's solved problems

This project is a NodeJS server that scrapes daily a pre-defined user's solved problems on Kattis and stores them in a database.

The server then responds with the scraped data to GET requests to its root address (the response is a JSON object holding an array of the user's solved problems).
