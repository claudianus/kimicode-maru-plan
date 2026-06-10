import type { Seed } from '../../src/types.js';

export const seedCorpus: Seed[] = [
  {
    goal: 'Build a personal blog with Astro and deploy to Cloudflare Pages',
    constraints: [
      'Use Astro framework',
      'Deploy to Cloudflare Pages',
      'Support RSS feed',
      'Dark mode toggle',
    ],
    nonGoals: ['Comments system', 'Newsletter subscription', 'E-commerce'],
    context: 'A developer wants a fast, static blog with markdown content.',
    maxGenerations: 5,
  },
  {
    goal: 'Create a REST API server in Go with Postgres database',
    constraints: [
      'Use Go 1.22+',
      'Postgres 15+',
      'JWT authentication',
      'OpenAPI documentation',
    ],
    nonGoals: ['GraphQL', 'WebSocket real-time', 'Microservices split'],
    context: 'Small team needs a reliable backend for a SaaS product.',
    maxGenerations: 5,
  },
  {
    goal: 'Develop a CLI tool in Rust for processing CLI arguments and batch file renaming',
    constraints: [
      'Use Rust 1.75+',
      'clap for argument parsing',
      'Cross-platform (macOS, Linux, Windows)',
      'Unit tests coverage >80%',
    ],
    nonGoals: ['GUI interface', 'Network operations', 'Plugin system'],
    context: 'DevOps engineer needs a robust batch renaming utility.',
    maxGenerations: 5,
  },
  {
    goal: 'Build a cross-platform mobile app with React Native and Firebase',
    constraints: [
      'Use React Native 0.73+',
      'Firebase Auth and Firestore',
      'Push notifications',
      'Offline-first data sync',
    ],
    nonGoals: ['Web version', 'Tablet-specific layouts', 'In-app purchases'],
    context: 'Startup building a task management app for field workers.',
    maxGenerations: 5,
  },
  {
    goal: 'Build a Python research project for data pipeline and statistical analysis',
    constraints: [
      'Use Python 3.11+',
      'Pandas and NumPy for data processing',
      'Jupyter notebooks for exploration',
      'Reproducible environment with uv',
    ],
    nonGoals: ['Web dashboard', 'Real-time streaming', 'ML model training'],
    context: 'Academic researcher analyzing survey data from 10k respondents.',
    maxGenerations: 5,
  },
];
