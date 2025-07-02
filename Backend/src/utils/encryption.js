const crypto = require("crypto")
const CryptoJS = require("crypto-js")

// Generate RSA key pair for user
const generateKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  })

  return { publicKey, privateKey }
}

// Generate AES key for room encryption
const generateRoomKey = () => {
  return crypto.randomBytes(32).toString("hex")
}

// Encrypt message with AES
const encryptMessage = (message, key) => {
  try {
    const encrypted = CryptoJS.AES.encrypt(message, key).toString()
    return encrypted
  } catch (error) {
    console.error("Encryption error:", error)
    throw new Error("Failed to encrypt message")
  }
}

// Decrypt message with AES
const decryptMessage = (encryptedMessage, key) => {
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, key)
    return decrypted.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    console.error("Decryption error:", error)
    throw new Error("Failed to decrypt message")
  }
}

// Encrypt with RSA public key
const encryptWithPublicKey = (message, publicKey) => {
  try {
    const buffer = Buffer.from(message, "utf8")
    const encrypted = crypto.publicEncrypt(publicKey, buffer)
    return encrypted.toString("base64")
  } catch (error) {
    console.error("RSA encryption error:", error)
    throw new Error("Failed to encrypt with public key")
  }
}

// Decrypt with RSA private key
const decryptWithPrivateKey = (encryptedMessage, privateKey) => {
  try {
    const buffer = Buffer.from(encryptedMessage, "base64")
    const decrypted = crypto.privateDecrypt(privateKey, buffer)
    return decrypted.toString("utf8")
  } catch (error) {
    console.error("RSA decryption error:", error)
    throw new Error("Failed to decrypt with private key")
  }
}

// Generate secure hash
const generateHash = (data) => {
  return crypto.createHash("sha256").update(data).digest("hex")
}

// Generate secure random token
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex")
}

module.exports = {
  generateKeyPair,
  generateRoomKey,
  encryptMessage,
  decryptMessage,
  encryptWithPublicKey,
  decryptWithPrivateKey,
  generateHash,
  generateToken,
}
