-- Create user_interactions table to store card interaction history
CREATE TABLE IF NOT EXISTS user_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    user_id UUID NOT NULL,
    quest_id UUID NOT NULL REFERENCES side_quests(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL, -- 'click', 'save', 'read', 'skip'
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user history lookup
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);

-- Index on quest_id for joins
CREATE INDEX IF NOT EXISTS idx_user_interactions_quest_id ON user_interactions(quest_id);
