# ⚙️ Gadget Aid

**Gadget Aid** is a modern, responsive **service-sharing web application** dedicated to **Electronic Item Repairing Services**. Whether you're a customer looking to get your gadgets fixed or a service provider managing repairs, Gadget Aid delivers a seamless experience with booking, service tracking, and real-time status updates.

🌐 **Live Site**: [https://gadget-aid.web.app](https://gadget-aid.web.app)

---

## 🚀 Key Features

### 🔐 User Authentication

- Email/password registration & login
- 🔗 Google Sign-In integration
- 🔐 JWT-secured private routes

### 🛠️ Service Management

- Add, update & delete services
- Browse all available repair services
- Dashboard for managing user-specific services

### 📅 Booking System

- Book electronic repair services
- Update service status: `Pending → Working → Completed`
- View booked services and service history

### 📱 Responsive Design

- Optimized layout for **mobile**, **tablet**, and **desktop**

### 🔄 Dynamic Navigation

- Conditional navbar based on login state
- Dashboard dropdown for authenticated users
- Custom `404` page with navigation link to homepage

### ✨ User Experience Enhancements

- 🔍 Search functionality
- 🌗 Light/Dark mode toggle
- ⚡ Animated sections using **Framer Motion** or **AOS**

### 🔒 Security & Deployment

- .env variables to protect sensitive credentials
- Deployed without CORS or routing issues

---

## 🛠️ Tech Stack

**Frontend**

- ⚛️ React
- 🧭 React Router
- 🎨 Tailwind CSS, DaisyUI
- 🎞️ Framer Motion / AOS (Animation)

**Backend**

- 🟩 Node.js, Express.js
- 🍃 MongoDB

**Authentication**

- 🔥 Firebase (Email/Password, Google Sign-In)

**Deployment**

- 🔗 Firebase Hosting (client)
- ☁️ [Vercel]

---

## 📁 Folder Structure

```
GADGET-AID-CLIENT/
│
├── node_modules/              # Project dependencies
├── public/                    # Static assets (if applicable)
├── src/                       # Main source code
│   ├── assets/                # Static files like images and SVGs
│   ├── components/            # Reusable UI components
│   │   ├── AboutUs.jsx
│   │   ├── Banner.jsx
│   │   ├── Button.jsx
│   │   ├── FeaturedSection.jsx
│   │   ├── Footer.jsx
│   │   ├── HowItWorks.jsx
│   │   ├── Navbar.jsx
│   │   ├── PopularServices.jsx
│   │   ├── ServiceCard.jsx
│   │   ├── ServiceDetails.jsx
│   │   ├── Services.jsx
│   │   └── ThemeChanger.jsx
│   ├── context/               # React context for global state
│   ├── firebase/              # Firebase config
│   │   └── firebase.config.js
│   ├── hooks/                 # Custom React hooks
│   ├── layout/                # Layout components
│   │   └── MainLayout.jsx
│   ├── pages/                 # Route-based components/pages
│   │   ├── AddService.jsx
│   │   ├── BookedServices.jsx
│   │   ├── Error.jsx
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── ManageService.jsx
│   │   ├── Registration.jsx
│   │   └── ServiceToDo.jsx
│   ├── provider/              # Auth provider and wrappers
│   │   └── AuthProvider.jsx
│   ├── router/                # Route configuration and guards
│   │   ├── PrivateRoutes.jsx
│   │   └── router.jsx
│   ├── App.jsx                # Root component
│   ├── index.css              # Global styles
│   ├── main.jsx               # Application entry point
│
├── .env                       # Environment variables
├── .gitignore                 # Git ignored files
├── eslint.config.js           # ESLint configuration
├── index.html                 # HTML entry file
├── package.json               # Project metadata and scripts
├── package-lock.json          # Exact dependency versions
├── README.md                  # Project documentation
├── tailwind.config.js         # Tailwind CSS configuration
└── vite.config.js             # Vite configuration

```

## 📫 Contact

For questions, suggestions, or collaboration, feel free to connect with me:

📧 Email: `zabirarkam27@gmail.com`
