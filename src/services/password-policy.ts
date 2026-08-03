const blockedPasswords = new Set([
  "passwordpassword",
  "password123456",
  "123456789012345",
  "qwertyqwertyqwerty",
  "letmeinletmein",
  "adminadminadmin",
  "welcome12345678",
  "iloveyouiloveyou",
  "changemechangeme",
  "correct horse battery staple"
]);

export interface PasswordValidationResult {
  valid: boolean;
  reason?: string;
}

export function validatePasswordPolicy(
  password: string,
  username: string
): PasswordValidationResult {
  const normalizedPassword = password.normalize("NFC").toLowerCase();
  const normalizedUsername = username.normalize("NFC").toLowerCase();

  if (blockedPasswords.has(normalizedPassword)) {
    return {
      valid: false,
      reason: "Password is too common."
    };
  }

  if (normalizedPassword === normalizedUsername) {
    return {
      valid: false,
      reason: "Password must not match the username."
    };
  }

  //only rejecting if username is included if the username is at least 5 characters long
  //to avoid false positives for short usernames  
  if (
    normalizedUsername.length >= 5 &&
    normalizedPassword.includes(normalizedUsername)
    ) {
  return {
    valid: false,
    reason: "Password must not contain the username."
  };
}

  return {
    valid: true
  };
}