import { expect, it } from 'vitest'
import { validNewPassword } from '../../server/src/passwordPolicy'
it('requires 12–256 characters and both letters and numbers for new passwords', () => {
  for (const password of ['', 'short123', 'abcdefghijkl', '123456789012', null, 'a1'.repeat(129)]) expect(validNewPassword(password)).toBe(false)
  for (const password of ['My-new-pass123', ' spaced password 123 ', 'a1'.repeat(128)]) expect(validNewPassword(password)).toBe(true)
})
