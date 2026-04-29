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

    const CLOUDINARY_CLOUD_NAME = "dtb2bas38";
    const CLOUDINARY_UPLOAD_PRESET = "chatnova_dp";

    // Initialize Firebase
    let db = null;
    let auth = null;
    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.database();
            auth = firebase.auth();
            console.log("ChatNova: Firebase & Auth initialized");
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
    let cropper = null;

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

    const cropModal = document.getElementById('crop-modal');
    const cropSave = document.getElementById('crop-save');
    const cropCancel = document.getElementById('crop-cancel');
    const imageToCrop = document.getElementById('image-to-crop');
    const uploadStatus = document.getElementById('upload-status');

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
        // Ensure anonymous auth for storage access
        if (auth && !auth.currentUser) {
            try {
                await auth.signInAnonymously();
                console.log("ChatNova: Anonymous session started");
            } catch (e) {
                console.error("Auth failed:", e);
            }
        }

        if (numericId) {
            // Fetch existing profile
            const snapshot = await db.ref('users/' + numericId).once('value');
            if (snapshot.exists()) {
                userProfile = snapshot.val();
                attachProfileListener();
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
                    gender: "",
                    isPremium: false,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                };

                await db.ref('users/' + numericId).set(userProfile);
                console.log("ChatNova: Guest profile created for ID", numericId);
                attachProfileListener();
            }
        });
    }

    function attachProfileListener() {
        if (!numericId || !db) return;

        db.ref('users/' + numericId).on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                userProfile = data;
                loadProfileToUI();
                console.log("ChatNova: Profile synced in real-time");
            }
        });
    }

    function loadProfileToUI() {
        if (!userProfile) return;
        displayUserId.innerText = userProfile.userId;
        profileNameInput.value = userProfile.displayName;
        if (userProfile.profileImageURL) {
            profileImgPreview.src = userProfile.profileImageURL;

            // Update all my sent message avatars in the current chat
            document.querySelectorAll('.message-wrapper.sent .msg-avatar').forEach(img => {
                img.src = userProfile.profileImageURL;
            });
        }
    }

    // --- EVENT LISTENERS ---

    // --- LANDING PAGE LOGIC ---
    const landingPage = document.getElementById('landing-page');
    const startChatBtn = document.getElementById('start-chat-btn');
    const navbar = document.querySelector('.navbar');

    function createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        const particleCount = 40;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.background = 'rgba(168, 85, 247, 0.4)';
            particle.style.borderRadius = '50%';
            const size = Math.random() * 5 + 2;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.filter = 'blur(1px)';

            // Animation
            const duration = Math.random() * 30 + 20;
            particle.animate([
                { transform: 'translate(0, 0)' },
                { transform: `translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px)` }
            ], {
                duration: duration * 1000,
                iterations: Infinity,
                direction: 'alternate',
                easing: 'linear'
            });

            container.appendChild(particle);
        }
    }

    createParticles();

    if (startChatBtn) {
        startChatBtn.addEventListener('click', () => {
            ageOverlay.classList.remove('hidden');
        });
    }

    // --- EVENT LISTENERS ---

    document.getElementById('age-yes').addEventListener('click', async () => {
        ageOverlay.classList.add('fade-out');
        setTimeout(async () => {
            ageOverlay.classList.add('hidden');
            ageOverlay.classList.remove('fade-out');

            // Hide Landing Page
            if (landingPage) landingPage.classList.add('hidden');
            if (navbar) navbar.classList.add('hidden');
            document.body.classList.add('app-active');

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
            console.log("ChatNova: Gender selected");
            const gender = btn.getAttribute('data-gender');
            if (userProfile) {
                userProfile.gender = gender;
                await db.ref('users/' + numericId).update({ gender: gender });
            }
            document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Transition to Matching Choice
            setTimeout(() => {
                showScreen('screen-matching-choice');
            }, 400);
        });
    });

    // Matching Choice Buttons
    document.querySelectorAll('.match-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log("ChatNova: Text Chat clicked");
            const preference = btn.getAttribute('data-preference');

            if (btn.classList.contains('locked') && (!userProfile || !userProfile.isPremium)) {
                console.log("ChatNova: Locked feature clicked");
                document.getElementById('premium-modal').classList.remove('hidden');
                return;
            }

            // Start Matching
            startMatching(preference);
        });
    });

    // Premium Modal Actions
    document.getElementById('premium-cancel').addEventListener('click', () => {
        document.getElementById('premium-modal').classList.add('hidden');
    });

    document.getElementById('upgrade-now-btn').addEventListener('click', async () => {
        // Mock Upgrade Process
        if (!numericId) return;

        try {
            document.getElementById('upgrade-now-btn').innerText = "UPGRADING...";
            await db.ref('users/' + numericId).update({ isPremium: true });

            if (userProfile) userProfile.isPremium = true;

            // Update UI
            document.querySelectorAll('.match-btn.premium').forEach(btn => {
                btn.classList.remove('locked');
                const lock = btn.querySelector('.lock-badge');
                if (lock) lock.remove();
            });

            alert("Success! You are now a Premium user.");
            document.getElementById('premium-modal').classList.add('hidden');
        } catch (e) {
            alert("Upgrade failed. Please try again.");
        } finally {
            document.getElementById('upgrade-now-btn').innerText = "UPGRADE NOW";
        }
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

    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !numericId) return;

        if (!file.type.startsWith('image/')) {
            alert("Please select a valid image file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            imageToCrop.src = event.target.result;
            cropModal.classList.remove('hidden');

            if (cropper) cropper.destroy();

            cropper = new Cropper(imageToCrop, {
                aspectRatio: 1,
                viewMode: 1,
                guides: false,
                autoCropArea: 1,
                dragMode: 'move',
                cropBoxMovable: false,
                cropBoxResizable: false,
                toggleDragModeOnDblclick: false,
            });
        };
        reader.readAsDataURL(file);
    });

    cropCancel.addEventListener('click', () => {
        cropModal.classList.add('hidden');
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        avatarInput.value = '';
    });

    async function uploadToCloudinary(blob) {
        console.log("UPLOAD STARTED");
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error ? errData.error.message : "Cloudinary upload failed");
        }

        const data = await response.json();
        console.log("UPLOAD FINISHED");
        return data.secure_url;
    }

    async function updateProfilePicture() {
        console.log("START UPLOAD");
        if (!cropper || !numericId) {
            console.error("ChatNova: Missing state");
            return;
        }

        try {
            uploadStatus.classList.remove('hidden');
            cropSave.disabled = true;

            // 1. Get cropped canvas
            console.log("STEP 1 OK: Canvas ready");
            const canvas = cropper.getCroppedCanvas({
                width: 300,
                height: 300
            });
            if (!canvas) throw new Error("Canvas generation failed");

            // 2. Convert canvas to Blob
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) {
                        console.log("BLOB CREATED");
                        resolve(b);
                    } else {
                        reject(new Error("Blob creation failed"));
                    }
                }, 'image/jpeg', 0.85);
            });

            // 3. Upload to Cloudinary
            const imageUrl = await uploadToCloudinary(blob);
            console.log("URL RECEIVED");

            // 4. Save URL to Firebase Database
            await db.ref('users/' + numericId).update({
                profileImageURL: imageUrl,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            });
            console.log("DATABASE UPDATED");

            // 5. Update UI profile picture instantly
            alert("Profile picture saved successfully!");
            cropModal.classList.add('hidden');

            // Cleanup
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            avatarInput.value = '';

        } catch (error) {
            console.error("ChatNova: DP Upload Error", error);
            alert("Upload failed: " + error.message);
        } finally {
            console.log("FORCING LOADING STOP");
            uploadStatus.classList.add('hidden');
            cropSave.disabled = false;
        }
    }

    cropSave.addEventListener('click', updateProfilePicture);

    // Cropper Controls
    document.getElementById('rotate-left').addEventListener('click', () => cropper && cropper.rotate(-90));
    document.getElementById('rotate-right').addEventListener('click', () => cropper && cropper.rotate(90));
    document.getElementById('zoom-in').addEventListener('click', () => cropper && cropper.zoom(0.1));
    document.getElementById('zoom-out').addEventListener('click', () => cropper && cropper.zoom(-0.1));

    // --- MATCHING SYSTEM ---
    let matchHeartbeatInterval = null;
    let matchRetryTimeout = null;

    function startMatching(preference = 'random') {
        if (isSearching) return;
        if (!db || !numericId) {
            console.error("ChatNova: Cannot start matching - missing ID or DB");
            return;
        }

        console.log("ChatNova: Searching users...");
        isSearching = true;
        showScreen('screen-searching');

        // Reset state
        if (matchRetryTimeout) clearTimeout(matchRetryTimeout);
        if (matchHeartbeatInterval) clearInterval(matchHeartbeatInterval);

        const waitingRef = db.ref('waitingUsers/' + numericId);
        console.log("ChatNova: User added to waiting list");
        
        const updateWaitingStatus = () => {
            waitingRef.set({
                userId: numericId,
                gender: userProfile.gender || "unknown",
                preference: preference,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        };

        updateWaitingStatus();
        matchHeartbeatInterval = setInterval(updateWaitingStatus, 5000); // Faster heartbeat
        waitingRef.onDisconnect().remove();

        const waitingListRef = db.ref('waitingUsers');
        waitingListRef.off('child_added');
        waitingListRef.on('child_added', (snapshot) => {
            if (!isSearching) return;
            const pId = snapshot.key;
            if (pId === numericId) return;

            const potentialPartner = snapshot.val();
            if (!potentialPartner) return;

            // --- UNIVERSAL MATCHING (NO FILTER) ---
            // As requested: male/male, female/female, male/female all connect.
            console.log("ChatNova: User found, attempting match...");
            
            if (numericId < pId) {
                tryMatch(pId);
            }
        });

        // Failsafe restart
        matchRetryTimeout = setTimeout(() => {
            if (isSearching && !currentChatId) {
                console.log("ChatNova: Retrying search...");
                restartSearch(preference);
            }
        }, 10000);
    }

    async function restartSearch(preference) {
        if (matchHeartbeatInterval) clearInterval(matchHeartbeatInterval);
        await db.ref('waitingUsers/' + numericId).remove();
        isSearching = false;
        startMatching(preference);
    }

    function tryMatch(targetPartnerId) {
        if (!isSearching) return;

        console.log("ChatNova: Attempting transaction with:", targetPartnerId);

        db.ref('waitingUsers/' + targetPartnerId).transaction((current) => {
            if (current) return null;
            return undefined;
        }, async (error, committed) => {
            if (committed) {
                console.log("ChatNova: Chat created");
                await db.ref('waitingUsers/' + numericId).remove();
                
                const newChatId = db.ref('activeChats').push().key;
                await db.ref('activeChats/' + newChatId).set({
                    u1: numericId,
                    u2: targetPartnerId,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });

                await db.ref('users/' + targetPartnerId + '/matchedWith').set({
                    chatId: newChatId,
                    partnerId: numericId
                });

                console.log("ChatNova: Connected");
                await joinChat(newChatId, targetPartnerId);
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
        if (matchHeartbeatInterval) clearInterval(matchHeartbeatInterval);

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
        if (typeof matchRetryTimeout !== 'undefined' && matchRetryTimeout) clearTimeout(matchRetryTimeout);
        if (matchHeartbeatInterval) clearInterval(matchHeartbeatInterval);
        
        if (currentChatId) {
            db.ref('activeChats/' + currentChatId).off();
            db.ref('messages/' + currentChatId).off();
            db.ref('activeChats/' + currentChatId).remove();
        }
        if (numericId) {
            db.ref('waitingUsers/' + numericId).remove();
            db.ref('users/' + numericId + '/matchedWith').remove();
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
