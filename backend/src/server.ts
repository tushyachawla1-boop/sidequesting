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
const mockQuests: any[] = [
  // 1. Quantum & Physics (Boston / Cambridge / Delhi)
  {
    id: 'quest-uuid-1',
    title: 'Intro to Quantum Computing',
    organizer: 'MIT Physics Department',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 0.00,
    currency: 'USD',
    formatted_address: '77 Massachusetts Ave, Cambridge, MA 02139',
    latitude: 42.3592,
    longitude: -71.0932,
    tags: ['Quantum', 'Physics', 'Computing'],
    summary: 'A beginner-friendly workshop covering the basics of qubits, quantum superposition, and entanglement gates.',
    embedding: generateMockVector('Intro to Quantum Computing MIT Physics Department'),
    start_date: '2026-08-15T09:00:00Z'
  },
  {
    id: 'quest-uuid-2',
    title: 'Advanced Quantum Algorithms',
    organizer: 'Harvard Physics Lab',
    status: 'active',
    lifecycle_type: 'course',
    price: 99.99,
    currency: 'USD',
    formatted_address: '17 Oxford St, Cambridge, MA 02138',
    latitude: 42.3781,
    longitude: -71.1162,
    tags: ['Quantum', 'Physics', 'Algorithms'],
    summary: 'An advanced deep dive into Shor\'s and Grover\'s algorithms, exploring noise models and error mitigation strategies.',
    embedding: generateMockVector('Advanced Quantum Algorithms Harvard Physics Lab'),
    start_date: '2026-08-20T10:00:00Z'
  },
  {
    id: 'quest-q-3',
    title: 'MIT Quantum Computing Hackathon',
    organizer: 'MIT Quantum Club',
    status: 'active',
    lifecycle_type: 'hackathon',
    price: 0.00,
    currency: 'USD',
    formatted_address: 'Infinite Corridor, MIT, Cambridge, MA 02139',
    latitude: 42.3595,
    longitude: -71.0920,
    tags: ['Quantum', 'Computing', 'Startup'],
    summary: 'Join developers and researchers for a 48-hour build sprint on actual IBM Quantum hardware. Pitch your tech idea.',
    embedding: generateMockVector('MIT Quantum Computing Hackathon MIT Quantum Club'),
    start_date: '2026-08-25T09:00:00Z'
  },
  {
    id: 'quest-q-4',
    title: 'JNU QMAT 2026 Quantum Conference',
    organizer: 'Jawaharlal Nehru University Physical Sciences',
    status: 'active',
    lifecycle_type: 'event',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'JNU Convention Center, New Delhi 110067',
    latitude: 28.5398,
    longitude: 77.1643,
    tags: ['Quantum', 'Computing', 'Physics'],
    summary: 'The 8th Annual Conference on Quantum Condensed Matter (QMAT 2026), bringing together students and researchers to discuss topological materials, quantum devices, and information theory.',
    embedding: generateMockVector('JNU QMAT 2026 Quantum Conference Jawaharlal Nehru University Physical Sciences'),
    start_date: '2026-08-16T10:00:00Z'
  },
  {
    id: 'quest-q-5',
    title: 'APS Physics Research Fellowship',
    organizer: 'American Physical Society India chapter',
    status: 'active',
    lifecycle_type: 'course',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Vasant Kunj, New Delhi, Delhi 110070',
    latitude: 28.5390,
    longitude: 77.1432,
    tags: ['Fellowship', 'Physics', 'Computing'],
    summary: 'A fully funded research fellowship sponsored by APS targeting quantum gravity modeling and high-energy physics computations.',
    embedding: generateMockVector('APS Physics Research Fellowship American Physical Society India chapter'),
    start_date: '2026-08-22T10:00:00Z'
  },

  // 2. AI, Machine Learning, Deep Learning (Boston / NY / Delhi)
  {
    id: 'quest-uuid-3',
    title: 'Machine Learning Bootcamp',
    organizer: 'Tech Academy Boston',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 49.99,
    currency: 'USD',
    formatted_address: '100 Federal St, Boston, MA 02110',
    latitude: 42.3551,
    longitude: -71.0562,
    tags: ['AI', 'MachineLearning', 'Computing'],
    summary: 'An intensive, hands-on weekend workshop covering classical machine learning models, regressions, and classifications.',
    embedding: generateMockVector('Machine Learning Bootcamp Tech Academy Boston'),
    start_date: '2026-08-15T09:00:00Z'
  },
  {
    id: 'quest-uuid-4',
    title: 'Deep Learning Seminar',
    organizer: 'Boston AI Group',
    status: 'active',
    lifecycle_type: 'seminar',
    price: 0.00,
    currency: 'USD',
    formatted_address: '50 Water St, Boston, MA 02109',
    latitude: 42.3582,
    longitude: -71.0545,
    tags: ['AI', 'DeepLearning', 'MachineLearning'],
    summary: 'A technical seminar detailing transformer architectures, attention mechanisms, and optimization heuristics.',
    embedding: generateMockVector('Deep Learning Seminar Boston AI Group'),
    start_date: '2026-08-16T14:00:00Z'
  },
  {
    id: 'quest-ai-3',
    title: 'Boston Deep Learning Paper Review',
    organizer: 'Northeastern AI Lab',
    status: 'active',
    lifecycle_type: 'meetup',
    price: 0.00,
    currency: 'USD',
    formatted_address: '360 Huntington Ave, Boston, MA 02115',
    latitude: 42.3398,
    longitude: -71.0892,
    tags: ['DeepLearning', 'AI', 'Computing'],
    summary: 'Discussing the latest advancements in LLMs and generative vision models. Ideal for grad students and ML engineers.',
    embedding: generateMockVector('Boston Deep Learning Paper Review Northeastern AI Lab'),
    start_date: '2026-08-18T18:30:00Z'
  },
  {
    id: 'quest-ai-4',
    title: 'AI Founders Networking Social',
    organizer: 'NY AI Commons',
    status: 'active',
    lifecycle_type: 'event',
    price: 15.00,
    currency: 'USD',
    formatted_address: 'Broadway, New York, NY 10012',
    latitude: 40.7250,
    longitude: -73.9980,
    tags: ['AI', 'Startup', 'DeepLearning'],
    summary: 'Connect with local startup founders, venture capitalists, and engineers building the next wave of generative AI tools.',
    embedding: generateMockVector('AI Founders Networking Social NY AI Commons'),
    start_date: '2026-08-25T19:00:00Z'
  },
  {
    id: 'quest-ai-5',
    title: 'ICQCAI Delhi 2026 AI Conference',
    organizer: 'ICQCAI Organizing Committee',
    status: 'active',
    lifecycle_type: 'event',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Jawaharlal Nehru University, New Delhi 110067',
    latitude: 28.5398,
    longitude: 77.1643,
    tags: ['MachineLearning', 'AI', 'Computing'],
    summary: 'The International Conference on Quantum Computing and Artificial Intelligence (ICQCAI-26), gathering global researchers, academics, and students to discuss quantum and AI innovations.',
    embedding: generateMockVector('ICQCAI Delhi 2026 AI Conference ICQCAI Organizing Committee'),
    start_date: '2026-08-29T09:00:00Z'
  },
  {
    id: 'quest-ai-6',
    title: 'IIT Delhi SCAI Deep Learning Seminar',
    organizer: 'Yardi School of Artificial Intelligence, IIT Delhi',
    status: 'active',
    lifecycle_type: 'event',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Hauz Khas, New Delhi, Delhi 110016',
    latitude: 28.5450,
    longitude: 77.1930,
    tags: ['DeepLearning', 'MachineLearning', 'AI'],
    summary: 'A weekly research seminar featuring presentations from Yardi School of AI faculty and visiting scholars on machine learning models.',
    embedding: generateMockVector('IIT Delhi SCAI Deep Learning Seminar Yardi School of Artificial Intelligence, IIT Delhi'),
    start_date: '2026-08-22T09:00:00Z'
  },
  {
    id: 'quest-ai-7',
    title: 'AI for Social Good Hackathon',
    organizer: 'Delhi Social Tech Alliance',
    status: 'active',
    lifecycle_type: 'hackathon',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Okhla Phase III, New Delhi, Delhi 110020',
    latitude: 28.5350,
    longitude: 77.2720,
    tags: ['AI', 'Volunteership', 'Computing'],
    summary: 'Build intelligent applications to solve real-world urban and environmental issues. Collaborative volunteering event.',
    embedding: generateMockVector('AI for Social Good Hackathon Delhi Social Tech Alliance'),
    start_date: '2026-08-20T09:00:00Z'
  },

  // 3. Web3 & Blockchain (Boston / Delhi / Gurugram)
  {
    id: 'quest-uuid-5',
    title: 'Blockchain & Smart Contracts',
    organizer: 'MIT Cryptography Club',
    status: 'active',
    lifecycle_type: 'course',
    price: 150.00,
    currency: 'USD',
    formatted_address: '32 Vassar St, Cambridge, MA 02139',
    latitude: 42.3618,
    longitude: -71.0906,
    tags: ['Blockchain', 'Web3', 'Finance'],
    summary: 'A deep semester course on consensus algorithms, cryptoeconomics, and writing secure solidity smart contracts.',
    embedding: generateMockVector('Blockchain & Smart Contracts MIT Cryptography Club'),
    start_date: '2026-08-22T13:00:00Z'
  },
  {
    id: 'quest-b-2',
    title: 'Boston Ethereum Devs Workshop',
    organizer: 'Boston Ethereum Society',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 0.00,
    currency: 'USD',
    formatted_address: 'Back Bay, Boston, MA 02116',
    latitude: 42.3503,
    longitude: -71.0780,
    tags: ['Blockchain', 'Web3', 'Computing'],
    summary: 'Learn how to deploy decentralized applications (dApps) using ethers.js and modern developer tooling kits.',
    embedding: generateMockVector('Boston Ethereum Devs Workshop Boston Ethereum Society'),
    start_date: '2026-08-17T18:00:00Z'
  },
  {
    id: 'quest-b-3',
    title: 'Delhi Web3 Builders Club',
    organizer: 'Delhi Crypto Alliance',
    status: 'active',
    lifecycle_type: 'meetup',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Saket District Centre, New Delhi, Delhi 110017',
    latitude: 28.5284,
    longitude: 77.2185,
    tags: ['Web3', 'Blockchain', 'Startup'],
    summary: 'Connect with local blockchain engineers, tokenomics experts, and startups to discuss zero-knowledge tech.',
    embedding: generateMockVector('Delhi Web3 Builders Club Delhi Crypto Alliance'),
    start_date: '2026-08-26T18:30:00Z'
  },
  {
    id: 'quest-b-4',
    title: 'IACR Cryptography Research Program',
    organizer: 'International Association for Cryptologic Research India',
    status: 'active',
    lifecycle_type: 'course',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Sector 45, Gurugram, Haryana 122003',
    latitude: 28.4520,
    longitude: 77.0620,
    tags: ['Fellowship', 'Blockchain', 'Web3'],
    summary: 'A prestigious cryptography fellowship exploring advanced signature schemes, zero-knowledge proofs, and zk-SNARK integrations.',
    embedding: generateMockVector('IACR Cryptography Research Program International Association for Cryptologic Research India'),
    start_date: '2026-08-19T10:00:00Z'
  },
  {
    id: 'quest-b-5',
    title: 'KNMA Digital & Modern Art Exhibition',
    organizer: 'Kiran Nadar Museum of Art',
    status: 'active',
    lifecycle_type: 'event',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Kiran Nadar Museum of Art, Saket, New Delhi 110017',
    latitude: 28.5284,
    longitude: 77.2185,
    tags: ['Arts', 'Design', 'Creative'],
    summary: 'Explore current digital art showcases, interactive installations, and modern Indian canvas displays at the Kiran Nadar Museum of Art in Saket.',
    embedding: generateMockVector('KNMA Digital & Modern Art Exhibition Kiran Nadar Museum of Art'),
    start_date: '2026-08-15T11:00:00Z'
  },

  // 4. Design & UI/UX (Boston / Delhi / Noida)
  {
    id: 'quest-uuid-6',
    title: 'UI/UX Design Masterclass',
    organizer: 'Creative Hub Boston',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 75.00,
    currency: 'USD',
    formatted_address: '500 Boylston St, Boston, MA 02116',
    latitude: 42.3501,
    longitude: -71.0762,
    tags: ['Design', 'UIUX', 'Creative'],
    summary: 'A premium workshop focusing on modern design principles, typography, grid layouts, and user research frameworks.',
    embedding: generateMockVector('UI/UX Design Masterclass Creative Hub Boston'),
    start_date: '2026-08-18T10:00:00Z'
  },
  {
    id: 'quest-d-2',
    title: 'Boston UI/UX Design Critique Night',
    organizer: 'Boston Design Collective',
    status: 'active',
    lifecycle_type: 'meetup',
    price: 0.00,
    currency: 'USD',
    formatted_address: 'South End, Boston, MA 02118',
    latitude: 42.3415,
    longitude: -71.0720,
    tags: ['Design', 'UIUX', 'Creative'],
    summary: 'Bring your Figma files and get constructive feedback from senior product designers. Networking and drinks provided.',
    embedding: generateMockVector('Boston UI/UX Design Critique Night Boston Design Collective'),
    start_date: '2026-08-21T19:00:00Z'
  },
  {
    id: 'quest-d-3',
    title: 'NID Creative Interface Design Seminar',
    organizer: 'National Institute of Design',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Green Park, New Delhi, Delhi 110016',
    latitude: 28.5580,
    longitude: 77.2060,
    tags: ['Design', 'UIUX', 'Arts'],
    summary: 'A design seminar hosted by NID covering human-centered design principles, typography, vector arts, and interactive design paradigms.',
    embedding: generateMockVector('NID Creative Interface Design Seminar National Institute of Design'),
    start_date: '2026-08-24T10:00:00Z'
  },
  {
    id: 'quest-d-4',
    title: 'Humanities & Design Workshop',
    organizer: 'National Institute of Design Delhi',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Lodhi Estate, New Delhi, Delhi 110003',
    latitude: 28.5900,
    longitude: 77.2240,
    tags: ['Humanities', 'Design', 'Arts'],
    summary: 'Explore how historical narratives and cultural studies shape interface decisions and user experience globally.',
    embedding: generateMockVector('Humanities & Design Workshop National Institute of Design Delhi'),
    start_date: '2026-08-16T14:30:00Z'
  },
  {
    id: 'quest-d-5',
    title: 'Noida Mobile UI UX Masterclass',
    organizer: 'Noida Tech Society',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 10.00,
    currency: 'USD',
    formatted_address: 'Sector 15, Noida, Uttar Pradesh 201301',
    latitude: 28.5780,
    longitude: 77.3120,
    tags: ['UIUX', 'Mobile', 'Design'],
    summary: 'Learn practical mobile-first design workflows, covering auto-layout grids, interactive components, and gestures.',
    embedding: generateMockVector('Noida Mobile UI UX Masterclass Noida Tech Society'),
    start_date: '2026-08-17T09:30:00Z'
  },

  // 6. Startup (Boston / Delhi)
  {
    id: 'quest-uuid-8',
    title: 'Startup Pitch Night',
    organizer: 'Boston Venture Club',
    status: 'active',
    lifecycle_type: 'event',
    price: 10.00,
    currency: 'USD',
    formatted_address: '1 Marina Park Drive, Boston, MA 02210',
    latitude: 42.3524,
    longitude: -71.0423,
    tags: ['Startup', 'Business', 'Finance'],
    summary: 'Watch local tech startups pitch their MVPs to active angel investors. Ideal for founders and aspiring recruits.',
    embedding: generateMockVector('Startup Pitch Night Boston Venture Club'),
    start_date: '2026-08-20T18:30:00Z'
  },
  {
    id: 'quest-s-2',
    title: 'Boston BioTech Startup Summit',
    organizer: 'Kendall Square Ventures',
    status: 'active',
    lifecycle_type: 'event',
    price: 40.00,
    currency: 'USD',
    formatted_address: 'Kendall Square, Cambridge, MA 02142',
    latitude: 42.3626,
    longitude: -71.0863,
    tags: ['Startup', 'Computing', 'Business'],
    summary: 'Discussing the convergence of AI, diagnostics, and biotech therapeutics with leading researchers and VCs.',
    embedding: generateMockVector('Boston BioTech Startup Summit Kendall Square Ventures'),
    start_date: '2026-08-26T14:00:00Z'
  },
  {
    id: 'quest-s-3',
    title: 'Startup India Learning Program',
    organizer: 'Startup India Hub',
    status: 'active',
    lifecycle_type: 'event',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Nehru Place, New Delhi, Delhi 110019',
    latitude: 28.5494,
    longitude: 77.2520,
    tags: ['Startup', 'Computing', 'Business'],
    summary: 'A free online and offline learning program by Startup India Hub to help entrepreneurs get structured lessons on key business concepts.',
    embedding: generateMockVector('Startup India Learning Program Startup India Hub'),
    start_date: '2026-08-28T17:00:00Z'
  },
  {
    id: 'quest-s-4',
    title: 'Villgro Social Enterprise Accelerator',
    organizer: 'Villgro Innovations Foundation',
    status: 'active',
    lifecycle_type: 'course',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Chanakyapuri, New Delhi, Delhi 110021',
    latitude: 28.5900,
    longitude: 77.2150,
    tags: ['Startup', 'Volunteership', 'Humanities'],
    summary: 'An incubation and acceleration program for early-stage social enterprises, providing financial grant support, seed funding, and corporate mentoring.',
    embedding: generateMockVector('Villgro Social Enterprise Accelerator Villgro Innovations Foundation'),
    start_date: '2026-08-21T09:00:00Z'
  },

  // 7. Photography & Outdoors (Boston / Delhi / Noida)
  {
    id: 'quest-uuid-9',
    title: 'Outdoor Photography Hike',
    organizer: 'Boston Adventure Association',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 25.00,
    currency: 'USD',
    formatted_address: 'Blue Hills Trailside Museum, Milton, MA 02186',
    latitude: 42.2212,
    longitude: -71.1034,
    tags: ['Photography', 'Outdoors', 'Adventure'],
    summary: 'A guided hiking tour through nature reserves. Master landscape composition and light control techniques.',
    embedding: generateMockVector('Outdoor Photography Hike Boston Adventure Association'),
    start_date: '2026-08-16T08:00:00Z'
  },
  {
    id: 'quest-uuid-10',
    title: 'Sailing Basics on the Charles',
    organizer: 'Community Boating Boston',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 35.00,
    currency: 'USD',
    formatted_address: '21 David G Mugar Way, Boston, MA 02114',
    latitude: 42.3611,
    longitude: -71.0712,
    tags: ['Sailing', 'Sports', 'Outdoors'],
    summary: 'Learn essential sailing knots, wind navigation, and safety drills on the Charles River basin. Beginner welcome.',
    embedding: generateMockVector('Sailing Basics on the Charles Community Boating Boston'),
    start_date: '2026-08-15T10:00:00Z'
  },
  {
    id: 'quest-o-3',
    title: 'Boston Skyline Photography Walk',
    organizer: 'Boston Camera Club',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 15.00,
    currency: 'USD',
    formatted_address: 'Esplanade, Boston, MA 02116',
    latitude: 42.3520,
    longitude: -71.0790,
    tags: ['Photography', 'Outdoors', 'Arts'],
    summary: 'Capture the historic Boston skyline at sunset. Discuss exposure adjustments and long-exposure mechanics.',
    embedding: generateMockVector('Boston Skyline Photography Walk Boston Camera Club'),
    start_date: '2026-08-15T17:00:00Z'
  },
  {
    id: 'quest-o-4',
    title: 'WWF India Ridge Forest Conservation Walk',
    organizer: 'World Wide Fund for Nature India',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Sardar Patel Marg, Delhi Ridge, New Delhi 110021',
    latitude: 28.6012,
    longitude: 77.1685,
    tags: ['Outdoors', 'Volunteership', 'Photography'],
    summary: 'Document indigenous plants and local birdlife under expert guidance of WWF India, while supporting local environmental awareness campaigns.',
    embedding: generateMockVector('WWF India Ridge Forest Conservation Walk World Wide Fund for Nature India'),
    start_date: '2026-08-15T07:30:00Z'
  },
  {
    id: 'quest-o-5',
    title: 'Delhi Photography Club Outdoor Walk',
    organizer: 'Delhi Photography Club',
    status: 'active',
    lifecycle_type: 'meetup',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Okhla Bird Sanctuary, Noida, Uttar Pradesh 201301',
    latitude: 28.5680,
    longitude: 77.3020,
    tags: ['Photography', 'Arts', 'Outdoors'],
    summary: 'An outdoor light-control workshop focusing on landscape framing, soft shadows, and capturing portraits in natural forest light.',
    embedding: generateMockVector('Delhi Photography Club Outdoor Walk Delhi Photography Club'),
    start_date: '2026-08-23T08:00:00Z'
  },
  {
    id: 'quest-o-6',
    title: 'Himalayan Trek Preparation Walk',
    organizer: 'Delhi Trekking Club',
    status: 'active',
    lifecycle_type: 'meetup',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Sanjay Van, New Delhi, Delhi 110070',
    latitude: 28.5290,
    longitude: 77.1710,
    tags: ['Outdoors', 'Sports', 'Adventure'],
    summary: 'Join outdoor enthusiasts for a conditioning trek. Get gear advice and share physical fitness tips.',
    embedding: generateMockVector('Himalayan Trek Preparation Walk Delhi Trekking Club'),
    start_date: '2026-08-15T06:00:00Z'
  },

  // 8. Volunteership, Fellowship, Humanities Core (Delhi NCR)
  {
    id: 'quest-delhi-1',
    title: 'Delhi Heritage Restoration Volunteering',
    organizer: 'Delhi Heritage Trust',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Chandni Chowk, Old Delhi, Delhi 110006',
    latitude: 28.6562,
    longitude: 77.2309,
    tags: ['Volunteership', 'Humanities', 'Heritage'],
    summary: 'Collaborative volunteering project to record, document, and conserve structures in historic Old Delhi.',
    embedding: generateMockVector('Delhi Heritage Restoration Volunteering Delhi Heritage Trust'),
    start_date: '2026-08-15T09:00:00Z'
  },
  {
    id: 'quest-delhi-2',
    title: 'Fellowship in Public Policy & Social Sciences',
    organizer: 'Center for Policy Research',
    status: 'active',
    lifecycle_type: 'course',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Dharma Marg, Chanakyapuri, New Delhi 110021',
    latitude: 28.5925,
    longitude: 77.2100,
    tags: ['Fellowship', 'Humanities', 'Policy'],
    summary: 'A prestigious, research-intensive fellowship targeting local policy models, urban dynamics, and social studies.',
    embedding: generateMockVector('Fellowship in Public Policy & Social Sciences Center for Policy Research'),
    start_date: '2026-08-20T10:00:00Z'
  },
  {
    id: 'quest-delhi-3',
    title: 'Youth Environmental Volunteership Drive',
    organizer: 'Green India Alliance',
    status: 'active',
    lifecycle_type: 'workshop',
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Sector 62, Noida, Uttar Pradesh 201301',
    latitude: 28.5700,
    longitude: 77.3200,
    tags: ['Volunteership', 'Outdoors', 'Environment'],
    summary: 'Volunteering drive focused on urban tree planting and waste cleanup campaigns in parks across Noida.',
    embedding: generateMockVector('Youth Environmental Volunteership Drive Green India Alliance'),
    start_date: '2026-08-15T09:00:00Z'
  },
  {
    id: 'quest-delhi-4',
    title: 'International Humanities Fellowship Forum',
    organizer: 'India International Centre',
    status: 'active',
    lifecycle_type: 'event',
    price: 20.00,
    currency: 'USD',
    formatted_address: '40 Max Mueller Marg, Lodhi Road, New Delhi 110003',
    latitude: 28.5880,
    longitude: 77.2220,
    tags: ['Fellowship', 'Humanities', 'Arts'],
    summary: 'A global meeting of researchers presenting monographs and findings in history, literature, and visual arts.',
    embedding: generateMockVector('International Humanities Fellowship Forum India International Centre'),
    start_date: '2026-08-18T18:00:00Z'
  }
];

const realUrlMap: Record<string, string> = {
  // Quantum
  'Intro to Quantum Computing': 'https://cqe.mit.edu/',
  'Advanced Quantum Algorithms': 'https://quantum.harvard.edu/',
  'MIT Quantum Computing Hackathon': 'https://devpost.com/hackathons',
  'JNU QMAT 2026 Quantum Conference': 'https://www.jnu.ac.in/sps',
  'APS Physics Research Fellowship': 'https://www.aps.org/programs/honors/fellowships/',
  
  // AI / ML
  'Machine Learning Bootcamp': 'https://professional.mit.edu/course-catalog/machine-learning-for-big-data-and-text-processing',
  'Deep Learning Seminar': 'https://www.csail.mit.edu/news/deep-learning-seminar-series',
  'Boston Deep Learning Paper Review': 'https://deeplearning.mit.edu/#register',
  'AI Founders Networking Social': 'https://innovationlabs.harvard.edu/venture-program/',
  'ICQCAI Delhi 2026 AI Conference': 'https://www.conferencesinindia.net/',
  'IIT Delhi SCAI Deep Learning Seminar': 'https://scai.iitd.ac.in/seminars.php',
  'AI for Social Good Hackathon': 'https://devfolio.co/hackathons',

  // Web3 / Blockchain
  'Blockchain & Smart Contracts': 'https://docs.soliditylang.org/',
  'Boston Ethereum Devs Workshop': 'https://ethereum.org/en/developers/',
  'Delhi Web3 Builders Club': 'https://devfolio.co/hackathons',
  'IACR Cryptography Research Program': 'https://www.iacr.org/schools/',
  'KNMA Digital & Modern Art Exhibition': 'https://www.knma.in/whats-on',

  // Design
  'UI/UX Design Masterclass': 'https://www.figma.com/education/',
  'Boston UI/UX Design Critique Night': 'https://www.gsd.harvard.edu/events/',
  'NID Creative Interface Design Seminar': 'https://www.nid.edu/',
  'Humanities & Design Workshop': 'https://www.ashoka.edu.in/admissions/',
  'Noida Mobile UI UX Masterclass': 'https://www.interaction-design.org/courses',

  // Startup
  'Startup Pitch Night': 'https://masschallenge.org/',
  'Boston BioTech Startup Summit': 'https://www.massbio.org/events/',
  'Startup India Learning Program': 'https://www.startupindia.gov.in/content/sih/en/learning-and-development_v2.html',
  'Villgro Social Enterprise Accelerator': 'https://www.villgro.org/programmes/',

  // Outdoors / Photo
  'Outdoor Photography Hike': 'https://activities.outdoors.org/',
  'Sailing Basics on the Charles': 'https://www.community-boating.org/junior-program/',
  'Boston Skyline Photography Walk': 'https://www.nephotographyclub.com/classes',
  'WWF India Ridge Forest Conservation Walk': 'https://www.wwfindia.org/get_involved/',
  'Delhi Photography Club Outdoor Walk': 'http://www.delhiphotographyclub.com/',
  'Himalayan Trek Preparation Walk': 'https://indiahikes.com/upcoming-treks/',

  // Humanities, Fellowship, Volunteering
  'Delhi Heritage Restoration Volunteering': 'https://www.intach.org',
  'Fellowship in Public Policy & Social Sciences': 'https://prsindia.org/lamp',
  'Youth Environmental Volunteership Drive': 'https://bhumi.ngo/volunteer/',
  'International Humanities Fellowship Forum': 'https://yif.ashoka.edu.in/'
};

// Dynamically seed raw_source_url for mock quests to enable direct applications
mockQuests.forEach((q: any) => {
  q.raw_source_url = realUrlMap[q.title] || 'https://wellfound.com/jobs';
});

// Programmatic 75 internships generator (5 internships per remaining 15 topics)
const categories = [
  'Quantum', 'Physics', 'AI', 'MachineLearning', 'Web3', 'Blockchain', 'Design', 'UIUX', 
  'Startup', 'Photography', 'Outdoors', 'Volunteership', 'Fellowship', 'Humanities', 'Arts'
];

const mockCompanies: Record<string, string[]> = {
  Quantum: ['MIT Research Lab', 'Harvard Quantum Initiative', 'IBM Quantum', 'Rigetti Computing', 'Zapata Computing'],
  Physics: ['CERN Outreach', 'Fermilab', 'MIT Department of Physics', 'IISc Bangalore', 'TIFR Mumbai'],
  AI: ['OpenAI Research', 'Google DeepMind', 'Microsoft Research', 'Anthropic', 'Hugging Face'],
  MachineLearning: ['Scale AI', 'Weights & Biases', 'DataRobot', 'Wipro AI Lab', 'TCS Research'],
  Web3: ['ConsenSys', 'Polygon Labs', 'Solana Foundation', 'Uniswap Labs', 'Chainlink Labs'],
  Blockchain: ['Coinbase Engineering', 'Ripple Labs', 'Offchain Labs', 'Ava Labs', 'StarkWare'],
  Design: ['Figma Design Lab', 'Canva Creative', 'Adobe Design Team', 'Razorpay Design', 'Zomato Design Team'],
  UIUX: ['Studio Dextra', 'GoTo Group', 'Swiggy UX', 'Cred Product Team', 'Dunzo UX Research'],
  Startup: ['Y Combinator Research', 'Antler India', 'Sequoia Spark', 'Matrix Partners', 'Kalaari Capital'],
  Photography: ['National Geographic', 'Canon India Collective', 'Pixabay Creators', 'Getty Images', 'Shutterstock Studios'],
  Outdoors: ['Patagonia Labs', 'REI Co-op Outreach', 'Decathlon Sports India', 'IndiaHikes Guides', 'WWF India'],
  Volunteership: ['Bhumi NGO', 'Goonj Foundation', 'Child Rights and You (CRY)', 'Teach For India', 'Make A Difference'],
  Fellowship: ['Ashoka University', 'Centre for Policy Research', 'Observer Research Foundation', 'LAMP Legislative Research', 'ICRISAT'],
  Humanities: ['ICHR Outreach', 'National Museum New Delhi', 'Lalit Kala Akademi', 'Delhi Heritage Trust', 'Archaeological Survey of India'],
  Arts: ['National Gallery of Modern Art', 'Delhi Art Gallery', 'Kiran Nadar Museum of Art', 'Sanskriti Kendra', 'Triveni Kala Sangam']
};

const organizerUrlMap: Record<string, string> = {
  // Quantum
  'IBM Quantum': 'https://careers.ibm.com/search/searchjobs?q=quantum',
  'Intel Labs': 'https://jobs.intel.com/en/search-jobs/quantum',
  'Rigetti Computing': 'https://rigetti.com/careers',
  'Quantum Circuits': 'https://quantumcircuits.com/careers',
  'IonQ': 'https://ionq.com/careers',

  // Physics
  'CERN Physics': 'https://careers.cern/job-opportunities',
  'Fermilab Physics': 'https://jobs.fnal.gov/',
  'MIT Physics Department': 'https://physics.mit.edu/about/employment-opportunities/',
  'Harvard Physics Labs': 'https://physics.harvard.edu/jobs',
  'NPL India': 'https://www.nplindia.org/',

  // AI
  'OpenAI AI Team': 'https://openai.com/careers/',
  'Anthropic AI': 'https://www.anthropic.com/careers',
  'DeepMind Research': 'https://deepmind.google/about/careers/',
  'Cohere AI': 'https://cohere.com/careers',
  'Mistral AI': 'https://mistral.ai/jobs/',

  // MachineLearning
  'Google DeepMind': 'https://deepmind.google/about/careers/',
  'Meta AI Research': 'https://www.metacareers.com/',
  'Microsoft Research India': 'https://careers.microsoft.com/',
  'Wipro AI Lab': 'https://careers.wipro.com/',
  'TCS Research': 'https://www.tcs.com/careers',

  // DeepLearning
  'Scale AI': 'https://scale.com/careers',
  'Weights & Biases': 'https://wandb.ai/careers',
  'DataRobot': 'https://www.datarobot.com/careers/',
  'Hugging Face': 'https://huggingface.co/join-us',
  'PyTorch Foundation': 'https://pytorch.org/careers',

  // Web3
  'ConsenSys': 'https://consensys.io/careers',
  'Polygon Labs': 'https://polygon.technology/careers',
  'Solana Foundation': 'https://solana.org/grants',
  'Uniswap Labs': 'https://uniswap.org/careers',
  'Chainlink Labs': 'https://chainlinklabs.com/careers',

  // Blockchain
  'Coinbase Engineering': 'https://www.coinbase.com/careers',
  'Ripple Labs': 'https://ripple.com/careers/',
  'Offchain Labs': 'https://offchainlabs.com/careers',
  'Ava Labs': 'https://www.avalabs.org/careers',
  'StarkWare': 'https://starkware.co/careers/',

  // Design
  'Figma Design Lab': 'https://www.figma.com/careers/',
  'Canva Creative': 'https://www.canva.com/careers/',
  'Adobe Design Team': 'https://www.adobe.com/careers.html',
  'Razorpay Design': 'https://razorpay.com/jobs/',
  'Zomato Design Team': 'https://www.zomato.com/careers',

  // UIUX
  'Studio Dextra': 'https://www.interaction-design.org/careers',
  'GoTo Group': 'https://www.gotocompany.com/careers',
  'Swiggy UX': 'https://careers.swiggy.com/',
  'Cred Product Team': 'https://careers.cred.club/',
  'Dunzo UX Research': 'https://www.dunzo.com/careers',

  // Startup
  'Y Combinator Research': 'https://wellfound.com/jobs',
  'Antler India': 'https://www.antler.co/careers',
  'Sequoia Spark': 'https://www.sequoiacap.com/careers/',
  'Matrix Partners': 'https://www.matrixpartners.com/careers',
  'Kalaari Capital': 'https://www.kalaari.com/careers',

  // Photography
  'National Geographic': 'https://www.nationalgeographic.com/careers',
  'Canon India Collective': 'https://edge.canon.co.in/careers',
  'Pixabay Creators': 'https://pixabay.com/service/about/',
  'Getty Images': 'https://www.gettyimages.com/careers',
  'Shutterstock Studios': 'https://www.shutterstock.com/careers',

  // Outdoors
  'Patagonia Labs': 'https://www.patagonia.com/careers/',
  'REI Co-op Outreach': 'https://www.rei.com/jobs',
  'Decathlon Sports India': 'https://decathlon.in/pages/careers',
  'IndiaHikes Guides': 'https://indiahikes.com/careers/',
  'WWF India': 'https://www.wwfindia.org/get_involved/careers/',

  // Volunteership
  'Bhumi NGO': 'https://bhumi.ngo/volunteer/',
  'Goonj Foundation': 'https://goonj.my.site.com/s/contributor',
  'Child Rights and You (CRY)': 'https://www.cry.org/volunteer-with-cry/',
  'Teach For India': 'https://www.teachforindia.org/fellowship',
  'Make A Difference': 'https://makeadifference.in/volunteer',

  // Fellowship
  'Ashoka University': 'https://yif.ashoka.edu.in/',
  'Centre for Policy Research': 'https://cprindia.org/careers/',
  'Observer Research Foundation': 'https://www.orfonline.org/careers/',
  'LAMP Legislative Research': 'https://prsindia.org/lamp',
  'ICRISAT': 'https://www.icrisat.org/careers/',

  // Humanities
  'ICHR Outreach': 'http://ichr.ac.in/recruitment.html',
  'National Museum New Delhi': 'http://www.nationalmuseumindia.gov.in/en/opportunities',
  'Lalit Kala Akademi': 'https://lalitkala.gov.in/',
  'Delhi Heritage Trust': 'https://www.intach.org/',
  'Archaeological Survey of India': 'https://asi.nic.in/',

  // Arts
  'National Gallery of Modern Art': 'http://ngmaindia.gov.in/opportunities.asp',
  'Delhi Art Gallery': 'https://dagworld.com/careers',
  'Kiran Nadar Museum of Art': 'https://www.knma.in/whats-on',
  'Sanskriti Kendra': 'http://www.sanskritifoundation.org/internships.htm',
  'Triveni Kala Sangam': 'https://trivenikalasangam.org/'
};

const realInternshipUrls: Record<string, string> = {
  Quantum: 'https://careers.ibm.com/search/searchjobs?q=quantum',
  Physics: 'https://careers.cern/job-opportunities',
  AI: 'https://openai.com/careers/search/',
  MachineLearning: 'https://deepmind.google/about/careers/',
  Web3: 'https://polygon.technology/careers',
  Blockchain: 'https://www.coinbase.com/careers/positions',
  Design: 'https://www.figma.com/careers/',
  UIUX: 'https://www.interaction-design.org/careers',
  Startup: 'https://wellfound.com/jobs',
  Photography: 'https://www.nationalgeographic.com/careers',
  Outdoors: 'https://www.patagonia.com/careers/',
  Volunteership: 'https://bhumi.ngo/volunteer/',
  Fellowship: 'https://gandhifellowship.org/',
  Humanities: 'https://cprindia.org/careers/',
  Arts: 'https://www.knma.in/careers'
};

const locations = [
  // Delhi NCR locations (3 per category)
  { formatted_address: 'Saket District Centre, New Delhi, Delhi 110017', latitude: 28.5284, longitude: 77.2185, currency: 'INR' },
  { formatted_address: 'DLF Cyber City, Gurugram, Haryana 122002', latitude: 28.4950, longitude: 77.0880, currency: 'INR' },
  { formatted_address: 'Sector 62, Noida, Uttar Pradesh 201301', latitude: 28.6210, longitude: 77.3620, currency: 'INR' },
  // Boston/Cambridge locations (2 per category)
  { formatted_address: 'MIT Kendall Square, Cambridge, MA 02142', latitude: 42.3625, longitude: -71.0865, currency: 'USD' },
  { formatted_address: 'Harvard Square, Cambridge, MA 02138', latitude: 42.3736, longitude: -71.1190, currency: 'USD' }
];

categories.forEach((cat) => {
  const companies = mockCompanies[cat] || ['Global Corp'];
  
  for (let i = 0; i < 5; i++) {
    const loc = locations[i % locations.length];
    const companyName = companies[i % companies.length];
    const realUrl = organizerUrlMap[companyName] || realInternshipUrls[cat] || 'https://wellfound.com/jobs';
    const title = `${companyName} Summer ${cat} Internship`;
    
    mockQuests.push({
      id: `internship-${cat.toLowerCase()}-${i}`,
      title,
      organizer: companyName,
      status: 'active',
      lifecycle_type: 'internship',
      price: 0.00,
      currency: loc.currency,
      formatted_address: loc.formatted_address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      tags: [cat, 'Internship', 'Career', 'Learning'],
      summary: `Apply for this competitive ${cat} internship at ${companyName}. You will collaborate with research teams, develop project codebases, and participate in weekly reviews.`,
      embedding: generateMockVector(`${title} ${companyName}`),
      start_date: new Date(Date.now() + (30 + i * 5) * 24 * 60 * 60 * 1000).toISOString(),
      raw_source_url: realUrl,
      target_education: i % 2 === 0 ? 'undergrad' : 'masters'
    });
  }
});

// Pre-seeded interactions for the test user '019535d9-3df7-79fb-b466-fa907fa17f9e'
// This will simulate heavy positive preferences towards Physics/Quantum (clicks/saves)
// and heavy negative preference towards Blockchain/Design (skips/reads)
const mockInteractions = [
  // Clicks (+10) on Quantum
  { user_id: '019535d9-3df7-79fb-b466-fa907fa17f9e', quest_id: 'quest-uuid-1', interaction_type: 'click' },
  // Save (+3) on Advanced Quantum
  { user_id: '019535d9-3df7-79fb-b466-fa907fa17f9e', quest_id: 'quest-uuid-2', interaction_type: 'save' },
  // Save (+3) on ML Bootcamp
  { user_id: '019535d9-3df7-79fb-b466-fa907fa17f9e', quest_id: 'quest-uuid-3', interaction_type: 'save' },
  // Skip (-2) on Blockchain
  { user_id: '019535d9-3df7-79fb-b466-fa907fa17f9e', quest_id: 'quest-uuid-5', interaction_type: 'skip' },
  // Read (-0.5) on UI/UX Design
  { user_id: '019535d9-3df7-79fb-b466-fa907fa17f9e', quest_id: 'quest-uuid-6', interaction_type: 'read' },
  // Skip (-2) on UI/UX Design
  { user_id: '019535d9-3df7-79fb-b466-fa907fa17f9e', quest_id: 'quest-uuid-6', interaction_type: 'skip' },
  // Clicks (+10) on Delhi Heritage Volunteering
  { user_id: '019535d9-3df7-79fb-b466-fa907fa17f9e', quest_id: 'quest-delhi-1', interaction_type: 'click' },
  // Save (+3) on Policy Fellowship
  { user_id: '019535d9-3df7-79fb-b466-fa907fa17f9e', quest_id: 'quest-delhi-2', interaction_type: 'save' }
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
      if (lower === 'internships') return 'internship';
      if (lower === 'volunteership') return 'volunteer';
      if (lower === 'uiux') return 'ui/ux';
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

app.listen(port, () => {
  console.log(`API Server listening at http://localhost:${port}`);
});

// Background job to automatically add new opportunities (events, fellowships, internships) every 30 minutes
let cronCounter = 0;
setInterval(() => {
  console.log('[CRON] Running 30-minute opportunity update cycle...');
  
  const categories = [
    { type: 'internship', tag: 'Internship', org: 'TCS Research', title: 'TCS Research Dynamic Internship' },
    { type: 'fellowship', tag: 'Fellowship', org: 'Young India Foundation', title: 'YIF Humanities Fellowship' },
    { type: 'event', tag: 'AI', org: 'Delhi AI Labs', title: 'Delhi Generative AI Meetup' },
    { type: 'course', tag: 'Design', org: 'NID Outreach', title: 'NID Digital Design Crash Course' }
  ];
  
  const selected = categories[cronCounter % categories.length];
  cronCounter++;
  
  const newQuestId = `dynamic-quest-${Date.now()}`;
  const title = `${selected.title} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
  
  const newQuest = {
    id: newQuestId,
    title: title,
    organizer: selected.org,
    status: 'active',
    lifecycle_type: selected.type,
    price: 0.00,
    currency: 'INR',
    formatted_address: 'Hauz Khas, New Delhi, Delhi 110016',
    latitude: 28.5450,
    longitude: 77.1930,
    tags: [selected.tag, 'Computing', 'Delhi'],
    summary: `A dynamically loaded ${selected.type} targeting candidates interested in ${selected.tag} programs. Registration is open.`,
    embedding: generateMockVector(title),
    start_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days from now
  };
  
  mockQuests.push(newQuest);
  console.log(`[CRON] Automatically added new opportunity: "${newQuest.title}"`);
}, 30 * 60 * 1000); // 30 minutes in milliseconds
