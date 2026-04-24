# 🚀 FocusTrack

**FocusTrack** is a high-performance productivity dashboard for lifelong learners and deep work practitioners. It fuses a futuristic UI with evidence-based techniques like **Spaced Repetition** and **Focused Work Sessions**.

***

## 🧠 Core Features

- **🎯 Spaced Repetition Tracker**: Master topics systematically via 1-3-7-21 day review cycles. Knowledge retention guaranteed.
- **⏱️ Deep Work Timer**: Precision timer engine for flow state maintenance and session logging.
- **☁️ Real-Time Cloud Sync**: Supabase-powered, instant cross-device synchronization.
- **📱 PWA-Ready**: Native app experience on mobile and desktop.
- **🌌 Cyberpunk Aesthetic**: Sleek dark theme with custom typography (Orbitron \& Rajdhani) for immersive focus.
- **📥 Data Portability**: JSON import/export for seamless data migration.


## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), CSS3 (Custom Tokens/Components)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend-as-a-Service**: [Supabase](https://supabase.com/) (Auth \& Database)
- **Design**: Cyberpunk-inspired UI with CSS variables for effortless theming.


## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Supabase](https://supabase.com/) account and project


### Installation

1. **Clone the repo:**

```
git clone https://github.com/nikey-studio/focustrack.git
cd focustrack
```

2. **Environment setup:**
Create `.env` in root with Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Run development server:**

```
npm run dev
```


## 📂 Project Structure

```
src/
├── auth/          # Authentication widgets & state
├── config/        # Supabase & app configuration
├── design/        # Design tokens, base styles, components
├── services/      # Cloud sync, storage, API logic
├── shared/        # Utilities, navigation, toasts
├── store/         # Global timer & tracker state
├── timer/         # Timer engine & views
└── tracker/       # Spaced repetition & topic management
```


## 🤝 Contributing

Contributions drive open-source excellence. All submissions welcome.

1. Fork the project
2. Create feature branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'feat: Add YourFeature'`)
4. Push branch (`git push origin feature/YourFeature`)
5. Open Pull Request

## 📄 License

**GNU General Public License v3.0**. See `LICENSE` for details.

***

*Built by ⚡ Nikey Studio © 2026*

