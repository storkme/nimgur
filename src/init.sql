CREATE DATABASE "nimgur";

CONNECT "nimgur";

CREATE TABLE "nimgur_images" (
    id VARCHAR(6) NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event JSONB NOT NULL,
    ext TEXT NOT NULL,
    hash TEXT NOT NULL CONSTRAINT unique_hashes UNIQUE
);
