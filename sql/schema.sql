
CREATE TABLE IF NOT EXISTS solvedproblems (
  id serial primary key,
  name varchar(128) not null unique,
  href varchar(256) not null
);

CREATE TABLE IF NOT EXISTS lastfetchdate (
  id serial primary key,
  fetchDate date not null
);
