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
const realQuestsData = [
  {
    field: 'Artificial Intelligence',
    tag: 'AI',
    quests: [
      {
        title: 'OpenAI Residency Program',
        organizer: 'OpenAI',
        lifecycle_type: 'fellowship',
        url: 'https://openai.com/residency/',
        summary: 'The OpenAI Residency is a program designed for researchers and engineers transitioning into AI from other technical fields.'
      },
      {
        title: 'Google Summer of Code - TensorFlow AI Projects',
        organizer: 'Google Open Source',
        lifecycle_type: 'internship',
        url: 'https://summerofcode.withgoogle.com/',
        summary: 'Contribute to open-source machine learning frameworks like TensorFlow and Keras under expert Google developer mentorship.'
      }
    ]
  },
  {
    field: 'Software & Programming',
    tag: 'Coding',
    quests: [
      {
        title: 'MLH Summer Developer Fellowship',
        organizer: 'Major League Hacking',
        lifecycle_type: 'fellowship',
        url: 'https://fellowship.mlh.io/',
        summary: 'A 12-week educational program where students contribute to open-source software projects used globally.'
      },
      {
        title: 'Outreachy Open Source Software Internship',
        organizer: 'Software Freedom Conservancy',
        lifecycle_type: 'internship',
        url: 'https://www.outreachy.org/',
        summary: 'A remote internship program promoting diversity in tech by funding candidates to work on open-source projects.'
      }
    ]
  },
  {
    field: 'Entrepreneurship',
    tag: 'Startup',
    quests: [
      {
        title: 'Y Combinator Summer Startup Incubator',
        organizer: 'Y Combinator',
        lifecycle_type: 'hackathon',
        url: 'https://www.ycombinator.com/apply/',
        summary: 'YC invests $500k in twice-yearly batches of startups, providing intensive mentorship, pitch training, and demo day access.'
      },
      {
        title: 'Thiel Fellowship for Young Founders',
        organizer: 'Thiel Foundation',
        lifecycle_type: 'fellowship',
        url: 'https://thielfellowship.org/',
        summary: 'A two-year program offering $100,000 to young creators who want to build new things instead of sitting in a classroom.'
      }
    ]
  },
  {
    field: 'Business & Management',
    tag: 'Business',
    quests: [
      {
        title: 'McKinsey Business Analyst Intern Program',
        organizer: 'McKinsey & Company',
        lifecycle_type: 'internship',
        url: 'https://www.mckinsey.com/careers',
        summary: 'Work directly with client teams on core strategic problems, learning McKinsey consulting methodologies and frameworks.'
      },
      {
        title: 'BCG Associate Strategic Consulting Program',
        organizer: 'Boston Consulting Group',
        lifecycle_type: 'internship',
        url: 'https://www.bcg.com/careers',
        summary: 'Gain exposure to corporate strategy, operations, and business transformation projects under senior BCG advisors.'
      }
    ]
  },
  {
    field: 'Finance & Investing',
    tag: 'Finance',
    quests: [
      {
        title: 'Goldman Sachs Summer Analyst Internship',
        organizer: 'Goldman Sachs',
        lifecycle_type: 'internship',
        url: 'https://www.goldmansachs.com/careers',
        summary: 'An eight-to-ten week internship offering division-specific training in investment banking, global markets, or asset management.'
      },
      {
        title: 'J.P. Morgan Investment Banking Program',
        organizer: 'J.P. Morgan',
        lifecycle_type: 'internship',
        url: 'https://careers.jpmorganchase.com',
        summary: 'Analyze market trends, assist with financial modeling, and support execution of major M&A transactions.'
      }
    ]
  },
  {
    field: 'Data Science & Analytics',
    tag: 'Data',
    quests: [
      {
        title: 'Kaggle Machine Learning Competitions',
        organizer: 'Kaggle',
        lifecycle_type: 'hackathon',
        url: 'https://www.kaggle.com/competitions',
        summary: 'Compete on real-world datasets to build predictive models, earn prize money, and rank on the global leaderboard.'
      },
      {
        title: 'Databricks University Alliance Certification',
        organizer: 'Databricks',
        lifecycle_type: 'workshop',
        url: 'https://www.databricks.com/',
        summary: 'Free training and certifications in Spark, data engineering, and lakehouse architectures for university students.'
      }
    ]
  },
  {
    field: 'Design & Creativity',
    tag: 'Design',
    quests: [
      {
        title: 'Figma Config Design Conference',
        organizer: 'Figma',
        lifecycle_type: 'event',
        url: 'https://config.figma.com/',
        summary: 'Figma\'s annual global conference showcasing the future of design systems, developer handoff tools, and product design.'
      },
      {
        title: 'Interaction Design Foundation UX/UI Certifications',
        organizer: 'Interaction Design Foundation',
        lifecycle_type: 'workshop',
        url: 'https://www.interaction-design.org/',
        summary: 'Acquire globally recognized certifications in user research, wireframing, usability testing, and UI design.'
      }
    ]
  },
  {
    field: 'Media & Content Creation',
    tag: 'Media',
    quests: [
      {
        title: 'YouTube Creator Academy Program',
        organizer: 'YouTube',
        lifecycle_type: 'workshop',
        url: 'https://creatoracademy.youtube.com/',
        summary: 'Learn channel growth strategies, audience analytics, production techniques, and monetization policies directly from YouTube.'
      },
      {
        title: 'Adobe Creative Residency Program',
        organizer: 'Adobe',
        lifecycle_type: 'fellowship',
        url: 'https://www.adobe.com/',
        summary: 'Fully funded residency giving creators the time and resources to work on personal passion projects using Creative Cloud.'
      }
    ]
  },
  {
    field: 'Marketing & Branding',
    tag: 'Marketing',
    quests: [
      {
        title: 'Google APMM Marketing Program',
        organizer: 'Google',
        lifecycle_type: 'internship',
        url: 'https://buildyourfor.google/programs/apmm/',
        summary: 'A rotational program designed to kickstart marketing careers, working on product messaging, brand campaigns, and growth marketing.'
      },
      {
        title: 'HubSpot Academy Digital Marketing Certification',
        organizer: 'HubSpot',
        lifecycle_type: 'workshop',
        url: 'https://academy.hubspot.com/',
        summary: 'A free, structured course covering search engine optimization, content strategy, email marketing, and conversion optimization.'
      }
    ]
  },
  {
    field: 'Policy Making & Governance',
    tag: 'Policy',
    quests: [
      {
        title: 'LAMP Legislative Assistant Fellowship',
        organizer: 'PRS Legislative Research',
        lifecycle_type: 'fellowship',
        url: 'https://prsindia.org/lamp',
        summary: 'An intensive fellowship in Delhi mentoring young graduates to assist Members of Parliament with legislative research and policy reviews.'
      },
      {
        title: 'NITI Aayog Policy & Governance Internship',
        organizer: 'NITI Aayog',
        lifecycle_type: 'internship',
        url: 'https://www.niti.gov.in/internship',
        summary: 'Work directly with NITI Aayog verticals on public policy formulations, rural development metrics, and state coordination.'
      }
    ]
  },
  {
    field: 'Law & Justice',
    tag: 'Law',
    quests: [
      {
        title: 'Vidhi Legal Policy Research Internship',
        organizer: 'Vidhi Centre for Legal Policy',
        lifecycle_type: 'internship',
        url: 'https://vidhilegalpolicy.in/careers/',
        summary: 'Conduct legal research, draft policy briefs, and analyze public legislation at Vidhi\'s New Delhi office.'
      },
      {
        title: 'Supreme Court of India Law Clerkship',
        organizer: 'Supreme Court of India',
        lifecycle_type: 'fellowship',
        url: 'https://main.sci.gov.in/',
        summary: 'Assist Hon\'ble Judges of the Supreme Court with case briefs, legal analysis, research, and court room preparation.'
      }
    ]
  },
  {
    field: 'Healthcare & Medicine',
    tag: 'Healthcare',
    quests: [
      {
        title: 'WHO Public Health Internship Program',
        organizer: 'World Health Organization',
        lifecycle_type: 'internship',
        url: 'https://www.who.int/careers/internships',
        summary: 'Gain practical experience in global health policy, disease prevention campaigns, and healthcare data compilation.'
      },
      {
        title: 'AIIMS Medical & Biotech Research Fellowship',
        organizer: 'AIIMS New Delhi',
        lifecycle_type: 'fellowship',
        url: 'https://www.aiims.edu/',
        summary: 'Participate in medical laboratory projects, clinical trials analysis, or health system policy research at AIIMS.'
      }
    ]
  },
  {
    field: 'Science & Research',
    tag: 'Science',
    quests: [
      {
        title: 'CERN Summer Student Program',
        organizer: 'CERN',
        lifecycle_type: 'internship',
        url: 'https://careers.cern/summer',
        summary: 'Work on experimental physics, computing, or engineering projects at the Large Hadron Collider in Geneva, Switzerland.'
      },
      {
        title: 'IAS Summer Research Fellowship (SRFP)',
        organizer: 'Indian Academy of Sciences',
        lifecycle_type: 'fellowship',
        url: 'https://www.ias.ac.in/',
        summary: 'A fully funded two-month research fellowship placing students with leading scientists in research institutions across India.'
      }
    ]
  },
  {
    field: 'Climate & Sustainability',
    tag: 'Sustainability',
    quests: [
      {
        title: 'UNEP Environmental Policy Internship',
        organizer: 'United Nations Environment Programme',
        lifecycle_type: 'internship',
        url: 'https://www.unep.org/',
        summary: 'Support UNEP initiatives on biodiversity conservation, climate adaptation policies, and circular economy research.'
      },
      {
        title: 'CSE Environmental Communications Program',
        organizer: 'Centre for Science and Environment',
        lifecycle_type: 'workshop',
        url: 'https://www.cseindia.org/',
        summary: 'A short-term course on environmental journalism, climate justice, air pollution reporting, and green advocacy.'
      }
    ]
  },
  {
    field: 'Space & Aerospace',
    tag: 'Space',
    quests: [
      {
        title: 'ISRO Space Science Training Program',
        organizer: 'ISRO',
        lifecycle_type: 'workshop',
        url: 'https://www.isro.gov.in/',
        summary: 'Learn principles of satellite remote sensing, celestial mechanics, and launch vehicle dynamics from ISRO engineers.'
      },
      {
        title: 'NASA International Internship Program',
        organizer: 'NASA',
        lifecycle_type: 'internship',
        url: 'https://www.nasa.gov/careers/',
        summary: 'A prestigious internship placing international students in NASA research centers to work on space exploration projects.'
      }
    ]
  },
  {
    field: 'Cybersecurity',
    tag: 'Cybersecurity',
    quests: [
      {
        title: 'Google Cybersecurity Professional Program',
        organizer: 'Google',
        lifecycle_type: 'workshop',
        url: 'https://grow.google/certificates/cybersecurity/',
        summary: 'A hands-on professional certificate covering network security, threat detection, Python scriptings, and SQL.'
      },
      {
        title: 'SANS CyberStart Hacking Challenge',
        organizer: 'SANS Institute',
        lifecycle_type: 'hackathon',
        url: 'https://www.sans.org/',
        summary: 'A gamified cybersecurity competition teaching vulnerability analysis, password cracking, and forensics.'
      }
    ]
  },
  {
    field: 'Gaming & Interactive Media',
    tag: 'Gaming',
    quests: [
      {
        title: 'Epic Games Unreal Fellowship',
        organizer: 'Epic Games',
        lifecycle_type: 'fellowship',
        url: 'https://www.unrealengine.com/',
        summary: 'A 5-week intensive program teaching real-time rendering, virtual production, and game level design using Unreal Engine.'
      },
      {
        title: 'Unity Game Development Certification',
        organizer: 'Unity Technologies',
        lifecycle_type: 'workshop',
        url: 'https://unity.com/',
        summary: 'Earn industry-recognized certifications in game mechanics, C# scripting, and AR/VR interactive design.'
      }
    ]
  },
  {
    field: 'Engineering & Robotics',
    tag: 'Robotics',
    quests: [
      {
        title: 'Systemantics Robotics Systems Internship',
        organizer: 'Systemantics',
        lifecycle_type: 'internship',
        url: 'https://systemantics.com/',
        summary: 'Work on kinematics, control loops, and hardware testing of industrial collaborative robotic arms.'
      },
      {
        title: 'RoboCup International Robotics Challenge',
        organizer: 'RoboCup Federation',
        lifecycle_type: 'hackathon',
        url: 'https://www.robocup.org/',
        summary: 'A global competition where teams design autonomous soccer robots, rescue rovers, and home assistant systems.'
      }
    ]
  },
  {
    field: 'International Relations',
    tag: 'Global',
    quests: [
      {
        title: 'ICWA Foreign Policy & Diplomacy Internship',
        organizer: 'Indian Council of World Affairs',
        lifecycle_type: 'internship',
        url: 'https://www.icwa.in/',
        summary: 'Assist with geopolitical analysis, case studies on bilateral relations, and organizing international conferences in Sapru House.'
      },
      {
        title: 'United Nations HQ Internship Program',
        organizer: 'United Nations Secretariat',
        lifecycle_type: 'internship',
        url: 'https://careers.un.org/',
        summary: 'Gain direct insight into multilateral diplomacy, sustainable development goals, and peace operations at the UN.'
      }
    ]
  },
  {
    field: 'Psychology & Human Behavior',
    tag: 'Psychology',
    quests: [
      {
        title: 'NIMHANS Clinical Psychology Program',
        organizer: 'NIMHANS',
        lifecycle_type: 'workshop',
        url: 'https://nimhans.ac.in/',
        summary: 'A summer training course covering mental health diagnostics, cognitive behavior therapy models, and neuropsychology.'
      },
      {
        title: 'Ashoka Psychology Department Summer Research',
        organizer: 'Ashoka University',
        lifecycle_type: 'fellowship',
        url: 'https://www.ashoka.edu.in/',
        summary: 'Participate in cognitive science research projects, compiling behavioral data, and analyzing clinical surveys.'
      }
    ]
  }
];

let mockQuests: any[] = [];
const lifecycles = ['internship', 'event', 'fellowship', 'workshop', 'hackathon'];

// Programmatically seed 40 high-fidelity active real-world quests (2 per field)
realQuestsData.forEach((fieldObj) => {
  fieldObj.quests.forEach((qData, idx) => {
    const id = `quest-field-${fieldObj.tag.toLowerCase()}-${idx}`;
    const price = idx === 0 ? 0.00 : 25.00;
    
    // Distribute across Delhi NCR, Boston, Cambridge, New York, San Francisco
    const citiesData = [
      { address: 'Saket District Centre, New Delhi, Delhi 110017', lat: 28.5284, lon: 77.2185, currency: 'INR' },
      { address: '100 Federal St, Boston, MA 02110', lat: 42.3551, lon: -71.0562, currency: 'USD' },
      { address: 'Infinite Corridor, MIT, Cambridge, MA 02139', lat: 42.3595, lon: -71.0920, currency: 'USD' },
      { address: 'Broadway, New York, NY 10012', lat: 40.7250, lon: -73.9980, currency: 'USD' },
      { address: 'Market St, San Francisco, CA 94103', lat: 37.7749, lon: -122.4194, currency: 'USD' }
    ];
    const loc = citiesData[idx % citiesData.length];

    const startDate = new Date(Date.now() + (5 + idx * 5) * 24 * 60 * 60 * 1000).toISOString();
    const targetEdu = idx === 0 ? 'undergrad' : 'masters';

    mockQuests.push({
      id,
      title: qData.title,
      organizer: qData.organizer,
      status: 'active',
      lifecycle_type: qData.lifecycle_type,
      price,
      currency: loc.currency,
      formatted_address: loc.address,
      latitude: loc.lat,
      longitude: loc.lon,
      tags: [fieldObj.tag, qData.lifecycle_type.charAt(0).toUpperCase() + qData.lifecycle_type.slice(1), 'Career', 'Learning'],
      summary: qData.summary,
      embedding: generateMockVector(`${qData.title} ${qData.organizer} ${fieldObj.field}`),
      start_date: startDate,
      raw_source_url: qData.url,
      target_education: targetEdu
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
      if (lower.includes('internship')) return 'type:internship';
      if (lower.includes('fellowship')) return 'type:fellowship';
      if (lower.includes('conference') || lower.includes('seminar') || lower.includes('panel') || lower.includes('event')) return 'type:event';
      if (lower.includes('hackathon')) return 'type:hackathon';
      if (lower.includes('workshop') || lower.includes('course') || lower.includes('class')) return 'type:workshop';
      
      if (lower.includes('ai') || lower.includes('artificial')) return 'topic:ai';
      if (lower.includes('coding') || lower.includes('programming') || lower.includes('software')) return 'topic:coding';
      if (lower.includes('entrepreneurship') || lower.includes('startup')) return 'topic:startup';
      if (lower.includes('business') || lower.includes('management') || lower.includes('strategy')) return 'topic:business';
      if (lower.includes('finance') || lower.includes('investing')) return 'topic:finance';
      if (lower.includes('data science') || lower.includes('analytics') || lower.includes('stats')) return 'topic:data';
      if (lower.includes('design') || lower.includes('creativity') || lower.includes('ui/ux') || lower.includes('uiux')) return 'topic:design';
      if (lower.includes('media') || lower.includes('content') || lower.includes('video')) return 'topic:media';
      if (lower.includes('marketing') || lower.includes('branding') || lower.includes('growth')) return 'topic:marketing';
      if (lower.includes('policy') || lower.includes('governance')) return 'topic:policy';
      if (lower.includes('law') || lower.includes('justice') || lower.includes('legal')) return 'topic:law';
      if (lower.includes('health') || lower.includes('medicine') || lower.includes('medical') || lower.includes('biotech')) return 'topic:healthcare';
      if (lower.includes('science') || lower.includes('research')) return 'topic:science';
      if (lower.includes('climate') || lower.includes('sustainability') || lower.includes('environment')) return 'topic:sustainability';
      if (lower.includes('space') || lower.includes('aerospace') || lower.includes('astronomy')) return 'topic:space';
      if (lower.includes('cyber') || lower.includes('hacking') || lower.includes('security')) return 'topic:cybersecurity';
      if (lower.includes('gaming') || lower.includes('interactive') || lower.includes('xr') || lower.includes('esports')) return 'topic:gaming';
      if (lower.includes('robotics') || lower.includes('engineering')) return 'topic:robotics';
      if (lower.includes('international') || lower.includes('global') || lower.includes('diplomacy') || lower.includes('relations')) return 'topic:global';
      if (lower.includes('psychology') || lower.includes('behavior') || lower.includes('brain')) return 'topic:psychology';
      return 'topic:' + lower;
    };
    
    const normalizedSelected = selectedInterests.map(normalizeInterest);
    
    const selectedTypes = normalizedSelected.filter(ns => ns.startsWith('type:')).map(ns => ns.replace('type:', ''));
    const selectedTopics = normalizedSelected.filter(ns => ns.startsWith('topic:')).map(ns => ns.replace('topic:', ''));
    
    console.log(`[FEED] Filtering candidates. Selected Types:`, selectedTypes, `| Selected Topics:`, selectedTopics);
    
    candidates = candidates.filter(c => {
      const normalizedQuestTags = c.tags.map((t: string) => t.toLowerCase());
      const cType = c.lifecycle_type.toLowerCase();

      if (selectedTypes.length > 0 && selectedTopics.length > 0) {
        const matchesType = selectedTypes.some(st => cType === st);
        const matchesTopic = selectedTopics.some(st => 
          normalizedQuestTags.some((qt: string) => qt === st)
        );
        return matchesType && matchesTopic;
      }
      
      if (selectedTypes.length > 0) {
        return selectedTypes.some(st => cType === st);
      }

      if (selectedTopics.length > 0) {
        return selectedTopics.some(st => 
          normalizedQuestTags.some((qt: string) => qt === st)
        );
      }

      return true;
    });

    candidates.forEach(c => {
      const normalizedQuestTags = c.tags.map((t: string) => t.toLowerCase());
      const matchCount = normalizedSelected.filter(ns => {
        const cleanNs = ns.replace('type:', '').replace('topic:', '');
        return c.lifecycle_type.toLowerCase() === cleanNs || 
               normalizedQuestTags.some((qt: string) => qt === cleanNs);
      }).length;
      
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

const cronOpportunitiesPool = [
  {
    title: 'Thiel Fellowship for Young Founders',
    organizer: 'Thiel Foundation',
    lifecycle_type: 'fellowship',
    url: 'https://thielfellowship.org/',
    summary: 'A two-year program offering $100,000 to young creators who want to build new things instead of sitting in a classroom.',
    tag: 'Startup',
    field: 'Entrepreneurship'
  },
  {
    title: 'NASA International Internship Program',
    organizer: 'NASA',
    lifecycle_type: 'internship',
    url: 'https://www.nasa.gov/careers/',
    summary: 'A prestigious internship placing international students in NASA research centers to work on space exploration projects.',
    tag: 'Space',
    field: 'Space & Aerospace'
  },
  {
    title: 'WHO Public Health Internship Program',
    organizer: 'World Health Organization',
    lifecycle_type: 'internship',
    url: 'https://www.who.int/careers/internships',
    summary: 'Gain practical experience in global health policy, disease prevention campaigns, and healthcare data compilation.',
    tag: 'Healthcare',
    field: 'Healthcare & Medicine'
  },
  {
    title: 'CERN Summer Student Program',
    organizer: 'CERN',
    lifecycle_type: 'internship',
    url: 'https://careers.cern/summer',
    summary: 'Work on experimental physics, computing, or engineering projects at the Large Hadron Collider in Geneva, Switzerland.',
    tag: 'Science',
    field: 'Science & Research'
  },
  {
    title: 'UNEP Environmental Policy Internship',
    organizer: 'United Nations Environment Programme',
    lifecycle_type: 'internship',
    url: 'https://www.unep.org/',
    summary: 'Support UNEP initiatives on biodiversity conservation, climate adaptation policies, and circular economy research.',
    tag: 'Sustainability',
    field: 'Climate & Sustainability'
  },
  {
    title: 'Epic Games Unreal Fellowship',
    organizer: 'Epic Games',
    lifecycle_type: 'fellowship',
    url: 'https://www.unrealengine.com/',
    summary: 'A 5-week intensive program teaching real-time rendering, virtual production, and game level design using Unreal Engine.',
    tag: 'Gaming',
    field: 'Gaming & Interactive Media'
  },
  {
    title: 'United Nations HQ Internship Program',
    organizer: 'United Nations Secretariat',
    lifecycle_type: 'internship',
    url: 'https://careers.un.org/',
    summary: 'Gain direct insight into multilateral diplomacy, sustainable development goals, and peace operations at the UN.',
    tag: 'Global',
    field: 'International Relations'
  },
  {
    title: 'Ashoka Psychology Department Summer Research',
    organizer: 'Ashoka University',
    lifecycle_type: 'fellowship',
    url: 'https://www.ashoka.edu.in/',
    summary: 'Participate in cognitive science research projects, compiling behavioral data, and analyzing clinical surveys.',
    tag: 'Psychology',
    field: 'Psychology & Human Behavior'
  },
  {
    title: 'Outreachy Open Source Software Internship',
    organizer: 'Software Freedom Conservancy',
    lifecycle_type: 'internship',
    url: 'https://www.outreachy.org/',
    summary: 'A remote internship program promoting diversity in tech by funding candidates to work on open-source projects.',
    tag: 'Coding',
    field: 'Software & Programming'
  },
  {
    title: 'Google APMM Marketing Program',
    organizer: 'Google',
    lifecycle_type: 'internship',
    url: 'https://buildyourfor.google/programs/apmm/',
    summary: 'A rotational program designed to kickstart marketing careers, working on product messaging, brand campaigns, and growth marketing.',
    tag: 'Marketing',
    field: 'Marketing & Branding'
  }
];

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
      console.log('[SEED] Database side_quests table is empty. Seeding 40 actual real-world quests...');
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
      console.log('[SEED] Database successfully seeded with 40 active quests!');
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

setInterval(() => {
  console.log('[CRON] Running 30-minute opportunity update cycle...');

  const nowIso = new Date().toISOString();
  
  const originalCount = mockQuests.length;
  mockQuests = mockQuests.filter(q => new Date(q.start_date).getTime() >= Date.now());
  if (mockQuests.length < originalCount) {
    console.log(`[CRON] Pruned ${originalCount - mockQuests.length} expired quests from in-memory store.`);
  }

  pool.query('DELETE FROM side_quests WHERE start_date < $1;', [nowIso])
    .then(res => {
      if (res.rowCount && res.rowCount > 0) {
        console.log(`[CRON] Pruned ${res.rowCount} expired quests from PostgreSQL.`);
      }
    })
    .catch(err => {
      console.warn('[CRON] Warning: Could not delete expired quests from PostgreSQL (db might be offline):', err.message);
    });

  const randomOpp = cronOpportunitiesPool[Math.floor(Math.random() * cronOpportunitiesPool.length)];
  
  const citiesData = [
    { address: 'Saket District Centre, New Delhi, Delhi 110017', lat: 28.5284, lon: 77.2185, currency: 'INR' },
    { address: '100 Federal St, Boston, MA 02110', lat: 42.3551, lon: -71.0562, currency: 'USD' },
    { address: 'Infinite Corridor, MIT, Cambridge, MA 02139', lat: 42.3595, lon: -71.0920, currency: 'USD' },
    { address: 'Broadway, New York, NY 10012', lat: 40.7250, lon: -73.9980, currency: 'USD' },
    { address: 'Market St, San Francisco, CA 94103', lat: 37.7749, lon: -122.4194, currency: 'USD' }
  ];
  const loc = citiesData[Math.floor(Math.random() * citiesData.length)];

  const newQuestId = `dynamic-quest-${Date.now()}`;
  const startDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  const newQuest = {
    id: newQuestId,
    title: randomOpp.title,
    organizer: randomOpp.organizer,
    status: 'active',
    lifecycle_type: randomOpp.lifecycle_type,
    price: 0.00,
    currency: loc.currency,
    formatted_address: loc.address,
    latitude: loc.lat,
    longitude: loc.lon,
    tags: [randomOpp.tag, randomOpp.lifecycle_type.charAt(0).toUpperCase() + randomOpp.lifecycle_type.slice(1), 'Career', 'Learning'],
    summary: randomOpp.summary,
    embedding: generateMockVector(`${randomOpp.title} ${randomOpp.organizer} ${randomOpp.field}`),
    start_date: startDate,
    raw_source_url: randomOpp.url,
    target_education: 'undergrad'
  };

  mockQuests.push(newQuest);
  console.log(`[CRON] Automatically added new actual opportunity: "${newQuest.title}" to memory store.`);

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
    console.log(`[CRON] Successfully synchronized new actual opportunity "${newQuest.title}" to PostgreSQL.`);
  })
  .catch(err => {
    console.warn('[CRON] Warning: Could not sync new opportunity to PostgreSQL (db might be offline):', err.message);
  });
}, 30 * 60 * 1000);
