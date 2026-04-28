// FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyCewYs-FuTMb-ZuHdy6FcdjyoK1rW8O23Y",
    authDomain: "rendom-chat-2912a.firebaseapp.com",
    projectId: "rendom-chat-2912a",
    storageBucket: "rendom-chat-2912a.firebasestorage.app",
    messagingSenderId: "71875758046",
    appId: "1:71875758046:web:a0e48129821ca15f08ff4f",
    measurementId: "G-BLKR50Z14D"
};

console.log("ChatNova: app.js loading...");

document.addEventListener("DOMContentLoaded", function () {
    console.log("ChatNova: DOM fully loaded");

    // Initialize Firebase
    let db = null;
    let storage = null;
    let auth = null;
    
    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.database();
            storage = firebase.storage();
            auth = firebase.auth();
            console.log("ChatNova: Firebase Auth, DB & Storage initialized");
        }
    } catch (error) {
        console.error("ChatNova: Firebase failed:", error);
    }

    // State Variables
    let numericId = localStorage.getItem('chatnova_numericId');
    let userProfile = null;
    let currentChatId = null;
    let partnerId = null;
    let partnerProfile = null;
    let isSearching = false;
    let isAuthResolving = true; // Block auto-fallback during login

    // DOM Elements
    const screenAuth = document.getElementById('screen-auth');
    const ageOverlay = document.getElementById('age-overlay');
    const blockedScreen = document.getElementById('blocked-screen');
    const appContainer = document.getElementById('app-container');
    const screenGender = document.getElementById('screen-gender');
    const screenSearching = document.getElementById('screen-searching');
    const screenChat = document.getElementById('screen-chat');
    const screenProfile = document.getElementById('screen-profile');
    
    const googleSigninBtn = document.getElementById('google-signin-btn');
    const guestSigninBtn = document.getElementById('guest-signin-btn');

    const profileBtn = document.getElementById('profile-btn');
    const profileBack = document.getElementById('profile-back');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const avatarInput = document.getElementById('avatar-input');
    const profileImgPreview = document.getElementById('profile-img-preview');
    const profileNameInput = document.getElementById('profile-name-input');
    const displayUserId = document.getElementById('display-userid');

    const messagesContainer = document.getElementById('messages-container');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const nextBtn = document.getElementById('next-btn');
    const stopBtn = document.getElementById('stop-btn');
    
    const partnerAvatar = document.getElementById('partner-avatar');
    const partnerName = document.getElementById('partner-name');

    // --- NAVIGATION HELPERS ---

    function showScreen(screenId) {
        const screens = ['screen-auth', 'screen-gender', 'screen-searching', 'screen-chat', 'screen-profile'];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === screenId) {
                el.classList.remove('hidden');
                el.style.display = (id === 'screen-auth') ? 'flex' : 'block';
                el.classList.add('fade-in');
            } else {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        });
    }

    // --- AUTHENTICATION STABILITY LOGIC ---

    // Initial state: Show Auth Screen and WAIT for user or existing session
    showScreen('screen-auth');

    // Listen for Auth State Changes (Handles returning Google users)
    auth.onAuthStateChanged(async (user) => {
        isAuthResolving = false;
        if (user) {
            console.log("ChatNova: Google User detected:", user.displayName);
            await handleUserLogin(user, 'google');
        } else {
            console.log("ChatNova: No active session. Waiting for user choice.");
        }
    });

    googleSigninBtn.addEventListener('click', async () => {
        if (isAuthResolving) return;
        
        console.log("ChatNova: Starting Google Sign-In...");
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            googleSigninBtn.disabled = true;
            googleSigninBtn.innerText = "SIGNING IN...";
            
            // Explicitly await the popup result
            const result = await auth.signInWithPopup(provider);
            console.log("ChatNova: Google Auth Success");
            // handleUserLogin will be triggered by onAuthStateChanged
        } catch (error) {
            console.error("ChatNova: Google Sign-in error", error);
            alert("Google Sign-In failed. Please try again.");
            googleSigninBtn.disabled = false;
            googleSigninBtn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" alt="Google"><span>SIGN IN WITH GOOGLE</span>';
        }
    });

    guestSigninBtn.addEventListener('click', async () => {
        console.log("ChatNova: Continuing as Guest...");
        await handleUserLogin(null, 'guest');
    });

    async function handleUserLogin(fbUser, provider) {
        // Prevent double trigger
        if (userProfile) return;

        if (provider === 'google' && fbUser) {
            // Persistent Google User Mapping
            const snapshot = await db.ref('googleMap/' + fbUser.uid).once('value');
            if (snapshot.exists()) {
                numericId = snapshot.val().toString();
                localStorage.setItem('chatnova_numericId', numericId);
            } else {
                await generateNewNumericId(async (newId) => {
                    await db.ref('googleMap/' + fbUser.uid).set(newId);
                    await db.ref('users/' + newId).set({
                        userId: newId,
                        displayName: fbUser.displayName || "User" + newId,
                        email: fbUser.email,
                        profileImageURL: fbUser.photoURL || "",
                        authProvider: 'google',
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    });
                });
            }
        } else if (provider === 'guest') {
            if (!numericId) {
                await generateNewNumericId(async (newId) => {
                    await db.ref('users/' + newId).set({
                        userId: newId,
                        displayName: "Guest" + newId,
                        authProvider: 'guest',
                        profileImageURL: "",
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    });
                });
            }
        }

        // Proceed to Age Verification only after Auth is resolved
        screenAuth.classList.add('hidden');
        screenAuth.style.display = 'none';
        ageOverlay.classList.remove('hidden');
    }

    async function generateNewNumericId(callback) {
        const result = await db.ref('userCounter').transaction((current) => {
            return (current || 1000) + 1;
        });
        if (result.committed) {
            const newId = result.snapshot.val().toString();
            numericId = newId;
            localStorage.setItem('chatnova_numericId', newId);
            if (callback) await callback(newId);
        }
    }

    // --- PROFILE & CORE FLOW ---

    function loadUserProfile() {
        if (!numericId) return;
        db.ref('users/' + numericId).on('value', (snapshot) => {
            userProfile = snapshot.val();
            if (userProfile) {
                displayUserId.innerText = userProfile.userId;
                profileNameInput.value = userProfile.displayName;
                if (userProfile.profileImageURL) {
                    profileImgPreview.src = userProfile.profileImageURL;
                }
            }
        });
    }

    document.getElementById('age-yes').addEventListener('click', () => {
        ageOverlay.classList.add('fade-out');
        setTimeout(() => {
            ageOverlay.classList.add('hidden');
            appContainer.classList.remove('hidden');
            loadUserProfile();
            showScreen('screen-gender');
        }, 500);
    });

    document.getElementById('age-no').addEventListener('click', () => {
        ageOverlay.classList.add('hidden');
        blockedScreen.classList.remove('hidden');
    });

    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const gender = btn.getAttribute('data-gender');
            if (userProfile) {
                db.ref('users/' + numericId).update({ gender: gender });
            }
            document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setTimeout(() => startMatching(), 400);
        });
    });

    profileBtn.addEventListener('click', () => {
        showScreen('screen-profile');
    });

    profileBack.addEventListener('click', () => {
        if (currentChatId) showScreen('screen-chat');
        else if (isSearching) showScreen('screen-searching');
        else showScreen('screen-gender');
    });

    saveProfileBtn.addEventListener('click', async () => {
        if (!numericId) return;
        const newName = profileNameInput.value.trim();
        if (newName) {
            await db.ref('users/' + numericId).update({ displayName: newName });
            alert("Profile updated!");
        }
    });

    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !numericId) return;

        const storageRef = storage.ref(`avatars/${numericId}`);
        const uploadTask = storageRef.put(file);

        uploadTask.on('state_changed',
            null,
            (error) => console.error("Upload failed:", error),
            async () => {
                const url = await uploadTask.snapshot.ref.getDownloadURL();
                await db.ref('users/' + numericId).update({ profileImageURL: url });
                console.log("Avatar updated:", url);
            }
        );
    });

    // --- MATCHING & CHAT SYSTEM ---

    function startMatching() {
        if (isSearching) return;
        if (!db || !numericId || !userProfile) return;

        isSearching = true;
        showScreen('screen-searching');

        const waitingRef = db.ref('waitingUsers/' + numericId);
        waitingRef.set({
            gender: userProfile.gender || 'unknown',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        waitingRef.onDisconnect().remove();

        db.ref('activeChats').on('child_added', async (snapshot) => {
            const chat = snapshot.val();
            if (chat.u1 === numericId || chat.u2 === numericId) {
                const pId = (chat.u1 === numericId) ? chat.u2 : chat.u1;
                await joinChat(snapshot.key, pId);
            }
        });

        db.ref('waitingUsers').on('child_added', (snapshot) => {
            if (!isSearching) return;
            const pId = snapshot.key;
            if (pId !== numericId && numericId < pId) {
                tryMatch(pId);
            }
        });
    }

    function tryMatch(targetPartnerId) {
        db.ref('waitingUsers/' + targetPartnerId).transaction((currentData) => {
            if (currentData) return null;
            return undefined;
        }, (error, committed) => {
            if (committed) {
                const newChatId = db.ref('activeChats').push().key;
                db.ref('activeChats/' + newChatId).set({
                    u1: numericId,
                    u2: targetPartnerId,
                    status: 'active',
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });
                db.ref('waitingUsers/' + numericId).remove();
            }
        });
    }

    async function joinChat(chatId, pId) {
        if (currentChatId) return;

        db.ref('users/' + pId).on('value', (pSnap) => {
            partnerProfile = pSnap.val();
            if (partnerProfile && currentChatId === chatId) {
                partnerName.innerText = partnerProfile.displayName;
                partnerAvatar.src = partnerProfile.profileImageURL || "https://via.placeholder.com/40";
            }
        });

        partnerId = pId;
        currentChatId = chatId;
        isSearching = false;

        db.ref('waitingUsers').off('child_added');
        showScreen('screen-chat');
        messagesContainer.innerHTML = '<div class="system-msg">Connected!</div>';

        db.ref('activeChats/' + chatId).onDisconnect().remove();
        db.ref('activeChats/' + chatId).on('value', (snapshot) => {
            if (!snapshot.exists() && currentChatId) handlePartnerLeft();
        });

        db.ref('messages/' + chatId).on('child_added', (snapshot) => {
            const msg = snapshot.val();
            displayMessage(msg);
        });
    }

    let isSendingMessage = false;

    async function sendMessage() {
        if (isSendingMessage) return;
        const text = chatInput.value.trim();
        if (!text || !currentChatId) return;

        try {
            isSendingMessage = true;
            sendBtn.disabled = true;
            await db.ref('messages/' + currentChatId).push({
                senderId: numericId,
                text: text,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            chatInput.value = '';
        } finally {
            setTimeout(() => {
                isSendingMessage = false;
                sendBtn.disabled = false;
                chatInput.focus();
            }, 300);
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    function displayMessage(msg) {
        const isMe = msg.senderId === numericId;
        const sender = isMe ? userProfile : partnerProfile;
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isMe ? 'sent' : 'received'}`;
        const avatar = document.createElement('img');
        avatar.className = 'msg-avatar';
        avatar.src = (sender && sender.profileImageURL) ? sender.profileImageURL : "https://via.placeholder.com/32";
        const content = document.createElement('div');
        content.className = 'message-content';
        const name = document.createElement('span');
        name.className = 'sender-name';
        name.innerText = sender ? sender.displayName : "Unknown";
        const text = document.createElement('div');
        text.className = `message msg-${isMe ? 'sent' : 'received'}`;
        text.innerText = msg.text;
        content.appendChild(name);
        content.appendChild(text);
        wrapper.appendChild(avatar);
        wrapper.appendChild(content);
        messagesContainer.appendChild(wrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function handlePartnerLeft() {
        const div = document.createElement('div');
        div.className = 'system-msg';
        div.innerText = "Partner disconnected.";
        messagesContainer.appendChild(div);
        setTimeout(() => {
            if (!currentChatId) return;
            cleanupChat();
            startMatching();
        }, 2000);
    }

    nextBtn.addEventListener('click', () => {
        cleanupChat();
        startMatching();
    });

    stopBtn.addEventListener('click', () => {
        cleanupChat();
        showScreen('screen-gender');
    });

    function cleanupChat() {
        if (currentChatId) {
            db.ref('activeChats/' + currentChatId).off();
            db.ref('messages/' + currentChatId).off();
            db.ref('users/' + partnerId).off();
            db.ref('activeChats/' + currentChatId).remove();
        }
        db.ref('waitingUsers/' + numericId).remove();
        currentChatId = null;
        partnerId = null;
        partnerProfile = null;
        isSearching = false;
    }
});
