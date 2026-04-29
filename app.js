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
    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.database();
            storage = firebase.storage();
            console.log("ChatNova: Firebase & Storage initialized");
        }
    } catch (error) {
        console.error("ChatNova: Firebase failed:", error);
    }

    // State Variables
    let numericId = localStorage.getItem('chatnova_userId'); 
    let userProfile = null;
    let currentChatId = null;
    let partnerId = null;
    let partnerProfile = null;
    let isSearching = false;
    let authProvider = "guest";
    let displayedMessageIds = new Set();

    // DOM Elements
    const ageOverlay = document.getElementById('age-overlay');
    const blockedScreen = document.getElementById('blocked-screen');
    const appContainer = document.getElementById('app-container');
    const screenGender = document.getElementById('screen-gender');
    const screenSearching = document.getElementById('screen-searching');
    const screenChat = document.getElementById('screen-chat');
    const screenProfile = document.getElementById('screen-profile');

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

    // --- UI HELPERS ---

    function showScreen(screenId) {
        const screens = ['screen-gender', 'screen-searching', 'screen-chat', 'screen-profile'];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === screenId) {
                el.classList.remove('hidden');
                el.classList.add('fade-in');
            } else {
                el.classList.add('hidden');
                el.classList.remove('fade-in');
            }
        });
    }

    // --- USER PROFILE SYSTEM ---

    async function initializeGuestUser() {
        if (numericId) {
            // Fetch existing profile
            const snapshot = await db.ref('users/' + numericId).once('value');
            if (snapshot.exists()) {
                userProfile = snapshot.val();
                loadProfileToUI();
                return;
            }
        }

        // Generate New Sequential ID
        console.log("ChatNova: Generating new sequential ID...");
        db.ref('userCounter').transaction((current) => {
            return (current || 1000) + 1;
        }, async (error, committed, snapshot) => {
            if (committed) {
                numericId = snapshot.val().toString();
                localStorage.setItem('chatnova_userId', numericId);

                // Create Profile
                userProfile = {
                    userId: numericId,
                    displayName: "Guest" + numericId,
                    profileImageURL: "",
                    authProvider: "guest",
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                };

                await db.ref('users/' + numericId).set(userProfile);
                console.log("ChatNova: Guest profile created for ID", numericId);
                loadProfileToUI();
            }
        });
    }

    function loadProfileToUI() {
        if (!userProfile) return;
        displayUserId.innerText = userProfile.userId;
        profileNameInput.value = userProfile.displayName;
        if (userProfile.profileImageURL) {
            profileImgPreview.src = userProfile.profileImageURL;
        }
    }

    // --- EVENT LISTENERS ---

    document.getElementById('age-yes').addEventListener('click', async () => {
        ageOverlay.classList.add('fade-out');
        setTimeout(async () => {
            ageOverlay.classList.add('hidden');
            ageOverlay.classList.remove('fade-out');
            
            // Automatically initialize guest user and show app
            await initializeGuestUser();
            appContainer.classList.remove('hidden');
            showScreen('screen-gender');
        }, 500);
    });

    document.getElementById('age-no').addEventListener('click', () => {
        ageOverlay.classList.add('hidden');
        blockedScreen.classList.remove('hidden');
    });

    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const gender = btn.getAttribute('data-gender');
            if (userProfile) {
                userProfile.gender = gender;
                await db.ref('users/' + numericId).update({ gender: gender });
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
            userProfile.displayName = newName;
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
                userProfile.profileImageURL = url;
                profileImgPreview.src = url;
                await db.ref('users/' + numericId).update({ profileImageURL: url });
                console.log("Avatar updated:", url);
            }
        );
    });

    // --- MATCHING SYSTEM ---

    function startMatching() {
        if (isSearching) return;
        if (!db || !numericId) return;

        console.log("ChatNova: Searching... ID:", numericId);
        isSearching = true;
        showScreen('screen-searching');

        const waitingRef = db.ref('waitingUsers/' + numericId);
        waitingRef.set({
            gender: userProfile.gender,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        waitingRef.onDisconnect().remove();

        // Clear and re-attach listeners
        db.ref('activeChats').off('child_added');
        db.ref('activeChats').on('child_added', async (snapshot) => {
            const chat = snapshot.val();
            if (chat.u1 === numericId || chat.u2 === numericId) {
                const pId = (chat.u1 === numericId) ? chat.u2 : chat.u1;
                await joinChat(snapshot.key, pId);
            }
        });
        console.log("Listener Attached: activeChats");

        db.ref('waitingUsers').off('child_added');
        db.ref('waitingUsers').on('child_added', (snapshot) => {
            if (!isSearching) return;
            const pId = snapshot.key;
            if (pId !== numericId && numericId < pId) {
                tryMatch(pId);
            }
        });
        console.log("Listener Attached: waitingUsers");
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

        // Reset message tracking for new chat
        displayedMessageIds.clear();

        // Fetch partner profile
        const pSnap = await db.ref('users/' + pId).once('value');
        partnerProfile = pSnap.val();
        partnerId = pId;
        currentChatId = chatId;
        isSearching = false;

        db.ref('waitingUsers').off('child_added');
        db.ref('activeChats').off('child_added');

        // UI Transition
        partnerName.innerText = partnerProfile ? partnerProfile.displayName : "Stranger";
        partnerAvatar.src = (partnerProfile && partnerProfile.profileImageURL) ? partnerProfile.profileImageURL : "https://via.placeholder.com/40";

        showScreen('screen-chat');
        messagesContainer.innerHTML = '<div class="system-msg">Connected! Say hi to ' + (partnerProfile ? partnerProfile.displayName : "Stranger") + '.</div>';

        const chatRef = db.ref('activeChats/' + chatId);
        chatRef.off('value');
        chatRef.onDisconnect().remove();
        chatRef.on('value', (snapshot) => {
            if (!snapshot.exists() && currentChatId) handlePartnerLeft();
        });
        console.log("Listener Attached: activeChat session");

        const msgsRef = db.ref('messages/' + chatId);
        msgsRef.off('child_added');
        msgsRef.on('child_added', (snapshot) => {
            const msg = snapshot.val();
            displayMessage(msg);
        });
        console.log("Listener Attached: chat messages");
    }

    // --- CHAT SYSTEM ---

    let isSendingMessage = false;

    async function sendMessage() {
        if (isSendingMessage) return;

        const text = chatInput.value.trim();
        if (!text || !currentChatId || !db) return;

        try {
            isSendingMessage = true;
            sendBtn.disabled = true; 

            // Generate Unique Message ID
            const msgId = Date.now() + "-" + Math.random().toString(36).substr(2, 9);
            
            console.log("Message Sent:", msgId);

            await db.ref('messages/' + currentChatId).push({
                messageId: msgId,
                senderId: numericId,
                text: text,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            chatInput.value = '';
        } catch (error) {
            console.error("ChatNova: Send failed:", error);
        } finally {
            // Send Button Protection: Disable briefly (300ms)
            setTimeout(() => {
                isSendingMessage = false;
                sendBtn.disabled = false;
                chatInput.focus();
            }, 300);
        }
    }

    // Attach listeners ONCE at the top level of DOMContentLoaded
    if (sendBtn) {
        // Remove any existing to be ultra-safe (though not expected here)
        sendBtn.removeEventListener('click', sendMessage);
        sendBtn.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent new line if it was a textarea
                sendMessage();
            }
        });
    }

    async function displayMessage(msg) {
        if (!msg.messageId) return; // Ignore legacy messages without IDs
        
        if (displayedMessageIds.has(msg.messageId)) {
            console.log("Duplicate Prevented:", msg.messageId);
            return;
        }
        
        displayedMessageIds.add(msg.messageId);

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
            db.ref('activeChats/' + currentChatId).remove();
        }
        if (numericId) {
            db.ref('waitingUsers/' + numericId).remove();
        }
        db.ref('activeChats').off('child_added');
        db.ref('waitingUsers').off('child_added');
        
        currentChatId = null;
        partnerId = null;
        partnerProfile = null;
        isSearching = false;
        displayedMessageIds.clear();
    }

    // Automatic Session Check
    if (numericId) {
        console.log("ChatNova: Existing session found, initializing...");
        initializeGuestUser().then(() => {
            // Optional: Auto-skip age check if desired, but let's stay safe
            // If you want to skip age check for returning users, uncomment below:
            // ageOverlay.classList.add('hidden');
            // appContainer.classList.remove('hidden');
            // showScreen('screen-gender');
        });
    }
});
