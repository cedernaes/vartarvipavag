# 🚂 Journey Tracker

A real-time web application for tracking and visualizing our traveling adventures. Built with React + TypeScript frontend and Node.js + Express backend.

## 👫 About Us

We (Sara and Erasmus) try to go on an Interrail trip each year. We built this  web app because we wanted to play around with different vibe coding tools, and it has been appreciated by our friends and family to follow us on our adventures.

## 🚀 Quick development setup

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd vartarvipavag
   npm run install:all
   ```

2. **Start development**
   ```bash
   npm run dev
   ```

   **Build**
   ```bash
   npm run build
   ```

3. **Open in browser**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

## Deployment

Configure NGINX and Homeassistant as described in [./config/README.md](./config/README.md), and then download the pre-built docker image (or build it yourself) for the server:

```
docker pull ghcr.io/emanuelen5/vartarvipavag-server:main
docker run --rm -p 3001:3001 --volume $(pwd)/data:/data ghcr.io/emanuelen5/vartarvipavag-server:main
```

Then you need to also host the client / front-end somewhere (like through Github pages, as we do).

> [!NOTE]
> You'll need to set the Github repository secret `API_URL` to the URL of your backend if you build yourself for Github pages.

## 🏗️ Architecture

**Frontend (React + TypeScript)**
- Interactive map with React-Leaflet
- Real-time position updates
- Journey statistics and visualization
- Responsive design for mobile

**Backend (Node.js + Express)**
- RESTful API with TypeScript
- SQLite database for position storage
- Security middleware (write access restricted to localhost)

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, React-Leaflet, Vite
- **Backend**: Node.js, Express, SQLite, TypeScript
- **Map**: OpenStreetMap tiles via Leaflet
- **Deployment**: Docker support included

## 📱 Features

- **Real-time Map**: Interactive visualization of the journey
- **Position Classification**: Night stops vs daily positions
- **Journey Stats**: Distance, duration, and position tracking
- **Mobile-Friendly**: Responsive design for on-the-go updates

## 🔐 Security

Read operations (map viewing) are public, write operations (adding positions) are restricted to localhost for Home Assistant integration.

## 📁 Project Structure

```
vartarvipavag/
├── client/          # React frontend
├── server/          # Express backend  
├── config/          # Nginx & deployment configs
└── *.md             # Documentation
```

---

*Happy travels! 🚂✨* 
