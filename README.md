# ⚡ ChatNova - Real-Time Random Chat Platform

![ChatNova Logo](https://via.placeholder.com/1200x400?text=ChatNova+-+Connect+with+Strangers+Instantly)

**ChatNova** is a modern, high-performance random chat platform designed for real-time interaction. Built with a focus on speed, privacy, and a premium user experience, it allows users to connect with strangers globally in seconds.

---

## ✨ Key Features

- 👤 **Professional Profile System**: Unique sequential IDs (e.g., 1001, 1002) and customizable usernames.
- 🖼️ **Avatar Support**: Integrated Firebase Storage for uploading and displaying user profile pictures.
- 🤝 **Smart Matchmaking**: Deterministic, transaction-based matching logic to ensure 0% race conditions and instant pairing.
- 💬 **Rich Chat UI**: Real-time message synchronization with sender avatars and display names.
- 🛡️ **Age Verification**: Mandatory safety check with a smooth, animated flow.
- 🎨 **Premium Aesthetics**: Dark-mode glassmorphic design, smooth CSS transitions, and mobile-responsive layout.
- 🧹 **Auto-Cleanup**: Real-time presence detection to clean up inactive sessions and waiting lists.

---

## 🚀 Tech Stack

- **Frontend**: HTML5, Vanilla CSS3, Javascript (ES6+)
- **Backend**: Firebase Realtime Database
- **Storage**: Firebase Storage
- **Icons**: [Lucide Icons](https://lucide.dev/)
- **Fonts**: [Inter](https://fonts.google.com/specimen/Inter)

---

## 🛠 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/samranmazari/chatnova.git
   ```

2. **Configure Firebase**:
   - Open `app.js`.
   - Replace the `firebaseConfig` object with your own Firebase Project credentials.
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
       databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_PROJECT_ID.appspot.com",
       messagingSenderId: "YOUR_ID",
       appId: "YOUR_APP_ID"
   };
   ```

3. **Enable Firebase Services**:
   - Enable **Realtime Database** (Start in Test Mode).
   - Enable **Firebase Storage** (Start in Test Mode).
   - Initialize `userCounter` to `1000` in your Realtime Database if you want IDs to start from 1001.

4. **Launch**:
   - Open `index.html` in your browser (use a local server like VS Code Live Server for the best experience).

---

## 🌐 Deployment

This project is ready to be deployed on platforms like **Vercel**, **Netlify**, or **GitHub Pages**.

### Deploy to Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the root directory.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

---

*Made with ❤️ by [Samran Mazari](https://github.com/samranmazari)*
