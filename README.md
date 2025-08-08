# 🏏 CricHeroes - Cricket Scoring & Tournament Management

A comprehensive cricket management app built with React, TailwindCSS, and Supabase for organizing matches, tournaments, and tracking player statistics.

## 🚀 Features

### ✅ **Authentication & Players**
- User authentication with Supabase Auth
- Player profiles with batting/bowling styles
- Player statistics tracking

### 🔧 **Planned Features**
- **Teams Management**: Create/join teams, manage players, team statistics
- **Match Scheduling**: Create matches, select teams, live scoring
- **Tournament System**: Multi-team tournaments with league/knockout formats
- **Live Scoring**: Ball-by-ball scoring, real-time scorecards
- **Analytics**: Player rankings, team performance, match insights
- **Mobile PWA**: Offline support and app-like experience

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS with shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State Management**: TanStack Query
- **Routing**: React Router DOM

## 📊 Database Schema

### Core Tables
- `profiles` - Player information and stats
- `teams` - Team details and management
- `matches` - Match scheduling and results
- `tournaments` - Tournament organization
- `match_scores` - Ball-by-ball scoring data

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cricheroes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:8080`

## 🏗️ Development Roadmap

### Phase 1: Setup & Auth ✅
- [x] Project setup with Vite + React + TailwindCSS
- [x] Supabase integration and configuration
- [x] User authentication (login/signup)
- [x] Player profiles database schema

### Phase 2: Player Module (In Progress)
- [ ] Player profile UI
- [ ] Profile editing and image upload
- [ ] Player statistics display

### Phase 3: Team Module
- [ ] Create and join teams
- [ ] Team management interface
- [ ] Captain permissions and player roles

### Phase 4: Match System
- [ ] Match scheduling interface
- [ ] Team selection for matches
- [ ] Match details and configuration

### Phase 5: Live Scoring
- [ ] Playing XI selection
- [ ] Ball-by-ball scoring interface
- [ ] Real-time scorecard generation

### Phase 6: Tournaments
- [ ] Tournament creation and management
- [ ] Multi-team participation
- [ ] Points table and knockout handling

### Phase 7: Analytics & Insights
- [ ] Player and team leaderboards
- [ ] Performance analytics
- [ ] Match history and insights

## 🎯 Key Features

### 🏏 **Cricket-Specific**
- Support for T10, T20, and ODI formats
- Professional scoring system with extras
- Toss management and team selection
- Comprehensive player statistics

### 📱 **User Experience**
- Responsive design for mobile and desktop
- Dark/light mode support
- Fast and intuitive interface
- Real-time updates

### 🔒 **Security**
- Row Level Security (RLS) policies
- Secure user authentication
- Data privacy and protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🌟 Support

If you find this project helpful, please give it a star! ⭐

---

**Built with ❤️ for cricket enthusiasts**