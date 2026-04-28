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
    let numericId = localStorage.getItem('chatnova_numericId');
    let userProfile = null;
    let currentChatId = null;
    let partnerId = null;
    let partnerProfile = null;
    let isSearching = false;
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
    const cropImage = document.getElementById('crop-image');
    const cropSaveBtn = document.getElementById('crop-save-btn');
    const cropCancelBtn = document.getElementById('crop-cancel-btn');
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

    function setStatus(text, show = true) {
        if (!uploadStatus) return;
        uploadStatus.innerText = text;
        if (show) uploadStatus.classList.remove('hidden');
        else uploadStatus.classList.add('hidden');
    }

    // --- USER PROFILE SYSTEM ---

    async function initUser(gender) {
        if (numericId) {
            // Setup real-time listener for user profile
            db.ref('users/' + numericId).on('value', (snapshot) => {
                userProfile = snapshot.val();
                if (userProfile) loadProfileToUI();
            });
            return;
        }

        console.log("ChatNova: Generating new sequential ID...");
        db.ref('userCounter').transaction((current) => {
            return (current || 1000) + 1;
        }, async (error, committed, snapshot) => {
            if (committed) {
                numericId = snapshot.val().toString();
                localStorage.setItem('chatnova_numericId', numericId);
                
                // Create Profile
                userProfile = {
                    userId: numericId,
                    displayName: "User" + numericId,
                    gender: gender,
                    profileImageURL: "",
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                };
                
                await db.ref('users/' + numericId).set(userProfile);
                console.log("ChatNova: Profile created for ID", numericId);
                
                // Setup real-time listener
                db.ref('users/' + numericId).on('value', (snapshot) => {
                    userProfile = snapshot.val();
                    loadProfileToUI();
                });
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

    // --- IMAGE CROPPING SYSTEM ---

    avatarInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert("Invalid file type. Please select an image.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert("Image is too large (Max 5MB)");
            return;
        }

        setStatus("Processing Image...");
        const reader = new FileReader();
        reader.onload = function(event) {
            cropImage.src = event.target.result;
            cropModal.classList.remove('hidden');
            
            if (cropper) cropper.destroy();
            
            cropper = new Cropper(cropImage, {
                aspectRatio: 1,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.8,
                restore: false,
                guides: false,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
            setStatus("", false);
        };
        reader.readAsDataURL(file);
    });

    cropCancelBtn.addEventListener('click', () => {
        cropModal.classList.add('hidden');
        if (cropper) cropper.destroy();
        avatarInput.value = '';
    });

    cropSaveBtn.addEventListener('click', async () => {
        if (!cropper || !numericId) return;

        setStatus("Cropping & Optimizing...");
        cropSaveBtn.disabled = true;

        // Get high-quality cropped canvas
        const canvas = cropper.getCroppedCanvas({
            width: 512,
            height: 512,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        canvas.toBlob(async (blob) => {
            try {
                setStatus("Uploading to Cloud...");
                const fileName = `avatars/${numericId}_${Date.now()}.jpg`;
                const storageRef = storage.ref(fileName);
                
                const uploadTask = await storageRef.put(blob);
                const url = await uploadTask.ref.getDownloadURL();

                setStatus("Saving Profile...");
                await db.ref('users/' + numericId).update({
                    profileImageURL: url
                });

                setStatus("Saved Successfully!");
                setTimeout(() => {
                    cropModal.classList.add('hidden');
                    setStatus("", false);
                }, 1000);

            } catch (error) {
                console.error("ChatNova: Upload failed", error);
                alert("Upload failed. Please check your connection.");
                setStatus("Error! Try again.");
            } finally {
                cropSaveBtn.disabled = false;
                avatarInput.value = '';
            }
        }, 'image/jpeg', 0.85);
    });

    // --- NAVIGATION & CHAT ---

    document.getElementById('age-yes').addEventListener('click', () => {
        ageOverlay.classList.add('fade-out');
        setTimeout(() => {
            ageOverlay.classList.add('hidden');
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
            await initUser(gender);
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
        
        // Listen to partner profile in real-time
        db.ref('users/' + pId).on('value', (snapshot) => {
            partnerProfile = snapshot.val();
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
        messagesContainer.innerHTML = '<div class="system-msg">Connected! Say hi to ' + (partnerProfile ? partnerProfile.displayName : "Stranger") + '.</div>';
        
        db.ref('activeChats/' + chatId).onDisconnect().remove();
        db.ref('activeChats/' + chatId).on('value', (snapshot) => {
            if (!snapshot.exists() && currentChatId) handlePartnerLeft();
        });

        db.ref('messages/' + chatId).on('child_added', (snapshot) => {
            const msg = snapshot.val();
            displayMessage(msg);
        });
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

    if (sendBtn) {
        sendBtn.removeEventListener('click', sendMessage);
        sendBtn.addEventListener('click', sendMessage);
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }

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
