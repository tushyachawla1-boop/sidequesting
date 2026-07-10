-- Enable PostGIS and pgvector extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create pure PL/pgSQL function to generate UUIDv7
CREATE OR REPLACE FUNCTION uuid_generate_v7() 
RETURNS uuid AS $$ 
BEGIN 
    RETURN encode(
        set_bit(
            set_bit(
                overlay(
                    uuid_send(gen_random_uuid()) 
                    placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3) 
                    from 1 for 6 
                ), 
                52, 1
            ), 
            53, 1
        ), 
        'hex'
    )::uuid; 
END 
$$ LANGUAGE plpgsql VOLATILE;

-- Create side_quests table
CREATE TABLE IF NOT EXISTS side_quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    title VARCHAR(255) NOT NULL,
    organizer VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    lifecycle_type VARCHAR(50) NOT NULL,
    application_deadline TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    formatted_address TEXT NOT NULL,
    coordinates GEOMETRY(Point, 4326) NOT NULL,
    embedding vector(1536) NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    last_crawled TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast spatial queries (radius lookups)
CREATE INDEX IF NOT EXISTS idx_side_quests_coordinates ON side_quests USING GIST (coordinates);

-- Index for fast vector similarity searches (HNSW)
CREATE INDEX IF NOT EXISTS idx_side_quests_embedding ON side_quests USING hnsw (embedding vector_cosine_ops);
