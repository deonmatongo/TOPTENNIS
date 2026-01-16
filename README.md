# TOP TENNIS

A comprehensive tennis league management and player matching platform.

## About

TOP TENNIS is a modern web application designed to help tennis players connect, schedule matches, manage leagues, and track their performance. Built with a focus on user experience and real-time interactions.

## Features

- **Player Profiles & Ladder System**: Track your stats, rankings, and match history
- **Court Booking & Availability**: Manage your schedule and find available time slots
- **Match Scheduling**: Send and receive match invitations with real-time notifications
- **League Management**: Join leagues, view standings, and track tournament progress
- **Player Matching**: AI-powered opponent recommendations based on skill level and preferences
- **Weather Integration**: Check court conditions before your match
- **Admin Dashboard**: Comprehensive tools for league administrators
- **Messaging System**: Communicate with other players

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time subscriptions)
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v6
- **Date Handling**: date-fns
- **Notifications**: Sonner + Browser Notifications API

## Getting Started

### Prerequisites

- Node.js 18+ and npm (or bun)
- A Supabase account and project

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd TOP_TENNIS

# Install dependencies
npm install

# Set up environment variables
# Copy .env.example to .env and fill in your Supabase credentials
cp .env.example .env

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root directory with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

## Development

```sh
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Page components
├── hooks/           # Custom React hooks
├── contexts/        # React context providers
├── integrations/    # Third-party integrations (Supabase)
├── utils/           # Utility functions
└── types/           # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software.
