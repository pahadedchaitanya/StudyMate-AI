console.log("App.js loaded");

/* ================= FIREBASE IMPORTS ================= */

import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { query, orderBy, onSnapshot } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyCW_hYMJAAwwkDeGY48spzp6UkTEbDDSRE",
  authDomain: "studymate-7ca81.firebaseapp.com",
  projectId: "studymate-7ca81",
  storageBucket: "studymate-7ca81.firebasestorage.app",
  messagingSenderId: "461573673388",
  appId: "1:461573673388:web:e2afcc555628f1b0782a09"
};



const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);



let currentChatId = null;



function setStatus(msg, isError = false) {
  const el = document.getElementById("statusText");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "red" : "green";
}


window.signup = async function () {
  try {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      createdAt: serverTimestamp()
    });

    setStatus("Signup successful");
  } catch (err) {
    setStatus(err.message, true);
  }
};

window.login = async function () {
  try {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    await signInWithEmailAndPassword(auth, email, password);
    setStatus("Login successful");
  } catch (err) {
    setStatus(err.message, true);
  }
};

window.logout = async function () {
  await signOut(auth);
};



onAuthStateChanged(auth, async (user) => {
  const authSection = document.getElementById("authSection");
  const appSection = document.getElementById("appSection");
  const welcomeText = document.getElementById("welcomeText");

  if (user) {
    authSection.style.display = "none";
    appSection.style.display = "block";

    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      welcomeText.textContent = "Welcome, " + snap.data().name;
    }
    loadChats();
    loadBookmarks();


  } else {
    authSection.style.display = "block";
    appSection.style.display = "none";
    welcomeText.textContent = "";
  }
});



window.createChat = async function () {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const chatsRef = collection(db, "users", user.uid, "chats");

    const chatDoc = await addDoc(chatsRef, {
      title: "New Chat",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    currentChatId = chatDoc.id;
    listenToMessages(currentChatId);
    document.getElementById("chatBox").style.display = "block";

    console.log("Chat created with ID:", currentChatId);
  } catch (err) {
    console.error("Error creating chat:", err);
  }
};

window.sendMessage = async function () {
  const user = auth.currentUser;
  const input = document.getElementById("messageInput");

  if (!user || !currentChatId) {
    console.warn("No user or chat selected");
    return;
  }

  const messageText = input.value.trim();
  if (messageText === "") return;

  try {
    const messagesRef = collection(
      db,
      "users",
      user.uid,
      "chats",
      currentChatId,
      "messages"
    );

    await addDoc(messagesRef, {
      text: messageText,
      sender: "user",
      createdAt: serverTimestamp()
    });

    console.log("Message saved");
    input.value = "";

  } catch (err) {
    console.error("Error saving message:", err);
  }
};

function listenToMessages(chatId) {
  const user = auth.currentUser;
  if (!user || !chatId) return;

  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = ""; // clear when switching chats

  const messagesRef = collection(
    db,
    "users",
    user.uid,
    "chats",
    chatId,
    "messages"
  );

  const q = query(messagesRef, orderBy("createdAt"));

  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const p = document.createElement("p");
      p.textContent = msg.sender + ": " + msg.text;
      messagesDiv.appendChild(p);
    });
  });
}

async function loadChats() {
  const user = auth.currentUser;
  if (!user) return;

  const chatListDiv = document.getElementById("chatList");
  chatListDiv.innerHTML = "<h4>Your Chats</h4>";

  const chatsRef = collection(db, "users", user.uid, "chats");
  const snapshot = await getDocs(chatsRef);

  snapshot.forEach((docSnap) => {
    const chat = docSnap.data();
    const btn = document.createElement("button");

    btn.textContent = chat.title || "Chat";
    btn.style.display = "block";

    btn.onclick = () => {
      currentChatId = docSnap.id;

      document.getElementById("chatBox").style.display = "block";

      listenToMessages(currentChatId);

      console.log("Switched to chat:", currentChatId);
    };

    chatListDiv.appendChild(btn);
  });
}
window.toggleBookmark = async function () {
  const user = auth.currentUser;
  const btn = document.getElementById("bookmarkToggleBtn");

  if (!user || !currentChatId) {
    console.warn("No chat selected");
    return;
  }

  btn.disabled = true; // prevent double-click race

  try {
    const bookmarksRef = collection(db, "users", user.uid, "bookmarks");
    const snapshot = await getDocs(bookmarksRef);

    let bookmarkDoc = null;

    snapshot.forEach((docSnap) => {
      if (docSnap.data().chatId === currentChatId) {
        bookmarkDoc = docSnap;
      }
    });

    if (bookmarkDoc) {
      // ❌ REMOVE BOOKMARK
      await deleteDoc(bookmarkDoc.ref);
      btn.textContent = "⭐ Bookmark Chat";
      console.log("Bookmark removed");
    } else {
      // ⭐ ADD BOOKMARK
      const chatRef = doc(db, "users", user.uid, "chats", currentChatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) return;

      await addDoc(bookmarksRef, {
        chatId: currentChatId,
        title: chatSnap.data().title || "Chat",
        createdAt: serverTimestamp()
      });

      btn.textContent = "❌ Remove Bookmark";
      console.log("Chat bookmarked");
    }

    await loadBookmarks(); // refresh UI

  } catch (err) {
    console.error("Toggle bookmark error:", err);
  } finally {
    btn.disabled = false;
  }
};

async function loadBookmarks() {
  const user = auth.currentUser;
  if (!user) return;

  const bookmarkDiv = document.getElementById("bookmarkList");
  bookmarkDiv.innerHTML = "<h4>⭐ Bookmarked Chats</h4>";

  const bookmarksRef = collection(db, "users", user.uid, "bookmarks");
  const snapshot = await getDocs(bookmarksRef);

  if (snapshot.empty) {
    const p = document.createElement("p");
    p.textContent = "No bookmarks yet";
    bookmarkDiv.appendChild(p);
    return;
  }

  snapshot.forEach((docSnap) => {
    const bm = docSnap.data();
    const btn = document.createElement("button");

    btn.textContent = bm.title || "Bookmarked Chat";
    btn.style.display = "block";

    btn.onclick = () => {
      currentChatId = bm.chatId;
      document.getElementById("chatBox").style.display = "block";
      listenToMessages(currentChatId);
      updateBookmarkButton(); // 🔑 sync button state
      console.log("Opened bookmarked chat:", currentChatId);
    };

    bookmarkDiv.appendChild(btn);
  });
}

async function updateBookmarkButton() {
  const user = auth.currentUser;
  const btn = document.getElementById("bookmarkToggleBtn");

  if (!user || !currentChatId) {
    btn.textContent = "⭐ Bookmark Chat";
    return;
  }

  const bookmarksRef = collection(db, "users", user.uid, "bookmarks");
  const snapshot = await getDocs(bookmarksRef);

  let isBookmarked = false;

  snapshot.forEach((docSnap) => {
    if (docSnap.data().chatId === currentChatId) {
      isBookmarked = true;
    }
  });

  btn.textContent = isBookmarked
    ? "❌ Remove Bookmark"
    : "⭐ Bookmark Chat";
}
