// import CryptoJS from "crypto-js";

// // Get encryption key from environment or generate one
// const getEncryptionKey = () => {
//   return import.meta.env.VITE_ENCRYPTION_KEY || "fallback_key_for_dev_only";
// };

// export function encryptMessage(message, customKey) {
//   try {
//     const key = customKey || getEncryptionKey();
//     const encrypted = CryptoJS.AES.encrypt(message, key).toString();
//     return encrypted;
//   } catch (error) {
//     console.error("Encryption error:", error);
//     return message; // Return original message if encryption fails
//   }
// }

// export function decryptMessage(encryptedMessage, customKey) {
//   try {
//     const key = customKey || getEncryptionKey();
//     const decrypted = CryptoJS.AES.decrypt(encryptedMessage, key);
//     const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
//     return decryptedText || encryptedMessage; // Return encrypted if decryption fails
//   } catch (error) {
//     console.error("Decryption error:", error);
//     return encryptedMessage; // Return encrypted message if decryption fails
//   }
// }

// window.encryptMessage = encryptMessage;
// window.decryptMessage = decryptMessage;

// export function generateKeyPair() {
//   // For frontend demo - in production, this would be handled by the backend
//   return {
//     publicKey: "mock_public_key_" + Date.now(),
//     privateKey: "mock_private_key_" + Date.now(),
//   };
// }

// export function hashMessage(message) {
//   try {
//     return CryptoJS.SHA256(message).toString();
//   } catch (error) {
//     console.error("Hash error:", error);
//     return message;
//   }
// }

// export function verifyMessageIntegrity(message, hash) {
//   try {
//     return hashMessage(message) === hash;
//   } catch (error) {
//     console.error("Verification error:", error);
//     return false;
//   }
// }

// export function generateSecureId() {
//   return CryptoJS.lib.WordArray.random(16).toString();
// }

import CryptoJS from "crypto-js";

// Get encryption key from environment or fallback
const getEncryptionKey = () => {
  return import.meta.env.VITE_ENCRYPTION_KEY || "fallback_key_for_dev_only";
};

export function encryptMessage(message, customKey) {
  try {
    const key = customKey || getEncryptionKey();
    const encrypted = CryptoJS.AES.encrypt(message, key).toString();
    return encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    return message; // fallback to plain text if error
  }
}

export function decryptMessage(encryptedMessage, customKey) {
  try {
    const key = customKey || getEncryptionKey();
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, key);
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    return decryptedText || encryptedMessage; // fallback if empty
  } catch (error) {
    console.error("Decryption error:", error);
    return encryptedMessage; // fallback
  }
}
