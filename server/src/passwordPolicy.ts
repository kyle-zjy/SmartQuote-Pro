export const PASSWORD_HINT = 'Use 12–256 characters, including at least one letter and one number.'
export function validNewPassword(password: unknown): password is string {
  return (
    typeof password === 'string' &&
    password.length >= 12 &&
    password.length <= 256 &&
    /[a-z]/i.test(password) &&
    /[0-9]/.test(password)
  )
}
