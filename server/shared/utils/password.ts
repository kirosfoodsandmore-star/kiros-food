// Passwords are held and checked by Firebase Authentication; this server never stores or hashes them.
// This is only the rule a new password must meet before it is sent to Firebase.

/** At least 8 characters with a letter and a number. */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
