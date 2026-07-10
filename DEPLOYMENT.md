# SideQuestre Production Deployment Guidelines

This checklist documents the required environment variables, configuration parameters, and structural steps needed to host the SideQuestre application in production.

---

## 1. Environment Configuration

### Backend Service (Express API)
Set the following environment variables in your production server environment (e.g., Render.com Web Service):

| Variable Name | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `PORT` | Port for the Express API to listen on. | `5001` |
| `NODE_ENV` | Mode of operation. | `production` |
| `DATABASE_URL` | PostgreSQL connection string with PostGIS & pgvector. | `postgresql://user:password@host:port/dbname?sslmode=require` |
| `GEMINI_API_KEY` | Google Generative AI SDK key for `gemini-2.5-flash` and `text-embedding-004`. | `AIzaSy...` (obtain from Google AI Studio) |

### Frontend Client (React/Next.js)
Set the following environment variables in your hosting provider (e.g., Vercel, Netlify):

| Variable Name | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Public endpoint of the hosted Backend service. | `https://sidequestre-api.onrender.com` |

---

## 2. Target Structural Steps

### Phase 1: Database Setup
1. Spin up a managed PostgreSQL 16 instance (e.g., Render Managed PostgreSQL, Supabase, or AWS RDS).
2. Execute the migrations in order:
   - Run [01_init.sql](file:///Users/aditya/Downloads/sidequestre/backend/migrations/01_init.sql) to enable PostGIS and pgvector, create the `uuid_generate_v7()` function, define `side_quests` table, and setup GIST/HNSW indexes.
   - Run [02_interactions.sql](file:///Users/aditya/Downloads/sidequestre/backend/migrations/02_interactions.sql) to create `user_interactions` table for preference tracking.

### Phase 2: Backend Container Deployment
1. Build the production Docker image using the provided [Dockerfile](file:///Users/aditya/Downloads/sidequestre/backend/Dockerfile):
   ```bash
   docker build -t sidequestre-backend:latest ./backend
   ```
2. For one-click Render deployment, link the repository and use the [render.yaml](file:///Users/aditya/Downloads/sidequestre/backend/render.yaml) blueprint. This automatically configures:
   - Web service running the Docker environment.
   - Private managed PostgreSQL database instance.

### Phase 3: Frontend Client Deployment
1. Deploy the `frontend/` directory to Vercel or Netlify.
2. Vercel automatically detects the Next.js project. Ensure that the Root Directory parameter is configured to `frontend`.
3. Supply the `NEXT_PUBLIC_API_URL` environment variable during the setup.
