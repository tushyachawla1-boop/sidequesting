import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize real database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/sidequest',
});

// Helper for Haversine distance in miles
function getDistanceInMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Helper for Cosine Similarity
function getCosineSimilarity(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    normA += v1[i] * v1[i];
    normB += v2[i] * v2[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Helper to generate deterministic normalized mock vector of length 1536
function generateMockVector(text: string): number[] {
  const vector = new Array(1536).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  for (let i = 0; i < 1536; i++) {
    const val = Math.sin(hash + i) * 10000;
    vector[i] = val - Math.floor(val);
  }
  let sumSq = 0;
  for (let i = 0; i < 1536; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq);
  for (let i = 0; i < 1536; i++) {
    vector[i] /= norm;
  }
  return vector;
}

// Pre-seeded Mock database store representing side_quests and user_interactions
const fieldsData = [
  {
    field: 'Artificial Intelligence',
    tag: 'AI',
    companies: [
      { name: 'OpenAI Research', url: 'https://openai.com/careers/' },
      { name: 'Google DeepMind', url: 'https://deepmind.google/about/careers/' },
      { name: 'Anthropic AI', url: 'https://www.anthropic.com/careers' },
      { name: 'Cohere AI', url: 'https://cohere.com/careers' },
      { name: 'Mistral AI', url: 'https://mistral.ai/jobs/' }
    ]
  },
  {
    field: 'Software & Programming',
    tag: 'Coding',
    companies: [
      { name: 'GitHub Engineering', url: 'https://github.com/about/careers' },
      { name: 'Microsoft Developer Division', url: 'https://careers.microsoft.com/' },
      { name: 'Vercel Labs', url: 'https://vercel.com/careers' },
      { name: 'Stripe Platform Team', url: 'https://stripe.com/jobs' },
      { name: 'Amazon Web Services', url: 'https://aws.amazon.com/careers/' }
    ]
  },
  {
    field: 'Entrepreneurship',
    tag: 'Startup',
    companies: [
      { name: 'Y Combinator', url: 'https://www.ycombinator.com/apply/' },
      { name: 'Antler India', url: 'https://www.antler.co/careers' },
      { name: 'Sequoia Capital', url: 'https://www.sequoiacap.com/' },
      { name: 'Matrix Partners', url: 'https://www.matrixpartners.com/' },
      { name: 'Kalaari Capital', url: 'https://www.kalaari.com/' }
    ]
  },
  {
    field: 'Business & Management',
    tag: 'Business',
    companies: [
      { name: 'McKinsey & Company', url: 'https://www.mckinsey.com/careers' },
      { name: 'Boston Consulting Group', url: 'https://www.bcg.com/careers' },
      { name: 'Bain & Company', url: 'https://www.bain.com/careers/' },
      { name: 'Tata Administrative Services', url: 'https://www.tata.com/careers' },
      { name: 'Reliance Industries', url: 'https://www.relianceindustries.com/' }
    ]
  },
  {
    field: 'Finance & Investing',
    tag: 'Finance',
    companies: [
      { name: 'Goldman Sachs', url: 'https://www.goldmansachs.com/careers' },
      { name: 'JPMorgan Chase', url: 'https://careers.jpmorganchase.com' },
      { name: 'Zerodha Tech', url: 'https://zerodha.com/careers' },
      { name: 'Paytm Financials', url: 'https://paytm.com/careers' },
      { name: 'BlackRock India', url: 'https://www.blackrock.com/corporate/careers' }
    ]
  },
  {
    field: 'Data Science & Analytics',
    tag: 'Data',
    companies: [
      { name: 'Snowflake Analytics', url: 'https://www.snowflake.com/careers/' },
      { name: 'Databricks India', url: 'https://www.databricks.com/company/careers' },
      { name: 'Mu Sigma', url: 'https://www.mu-sigma.com/' },
      { name: 'Fractal Analytics', url: 'https://fractal.ai/careers/' },
      { name: 'Palantir Technologies', url: 'https://www.palantir.com/careers/' }
    ]
  },
  {
    field: 'Design & Creativity',
    tag: 'Design',
    companies: [
      { name: 'Figma Design Lab', url: 'https://www.figma.com/careers/' },
      { name: 'Canva Creative', url: 'https://www.canva.com/careers/' },
      { name: 'Adobe Design Team', url: 'https://www.adobe.com/careers.html' },
      { name: 'Razorpay Design', url: 'https://razorpay.com/jobs/' },
      { name: 'Zomato Design Team', url: 'https://www.zomato.com/careers' }
    ]
  },
  {
    field: 'Media & Content Creation',
    tag: 'Media',
    companies: [
      { name: 'Netflix Creative Hub', url: 'https://jobs.netflix.com/' },
      { name: 'T-Series Digital', url: 'https://www.tseries.com/' },
      { name: 'Pocket Aces', url: 'https://www.pocketaces.in/' },
      { name: 'Prasar Bharati', url: 'https://prasarbharati.gov.in/' },
      { name: 'NDTV Media Labs', url: 'https://www.ndtv.com/' }
    ]
  },
  {
    field: 'Marketing & Branding',
    tag: 'Marketing',
    companies: [
      { name: 'Hindustan Unilever', url: 'https://www.hul.co.in/careers/' },
      { name: 'Coca-Cola India', url: 'https://www.coca-colaindia.com/' },
      { name: 'Ogilvy & Mather', url: 'https://www.ogilvy.com/careers' },
      { name: 'Dentsu Creative', url: 'https://www.dentsu.com/' },
      { name: 'Nykaa Marketing', url: 'https://www.nykaa.com/' }
    ]
  },
  {
    field: 'Policy Making & Governance',
    tag: 'Policy',
    companies: [
      { name: 'Centre for Policy Research', url: 'https://cprindia.org/careers/' },
      { name: 'NITI Aayog Outreach', url: 'https://www.niti.gov.in/' },
      { name: 'Observer Research Foundation', url: 'https://www.orfonline.org/careers/' },
      { name: 'LAMP Fellowship Secretariat', url: 'https://prsindia.org/lamp' },
      { name: 'IIPA Delhi', url: 'https://www.iipa.org.in/' }
    ]
  },
  {
    field: 'Law & Justice',
    tag: 'Law',
    companies: [
      { name: 'Vidhi Legal Policy', url: 'https://vidhilegalpolicy.in/careers/' },
      { name: 'NLUD Legal Aid', url: 'https://nludelhi.ac.in/' },
      { name: 'PUCL India', url: 'https://pucl.org/' },
      { name: 'Legal Aid Society', url: 'https://www.legalaid.gov.in/' },
      { name: 'Shardul Amarchand Mangaldas', url: 'https://www.samlegal.com/' }
    ]
  },
  {
    field: 'Healthcare & Medicine',
    tag: 'Healthcare',
    companies: [
      { name: 'AIIMS Delhi Research', url: 'https://www.aiims.edu/' },
      { name: 'Fortis Healthcare', url: 'https://www.fortishealthcare.com/' },
      { name: 'Max Hospital Research', url: 'https://www.maxhealthcare.in/' },
      { name: 'Biocon Labs', url: 'https://www.biocon.com/' },
      { name: 'Serum Institute', url: 'https://www.seruminstitute.com/' }
    ]
  },
  {
    field: 'Science & Research',
    tag: 'Science',
    companies: [
      { name: 'IISc Bangalore Labs', url: 'https://iisc.ac.in/' },
      { name: 'TIFR Mumbai', url: 'https://www.tifr.res.in/' },
      { name: 'CSIR India', url: 'https://www.csir.res.in/' },
      { name: 'NPL Delhi', url: 'https://www.nplindia.org/' },
      { name: 'JNU Physical Sciences', url: 'https://www.jnu.ac.in/sps' }
    ]
  },
  {
    field: 'Climate & Sustainability',
    tag: 'Sustainability',
    companies: [
      { name: 'TERI India', url: 'https://www.teriin.org/' },
      { name: 'CSE Delhi', url: 'https://www.cseindia.org/' },
      { name: 'WWF India', url: 'https://www.wwfindia.org/' },
      { name: 'Greenpeace India', url: 'https://www.greenpeace.org/india/' },
      { name: 'WRI India', url: 'https://wri-india.org/' }
    ]
  },
  {
    field: 'Space & Aerospace',
    tag: 'Space',
    companies: [
      { name: 'ISRO Space Applications', url: 'https://www.isro.gov.in/' },
      { name: 'DRDO Labs', url: 'https://www.drdo.gov.in/' },
      { name: 'Skyroot Aerospace', url: 'https://www.skyroot.in/' },
      { name: 'Pixxel Space', url: 'https://www.pixxel.space/' },
      { name: 'Agnikul Cosmos', url: 'https://agnikul.in/' }
    ]
  },
  {
    field: 'Cybersecurity',
    tag: 'Cybersecurity',
    companies: [
      { name: 'DSCI India', url: 'https://www.dsci.in/' },
      { name: 'CERT-In Outreach', url: 'https://www.cert-in.org.in/' },
      { name: 'Quick Heal Labs', url: 'https://www.quickheal.co.in/' },
      { name: 'TAC Security', url: 'https://tacsecurity.com/' },
      { name: 'CrowdStrike India', url: 'https://www.crowdstrike.com/' }
    ]
  },
  {
    field: 'Gaming & Interactive Media',
    tag: 'Gaming',
    companies: [
      { name: 'Nazara Technologies', url: 'https://www.nazara.com/' },
      { name: 'Dream11 Gaming', url: 'https://www.sportzinteractive.net/' },
      { name: 'JetSynthesys', url: 'https://jetsynthesys.com/' },
      { name: 'Ubisoft India', url: 'https://www.ubisoft.com/en-us/company/careers/locations/pune' },
      { name: 'Rockstar India', url: 'https://www.rockstargames.com/careers' }
    ]
  },
  {
    field: 'Engineering & Robotics',
    tag: 'Robotics',
    companies: [
      { name: 'L&T Robotics', url: 'https://www.larsentoubro.com/' },
      { name: 'Tata Motors', url: 'https://www.tatamotors.com/' },
      { name: 'Systemantics Robotics', url: 'https://systemantics.com/' },
      { name: 'GreyOrange Labs', url: 'https://www.greyorange.com/' },
      { name: 'IIT Delhi Robotics Lab', url: 'https://robotics.iitd.ac.in/' }
    ]
  },
  {
    field: 'International Relations',
    tag: 'Global',
    companies: [
      { name: 'ICWA Sapru House', url: 'https://www.icwa.in/' },
      { name: 'IPCS Delhi', url: 'http://www.ipcs.org/' },
      { name: 'USI Strategic Dept', url: 'https://usiofindia.org/' },
      { name: 'RIS Delhi', url: 'http://www.ris.org.in/' },
      { name: 'CPR Diplomatic Division', url: 'https://cprindia.org/careers/' }
    ]
  },
  {
    field: 'Psychology & Human Behavior',
    tag: 'Psychology',
    companies: [
      { name: 'NIMHANS Labs', url: 'https://nimhans.ac.in/' },
      { name: 'DU Psychology Dept', url: 'http://psychology.du.ac.in/' },
      { name: 'IHBAS Delhi', url: 'http://ihbas.delhigovt.nic.in/' },
      { name: 'Fortis Mental Health', url: 'https://www.fortishealthcare.com/' },
      { name: 'Ashoka Psychology', url: 'https://www.ashoka.edu.in/' }
    ]
  }
];

let mockQuests: any[] = [];
const lifecycles = ['internship', 'event', 'fellowship', 'workshop', 'hackathon'];

// Programmatically seed 100 high-fidelity active quests (5 per field)
fieldsData.forEach((fieldObj) => {
  fieldObj.companies.forEach((comp, idx) => {
    const lifecycle = lifecycles[idx % lifecycles.length];
    const id = `quest-field-${fieldObj.tag.toLowerCase()}-${idx}`;
    const price = idx % 2 === 0 ? 0.00 : 10.00;
    
    const delLocs = [
      { address: 'Saket District Centre, New Delhi, Delhi 110017', lat: 28.5284, lon: 77.2185 },
      { address: 'DLF Cyber City, Gurugram, Haryana 122002', lat: 28.4950, lon: 77.0880 },
      { address: 'Sector 62, Noida, Uttar Pradesh 201301', lat: 28.6210, lon: 77.3620 }
    ];
    const loc = delLocs[idx % delLocs.length];

    let title = '';
    if (lifecycle === 'internship') title = `${comp.name} Summer ${fieldObj.field} Internship`;
    else if (lifecycle === 'fellowship') title = `${comp.name} ${fieldObj.field} Fellowship`;
    else if (lifecycle === 'event') title = `${comp.name} ${fieldObj.field} Seminar & Panel`;
    else if (lifecycle === 'workshop') title = `${comp.name} ${fieldObj.field} Masterclass`;
    else title = `${comp.name} ${fieldObj.field} Hackathon`;

    // Start date (always future dates starting from July 15, 2026 to August 30, 2026)
    // Accept applications as of July 11, 2026
    const startDate = new Date(Date.now() + (5 + idx * 5) * 24 * 60 * 60 * 1000).toISOString();

    mockQuests.push({
      id,
      title,
      organizer: comp.name,
      status: 'active',
      lifecycle_type: lifecycle,
      price,
      currency: 'INR',
      formatted_address: loc.address,
      latitude: loc.lat,
      longitude: loc.lon,
      tags: [fieldObj.tag, lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1), 'Career', 'Learning'],
      summary: `A high-impact opportunity at ${comp.name} focusing on key areas of ${fieldObj.field}. Complete hands-on projects, participate in networking events, and gain career-building skills.`,
      embedding: generateMockVector(`${title} ${comp.name} ${fieldObj.field}`),
      start_date: startDate,
      raw_source_url: comp.url,
      target_education: idx % 2 === 0 ? 'undergrad' : 'masters'
    });
  });
});

const mockInteractions: any[] = [
  { user_id: '019535d9-3df7-79fb-b466-fa907fa17f9e', quest_id: 'quest-field-ai-0', interaction_type: 'click' },
  { user_id: '019535d9-3df7-79fb-b466-fa907fa17f9e', quest_id: 'quest-field-coding-1', interaction_type: 'save' }
];

// GET /api/v1/quests/feed
app.get('/api/v1/quests/feed', async (req, res) => {
  const { user_id, lat, lon, radius_miles, max_budget, limit, education_level, interests } = req.query;

  // Validation
  if (!user_id || !lat || !lon || !radius_miles || !max_budget) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required parameters: user_id, lat, lon, radius_miles, max_budget'
    });
  }

  const userIdStr = String(user_id);
  const latNum = parseFloat(String(lat));
  const lonNum = parseFloat(String(lon));
  const radiusMilesNum = parseFloat(String(radius_miles));
  const maxBudgetNum = parseFloat(String(max_budget));
  const limitNum = limit ? parseInt(String(limit), 10) : 10;

  console.log(`\n[FEED REQUEST] User: ${userIdStr} | Lat: ${latNum}, Lon: ${lonNum} | Radius: ${radiusMilesNum} miles | Max Budget: $${maxBudgetNum} | Limit: ${limitNum}`);

  let candidates: any[] = [];
  let userTagWeights: Record<string, number> = {};
  let preferenceEmbedding: number[] = [];

  // Try to read from PostgreSQL database. If database connection fails, fallback gracefully to Mock DB.
  let isUsingMock = false;
  try {
    // Attempt database check
    const client = await pool.connect();
    client.release();

    console.log('[FEED] Connecting to PostgreSQL database...');
    // 1. Get user dynamic tag weights
    const tagWeightQuery = `
      SELECT 
          unnested_tag AS tag,
          SUM(
              CASE 
                  WHEN ui.interaction_type = 'click' THEN 10.0
                  WHEN ui.interaction_type = 'save' THEN 3.0
                  WHEN ui.interaction_type = 'read' THEN -0.5
                  WHEN ui.interaction_type = 'skip' THEN -2.0
                  ELSE 0.0
              END
          )::float AS weight
      FROM user_interactions ui
      JOIN side_quests sq ON ui.quest_id = sq.id
      CROSS JOIN LATERAL unnest(sq.tags) AS unnested_tag
      WHERE ui.user_id = $1
      GROUP BY unnested_tag;
    `;
    const tagWeightResult = await pool.query(tagWeightQuery, [userIdStr]);
    tagWeightResult.rows.forEach(row => {
      userTagWeights[row.tag] = row.weight;
    });

    // 2. Compute preference embedding (average of embeddings with positive interactions: click/save)
    const prefEmbeddingQuery = `
      SELECT embedding::text
      FROM user_interactions ui
      JOIN side_quests sq ON ui.quest_id = sq.id
      WHERE ui.user_id = $1
        AND ui.interaction_type IN ('click', 'save');
    `;
    const prefEmbeddingResult = await pool.query(prefEmbeddingQuery, [userIdStr]);
    if (prefEmbeddingResult.rows.length > 0) {
      const vectors = prefEmbeddingResult.rows.map(row => {
        // Parse vector string '[0.1, 0.2, ...]' into numbers
        return row.embedding.replace('[', '').replace(']', '').split(',').map(Number);
      });
      // Average the vectors
      const len = vectors[0].length;
      const avgVector = new Array(len).fill(0);
      vectors.forEach(v => {
        for (let i = 0; i < len; i++) {
          avgVector[i] += v[i];
        }
      });
      for (let i = 0; i < len; i++) {
        avgVector[i] /= vectors.length;
      }
      preferenceEmbedding = avgVector;
    }

    // 3. Fetch candidate quests within budget and distance
    // ST_DWithin geography uses meters (radiusMiles * 1609.34)
    const candidatesQuery = `
      SELECT id, title, organizer, status, lifecycle_type, price, currency, formatted_address,
             ST_X(coordinates::geometry) as longitude, ST_Y(coordinates::geometry) as latitude,
             embedding::text, tags, start_date
      FROM side_quests
      WHERE status = 'active'
        AND price <= $1
        AND ST_DWithin(coordinates::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4 * 1609.34);
    `;
    const candidatesResult = await pool.query(candidatesQuery, [maxBudgetNum, lonNum, latNum, radiusMilesNum]);
    candidates = candidatesResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      organizer: row.organizer,
      status: row.status,
      lifecycle_type: row.lifecycle_type,
      price: parseFloat(row.price),
      currency: row.currency,
      formatted_address: row.formatted_address,
      latitude: row.latitude,
      longitude: row.longitude,
      tags: row.tags,
      embedding: row.embedding.replace('[', '').replace(']', '').split(',').map(Number),
      start_date: row.start_date
    }));

  } catch (dbError) {
    console.log('[FEED] PostgreSQL database is unavailable. Falling back to in-memory Mock DB.');
    isUsingMock = true;

    // 1. Calculate dynammic user tag weights in mock store
    mockInteractions
      .filter(ui => ui.user_id === userIdStr)
      .forEach(ui => {
        const quest = mockQuests.find(q => q.id === ui.quest_id);
        if (quest) {
          let score = 0;
          if (ui.interaction_type === 'click') score = 10;
          else if (ui.interaction_type === 'save') score = 3;
          else if (ui.interaction_type === 'read') score = -0.5;
          else if (ui.interaction_type === 'skip') score = -2.0;

          quest.tags.forEach((tag: string) => {
            userTagWeights[tag] = (userTagWeights[tag] || 0) + score;
          });
        }
      });

    // 2. Compute preference embedding in mock store (average of click/save events)
    const positiveQuestIds = mockInteractions
      .filter(ui => ui.user_id === userIdStr && (ui.interaction_type === 'click' || ui.interaction_type === 'save'))
      .map(ui => ui.quest_id);
    
    const positiveQuests = mockQuests.filter(q => positiveQuestIds.includes(q.id));
    if (positiveQuests.length > 0) {
      const len = positiveQuests[0].embedding.length;
      const avgVector = new Array(len).fill(0);
      positiveQuests.forEach(q => {
        for (let i = 0; i < len; i++) {
          avgVector[i] += q.embedding[i];
        }
      });
      for (let i = 0; i < len; i++) {
        avgVector[i] /= positiveQuests.length;
      }
      preferenceEmbedding = avgVector;
    }

    // 3. Filter candidate quests by budget and distance bubble
    candidates = mockQuests.filter(q => {
      const active = q.status === 'active';
      const withinBudget = q.price <= maxBudgetNum;
      const distance = getDistanceInMiles(latNum, lonNum, q.latitude, q.longitude);
      const withinDistance = distance <= radiusMilesNum;

      console.log(`  -> Mock Quest "${q.title}": Active=${active}, BudgetOk=${withinBudget}, Distance=${distance.toFixed(2)}mi (Within=${withinDistance})`);
      return active && withinBudget && withinDistance;
    });
  }

  // 3b. Filter candidates based on educational eligibility
  const eduLevel = String(education_level || 'undergrad').toLowerCase();
  const getTargetEdu = (title: string) => {
    const titleLower = title.toLowerCase();
    if (
      titleLower.includes('advanced') ||
      titleLower.includes('deep learning') ||
      titleLower.includes('seminar') ||
      titleLower.includes('cryptography') ||
      titleLower.includes('algorithms') ||
      titleLower.includes('research')
    ) {
      return 'masters';
    } else if (
      titleLower.includes('intro') ||
      titleLower.includes('basics') ||
      titleLower.includes('volunteering') ||
      titleLower.includes('restoration') ||
      titleLower.includes('photography') ||
      titleLower.includes('hike') ||
      titleLower.includes('sailing') ||
      titleLower.includes('environmental') ||
      titleLower.includes('cleanup')
    ) {
      return 'school';
    }
    return 'undergrad';
  };

  candidates = candidates.filter(c => {
    const targetEdu = c.target_education || getTargetEdu(c.title);
    if (eduLevel === 'school') {
      return targetEdu === 'school';
    } else if (eduLevel === 'undergrad') {
      return targetEdu === 'school' || targetEdu === 'undergrad';
    }
    return true; // masters can see school, undergrad, and masters events
  });

  // 3c. Filter & Score by Onboarding Selected Interests
  const selectedInterests = interests ? String(interests).split(',') : [];
  if (selectedInterests.length > 0) {
    const normalizeInterest = (interest: string) => {
      const lower = interest.toLowerCase().trim();
      if (lower.includes('ai') || lower.includes('artificial')) return 'ai';
      if (lower.includes('coding') || lower.includes('programming') || lower.includes('software')) return 'coding';
      if (lower.includes('entrepreneurship') || lower.includes('startup')) return 'startup';
      if (lower.includes('business') || lower.includes('management') || lower.includes('strategy')) return 'business';
      if (lower.includes('finance') || lower.includes('investing')) return 'finance';
      if (lower.includes('data science') || lower.includes('analytics') || lower.includes('stats')) return 'data';
      if (lower.includes('design') || lower.includes('creativity') || lower.includes('ui/ux') || lower.includes('uiux')) return 'design';
      if (lower.includes('media') || lower.includes('content') || lower.includes('video')) return 'media';
      if (lower.includes('marketing') || lower.includes('branding') || lower.includes('growth')) return 'marketing';
      if (lower.includes('policy') || lower.includes('governance')) return 'policy';
      if (lower.includes('law') || lower.includes('justice') || lower.includes('legal')) return 'law';
      if (lower.includes('health') || lower.includes('medicine') || lower.includes('medical') || lower.includes('biotech')) return 'healthcare';
      if (lower.includes('science') || lower.includes('research')) return 'science';
      if (lower.includes('climate') || lower.includes('sustainability') || lower.includes('environment')) return 'sustainability';
      if (lower.includes('space') || lower.includes('aerospace') || lower.includes('astronomy')) return 'space';
      if (lower.includes('cyber') || lower.includes('hacking') || lower.includes('security')) return 'cybersecurity';
      if (lower.includes('gaming') || lower.includes('interactive') || lower.includes('xr') || lower.includes('esports')) return 'gaming';
      if (lower.includes('robotics') || lower.includes('engineering')) return 'robotics';
      if (lower.includes('international') || lower.includes('global') || lower.includes('diplomacy') || lower.includes('relations')) return 'global';
      if (lower.includes('psychology') || lower.includes('behavior') || lower.includes('brain')) return 'psychology';
      return lower;
    };
    
    const normalizedSelected = selectedInterests.map(normalizeInterest);
    console.log(`[FEED] Filtering candidates by selected interests:`, normalizedSelected);
    
    candidates = candidates.filter(c => {
      const normalizedQuestTags = c.tags.map((t: string) => t.toLowerCase());
      return normalizedQuestTags.some((qt: string) => 
        normalizedSelected.some(ns => qt.includes(ns) || ns.includes(qt))
      );
    });

    candidates.forEach(c => {
      const normalizedQuestTags = c.tags.map((t: string) => t.toLowerCase());
      const matchCount = normalizedSelected.filter(ns => 
        normalizedQuestTags.some((qt: string) => qt.includes(ns) || ns.includes(qt))
      ).length;
      
      // Boost tagAffinity heavily based on match count (intersection items get highest priority)
      c.tagAffinity = (c.tagAffinity || 0) + (matchCount * 50);
    });
  }

  console.log(`[FEED] Dynamic User Tag Weights:`, userTagWeights);
  console.log(`[FEED] Filtered candidate quests count: ${candidates.length}`);

  if (candidates.length === 0) {
    return res.json({ feed: [] });
  }

  // 4. Calculate affinity scores and semantic similarities for candidate quests
  const ratedCandidates = candidates.map(c => {
    // Dynamic tag affinity score (sum of weights of matching tags)
    let tagAffinity = 0;
    c.tags.forEach((tag: string) => {
      tagAffinity += userTagWeights[tag] || 0;
    });

    // Semantic cosine similarity to user's preference embedding
    let semanticSimilarity = 0;
    if (preferenceEmbedding.length > 0) {
      semanticSimilarity = getCosineSimilarity(c.embedding, preferenceEmbedding);
    }

    return {
      ...c,
      tagAffinity,
      semanticSimilarity
    };
  });

  // 5. Partition feed deck using 60/30/10 split
  // 60% high-affinity, 30% semantically adjacent, 10% wildcards
  const targetHighAffinityCount = Math.round(limitNum * 0.6);
  const targetSemanticCount = Math.round(limitNum * 0.3);
  const targetWildcardCount = Math.max(1, limitNum - targetHighAffinityCount - targetSemanticCount); // remaining

  console.log(`[FEED] Target deck split counts: High-Affinity=${targetHighAffinityCount} | Semantic-Adjacent=${targetSemanticCount} | Wildcard=${targetWildcardCount}`);

  // Sort by tag affinity for the High-Affinity pool
  const sortedByAffinity = [...ratedCandidates].sort((a, b) => b.tagAffinity - a.tagAffinity);
  
  // Select High-Affinity subset
  const highAffinitySelection = sortedByAffinity.slice(0, targetHighAffinityCount).map(item => ({
    ...item,
    feed_deck: 'high_affinity'
  }));

  const selectedIds = new Set(highAffinitySelection.map(item => item.id));

  // Sort by semantic similarity for the Semantic-Adjacent pool (excluding already selected)
  const remainingCandidates = ratedCandidates.filter(c => !selectedIds.has(c.id));
  const sortedBySemantic = [...remainingCandidates].sort((a, b) => b.semanticSimilarity - a.semanticSimilarity);
  
  const semanticSelection = sortedBySemantic.slice(0, targetSemanticCount).map(item => ({
    ...item,
    feed_deck: 'semantic_adjacent'
  }));

  semanticSelection.forEach(item => selectedIds.add(item.id));

  // Pure randomized wildcards (random selection from the remaining candidates)
  const leftoverCandidates = ratedCandidates.filter(c => !selectedIds.has(c.id));
  
  // Shuffle leftover candidates
  const shuffledLeftover = [...leftoverCandidates].sort(() => Math.random() - 0.5);
  const wildcardSelection = shuffledLeftover.slice(0, targetWildcardCount).map(item => ({
    ...item,
    feed_deck: 'wildcard'
  }));

  // Combine into final card deck
  const finalFeed = [...highAffinitySelection, ...semanticSelection, ...wildcardSelection];
  
  // Sort the final card deck by upcoming start_date (deadline) from nearest first
  finalFeed.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  // Clean embeddings and intermediate scores from the final client response output to keep it compact
  const clientResponseFeed = finalFeed.map(item => {
    const { embedding, ...rest } = item;
    return rest;
  });

  console.log(`[FEED] Successfully generated card deck with ${clientResponseFeed.length} items. (DataSource: ${isUsingMock ? 'Mock DB' : 'PostgreSQL DB'})`);
  res.json({
    feed: clientResponseFeed
  });
});

// POST /swipe endpoint to register user swipes
app.post('/swipe', async (req, res) => {
  const { user_id, quest_id, action } = req.body;
  if (!user_id || !quest_id || !action) {
    return res.status(400).json({ error: 'Missing parameters user_id, quest_id, or action' });
  }

  const interactionType = action === 'Interested' ? 'save' : 'skip';
  console.log(`[SWIPE] User ${user_id} swiped ${action} on Quest ${quest_id} (Mapped to: ${interactionType})`);

  try {
    let isMock = false;
    try {
      const c = await pool.connect();
      c.release();
    } catch {
      isMock = true;
    }

    if (isMock) {
      mockInteractions.push({
        user_id: String(user_id),
        quest_id: String(quest_id),
        interaction_type: interactionType
      });
      console.log(`[SWIPE] Interaction saved to mock store. Total mock interactions: ${mockInteractions.length}`);
      return res.json({ status: 'ok', source: 'mock_db' });
    } else {
      const insertQuery = `
        INSERT INTO user_interactions (user_id, quest_id, interaction_type)
        VALUES ($1, $2, $3)
        RETURNING id;
      `;
      const result = await pool.query(insertQuery, [user_id, quest_id, interactionType]);
      return res.json({ status: 'ok', source: 'postgres_db', id: result.rows[0].id });
    }
  } catch (error: any) {
    mockInteractions.push({
      user_id: String(user_id),
      quest_id: String(quest_id),
      interaction_type: interactionType
    });
    return res.json({ status: 'ok', source: 'mock_db_fallback', message: error.message });
  }
});

// Alias for swiping endpoint
app.post('/api/v1/quests/swipe', async (req, res) => {
  // Use internal redirect or handle directly
  const { user_id, quest_id, action } = req.body;
  if (!user_id || !quest_id || !action) {
    return res.status(400).json({ error: 'Missing parameters user_id, quest_id, or action' });
  }
  const interactionType = action === 'Interested' ? 'save' : 'skip';
  mockInteractions.push({
    user_id: String(user_id),
    quest_id: String(quest_id),
    interaction_type: interactionType
  });
  return res.json({ status: 'ok', source: 'mock_db_alias' });
});

async function seedDatabaseIfNeeded() {
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'side_quests'
      );
    `);
    if (!tableCheck.rows[0].exists) {
      console.log('[SEED] side_quests table does not exist yet. Skipping database seeding.');
      return;
    }

    const res = await pool.query('SELECT COUNT(*) FROM side_quests;');
    const count = parseInt(res.rows[0].count, 10);
    if (count === 0) {
      console.log('[SEED] Database side_quests table is empty. Seeding 100 programmatic quests...');
      for (const quest of mockQuests) {
        const insertQuery = `
          INSERT INTO side_quests (
            id, title, organizer, status, lifecycle_type, price, currency, formatted_address, coordinates, tags, summary, embedding, start_date, raw_source_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326), $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO NOTHING;
        `;
        await pool.query(insertQuery, [
          quest.id,
          quest.title,
          quest.organizer,
          quest.status,
          quest.lifecycle_type,
          quest.price,
          quest.currency,
          quest.formatted_address,
          quest.longitude,
          quest.latitude,
          quest.tags,
          quest.summary,
          `[${quest.embedding.join(',')}]`,
          quest.start_date,
          quest.raw_source_url
        ]);
      }
      console.log('[SEED] Database successfully seeded with 100 active quests!');
    } else {
      console.log(`[SEED] Database already has ${count} quests. Skipping startup seeding.`);
    }
  } catch (err) {
    console.error('[SEED] Warning: Could not seed database on startup:', err);
  }
}

app.listen(port, () => {
  console.log(`API Server listening at http://localhost:${port}`);
  seedDatabaseIfNeeded();
});

// Background job to automatically add new opportunities (events, fellowships, internships)
// and prune expired opportunities every 30 minutes
setInterval(() => {
  console.log('[CRON] Running 30-minute opportunity update cycle...');

  const nowIso = new Date().toISOString();
  
  // 1. Remove expired quests from memory fallback
  const originalCount = mockQuests.length;
  mockQuests = mockQuests.filter(q => new Date(q.start_date).getTime() >= Date.now());
  if (mockQuests.length < originalCount) {
    console.log(`[CRON] Pruned ${originalCount - mockQuests.length} expired quests from in-memory store.`);
  }

  // 2. Remove expired quests from PostgreSQL database (if active)
  pool.query('DELETE FROM side_quests WHERE start_date < $1;', [nowIso])
    .then(res => {
      if (res.rowCount && res.rowCount > 0) {
        console.log(`[CRON] Pruned ${res.rowCount} expired quests from PostgreSQL.`);
      }
    })
    .catch(err => {
      console.warn('[CRON] Warning: Could not delete expired quests from PostgreSQL (db might be offline):', err.message);
    });

  // 3. Add a new active dynamic quest in one of the 20 fields
  const randomField = fieldsData[Math.floor(Math.random() * fieldsData.length)];
  const randomComp = randomField.companies[Math.floor(Math.random() * randomField.companies.length)];
  const lifecycle = lifecycles[Math.floor(Math.random() * lifecycles.length)];
  
  const delLocs = [
    { address: 'Saket District Centre, New Delhi, Delhi 110017', lat: 28.5284, lon: 77.2185 },
    { address: 'DLF Cyber City, Gurugram, Haryana 122002', lat: 28.4950, lon: 77.0880 },
    { address: 'Sector 62, Noida, Uttar Pradesh 201301', lat: 28.6210, lon: 77.3620 }
  ];
  const loc = delLocs[Math.floor(Math.random() * delLocs.length)];

  let title = '';
  if (lifecycle === 'internship') title = `${randomComp.name} Summer ${randomField.field} Internship`;
  else if (lifecycle === 'fellowship') title = `${randomComp.name} ${randomField.field} Fellowship`;
  else if (lifecycle === 'event') title = `${randomComp.name} ${randomField.field} Seminar & Panel`;
  else if (lifecycle === 'workshop') title = `${randomComp.name} ${randomField.field} Masterclass`;
  else title = `${randomComp.name} ${randomField.field} Hackathon`;

  const newQuestId = `dynamic-quest-${Date.now()}`;
  const titleWithTime = `${title} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
  const startDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

  const newQuest = {
    id: newQuestId,
    title: titleWithTime,
    organizer: randomComp.name,
    status: 'active',
    lifecycle_type: lifecycle,
    price: 0.00,
    currency: 'INR',
    formatted_address: loc.address,
    latitude: loc.lat,
    longitude: loc.lon,
    tags: [randomField.tag, lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1), 'Career', 'Learning'],
    summary: `A dynamically loaded ${lifecycle} targeting candidates interested in ${randomField.field} programs. Registration is open.`,
    embedding: generateMockVector(`${titleWithTime} ${randomComp.name} ${randomField.field}`),
    start_date: startDate,
    raw_source_url: randomComp.url,
    target_education: 'undergrad'
  };

  mockQuests.push(newQuest);
  console.log(`[CRON] Automatically added new opportunity: "${newQuest.title}" to memory store.`);

  const insertQuery = `
    INSERT INTO side_quests (
      id, title, organizer, status, lifecycle_type, price, currency, formatted_address, coordinates, tags, summary, embedding, start_date, raw_source_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326), $11, $12, $13, $14, $15)
    ON CONFLICT (id) DO NOTHING;
  `;
  pool.query(insertQuery, [
    newQuest.id,
    newQuest.title,
    newQuest.organizer,
    newQuest.status,
    newQuest.lifecycle_type,
    newQuest.price,
    newQuest.currency,
    newQuest.formatted_address,
    newQuest.longitude,
    newQuest.latitude,
    newQuest.tags,
    newQuest.summary,
    `[${newQuest.embedding.join(',')}]`,
    newQuest.start_date,
    newQuest.raw_source_url
  ])
    .then(() => {
      console.log(`[CRON] Successfully synced new opportunity "${newQuest.title}" to PostgreSQL.`);
    })
    .catch(err => {
      console.warn('[CRON] Warning: Could not sync new opportunity to PostgreSQL (db might be offline):', err.message);
    });
}, 30 * 60 * 1000);
