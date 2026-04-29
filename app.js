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

    // Cloudinary Config (Unsigned Upload)
    const CLOUDINARY_CLOUD_NAME = "abcxyz123";
    const CLOUDINARY_UPLOAD_PRESET = "chatnovadp";

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
