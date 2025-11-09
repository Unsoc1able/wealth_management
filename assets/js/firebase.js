import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA3uIp1nzr_37lv8ik80yx3nWkSFRvCdUQ",
  authDomain: "wealth-managment-a62a7.firebaseapp.com",
  projectId: "wealth-managment-a62a7",
  storageBucket: "wealth-managment-a62a7.firebasestorage.app",
  messagingSenderId: "28529897223",
  appId: "1:28529897223:web:a9d3633563090fcdb85fa2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const transactionsCollection = collection(db, "transactions");
const transactionsQuery = query(transactionsCollection, orderBy("date", "desc"), orderBy("createdAt", "desc"));

function mapSnapshot(snapshot) {
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

export function subscribeToTransactions(onData, onError) {
  return onSnapshot(
    transactionsQuery,
    (snapshot) => {
      const data = mapSnapshot(snapshot);
      onData(data);
    },
    (error) => {
      if (onError) {
        onError(error);
      } else {
        console.error("Ошибка подписки на транзакции", error);
      }
    }
  );
}

export async function fetchTransactionsOnce() {
  const snapshot = await getDocs(transactionsQuery);
  return mapSnapshot(snapshot);
}

export async function createTransaction({
  date,
  amount,
  type,
  majorCategory,
  subCategory,
  note,
  isRecurring = false,
  recurrenceInterval = null
}) {
  const recurring = Boolean(isRecurring);
  const interval = recurring ? recurrenceInterval || "monthly" : null;
  return addDoc(transactionsCollection, {
    date: date instanceof Date ? date : new Date(date),
    amount,
    type,
    majorCategory,
    subCategory: subCategory || null,
    note: note || null,
    isRecurring: recurring,
    recurrenceInterval: interval,
    createdAt: serverTimestamp()
  });
}

export function getFriendlyErrorMessage(error) {
  const baseMessage = "Не удалось выполнить операцию. Проверьте настройки Firebase.";
  if (!error) return baseMessage;

  if (error.code === "permission-denied") {
    return "Нет прав на доступ: проверьте правила безопасности Cloud Firestore.";
  }

  if (error.code === "unavailable") {
    return "Сервис Firestore временно недоступен. Попробуйте позже.";
  }

  if (error.code === "failed-precondition") {
    return "Требуется индекс Firestore. Создайте индекс по подсказке в консоли.";
  }

  if (error.message) {
    return `${baseMessage} (${error.message})`;
  }

  return baseMessage;
}
