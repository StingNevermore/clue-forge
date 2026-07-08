CREATE TABLE IF NOT EXISTS novels (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	current_version TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS versions (
	id TEXT PRIMARY KEY,
	novel_id TEXT NOT NULL,
	kind TEXT NOT NULL,
	r2_key TEXT NOT NULL,
	created_at TEXT NOT NULL,
	FOREIGN KEY (novel_id) REFERENCES novels(id)
);

CREATE TABLE IF NOT EXISTS chapters (
	id TEXT PRIMARY KEY,
	novel_id TEXT NOT NULL,
	chapter_no INTEGER NOT NULL,
	title TEXT NOT NULL,
	status TEXT NOT NULL,
	r2_key TEXT,
	updated_at TEXT NOT NULL,
	UNIQUE (novel_id, chapter_no),
	FOREIGN KEY (novel_id) REFERENCES novels(id)
);
