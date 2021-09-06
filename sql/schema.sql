
CREATE TABLE IF NOT EXISTS solvedproblems (
  id serial primary key,
  name varchar(128) not null unique,
  href varchar(256) not null,
  fastest varchar(32) not null,
  mine varchar(32) not null,
  topplace varchar(32),
  tophref varchar(256)
);

CREATE TABLE IF NOT EXISTS lastfetchdate (
  id serial primary key,
  fetchdate date not null
);
