import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

// Configuração do projeto Firebase (sistema-de-auditoria-de-ti)
const firebaseConfig = {
  apiKey: "AIzaSyAch2KSa3odfakiNsIIsBp2mHcC-766SbI",
  authDomain: "sistema-de-auditoria-de-ti.firebaseapp.com",
  projectId: "sistema-de-auditoria-de-ti",
  storageBucket: "sistema-de-auditoria-de-ti.firebasestorage.app",
  messagingSenderId: "324210445904",
  appId: "1:324210445904:web:095b5e2f5935abcd154b55",
  measurementId: "G-CNRYBZ58KR"
}

const app = initializeApp(firebaseConfig)

// ← ESSENCIAL: exportar auth para o AuthContext.jsx conseguir importar
export const auth = getAuth(app)
export default app
